import {
  statusHandler,
  healthCheckCommercetoolsPermissions,
  Errorx,
  CommercetoolsCartService,
  CommercetoolsPaymentService,
  CommercetoolsPaymentMethodService,
  Cart,
  Payment,
} from '@commercetools/connect-payments-sdk';
import { ConfigResponse, StatusResponse } from './types/operation.type';

import { SupportedPaymentComponentsSchemaDTO } from '@app/dtos/operations/payment-componets.dto';
import packageJSON from '../../package.json';

import { getConfig } from '@app/config/config';
import { appLogger, paymentSDK } from '@app/payment-sdk';
import {
  PaymentConfirmResponseDTO,
  PaymentSessionRequestDTO,
  PaymentSessionResponseDTO,
  SubmitPaymentSessionRequestDTO,
  SubmitPaymentSessionResponseDTO,
} from '@app/dtos/cko-payment.dto';
import { getCartIdFromContext, getCheckoutTransactionItemIdFromContext } from '@lib/fastify/context/context';
import { getCkoApiClient } from '@app/clients/cko.client';
import { CreatePaymentSessionConverter } from './converters/create-payment-session.converter';
import { PaymentComponentsConverter } from './converters/payment-components.converter';
import { SubmitPaymentSessionConverter } from './converters/submit-payment-session.converter';
import { log } from '@lib/logger';
import { CkoWebhookEvent } from '@app/clients/types/webhook.type';
import { NotificationConverter } from './converters/notification.converter';
import { UnsupportedNotificationError } from '@app/errors/cko-api.error';
import { CkoPaymentServiceOptions, NotificationUpdatePayment } from './types/cko-payment.type';
import { randomUUID } from 'crypto';
import { isMethodAutoCaptured } from '@app/helpers/method-auto-capture.helper';
import { convertPaymentMethodFromCkoFormat } from '@app/helpers/method-name.helper';
import { buildRedirectMerchantUrl, populateInterfaceInteraction } from './helper.service';
import { CkoPaymentSessionStatus } from '@app/clients/types/payment-session.type';

export class CkoPaymentService {
  private readonly ctCartService: CommercetoolsCartService;
  private readonly ctPaymentService: CommercetoolsPaymentService;
  private readonly ctPaymentMethodService: CommercetoolsPaymentMethodService;
  private readonly paymentComponentsConverter: PaymentComponentsConverter;
  private readonly createPaymentSessionConverter: CreatePaymentSessionConverter;
  private readonly submitPaymentSessionConverter: SubmitPaymentSessionConverter;
  private readonly notificationConverter: NotificationConverter;

  constructor(opts: CkoPaymentServiceOptions) {
    this.ctCartService = opts.ctCartService;
    this.ctPaymentService = opts.ctPaymentService;
    this.ctPaymentMethodService = opts.ctPaymentMethodService;
    this.paymentComponentsConverter = opts.paymentComponentsConverter;
    this.createPaymentSessionConverter = opts.createPaymentSessionConverter;
    this.submitPaymentSessionConverter = opts.submitPaymentSessionConverter;
    this.notificationConverter = opts.notificationConverter;
  }

  /**
   * Get configurations
   *
   * @remarks
   * Implementation to provide mocking configuration information
   *
   * @returns Promise with mocking object containing configuration information
   */
  public async config(): Promise<ConfigResponse> {
    const config = getConfig();
    return {
      publicKey: config.getPublicKey(),
      environment: config.ckoEnvironment,
      storedPaymentMethodsEnabled: config.isStoredPaymentMethodsEnabled(),
    };
  }

  /**
   * Get status
   *
   * @remarks
   * Implementation to provide mocking status of external systems
   *
   * @returns Promise with mocking data containing a list of status from different external systems
   */
  public async status(): Promise<StatusResponse> {
    const handler = await statusHandler({
      timeout: getConfig().healthCheckTimeout,
      log: appLogger,
      checks: [
        healthCheckCommercetoolsPermissions({
          requiredPermissions: [
            'manage_payments',
            'view_sessions',
            'view_api_clients',
            'view_customers',
            'manage_orders',
            'introspect_oauth_tokens',
            'manage_checkout_payment_intents',
            'manage_types',
            'manage_payment_methods',
          ],
          ctAuthorizationService: paymentSDK.ctAuthorizationService,
          projectKey: getConfig().projectKey,
        }),
        async () => {
          try {
            const result = await getCkoApiClient().paymentMethods.getPaymentMethods();
            return {
              name: 'checkout.com status check',
              status: 'UP',
              details: {
                paymentMethods: result.methods,
              },
            };
          } catch (e) {
            return {
              name: 'checkout.com status check',
              status: 'DOWN',
              message: `Not able to talk to the checkout.com API`,
              details: {
                error: e,
              },
            };
          }
        },
      ],
      metadataFn: async () => ({
        name: packageJSON.name,
        description: packageJSON.description,
        '@commercetools/connect-payments-sdk': packageJSON.dependencies['@commercetools/connect-payments-sdk'],
      }),
    })();

    return handler.body;
  }

  /**
   * Get supported payment components
   *
   * @remarks
   * Implementation to provide the mocking payment components supported by the processor.
   *
   * @returns Promise with mocking data containing a list of supported payment components
   */
  public async getSupportedPaymentComponents(): Promise<SupportedPaymentComponentsSchemaDTO> {
    return this.paymentComponentsConverter.convertResponse();
  }

  /**
   * Creates a CKO payment session
   *
   * @param opts - The payment session request data
   * @returns The payment session response data
   */
  public async createPaymentSession(opts: { data: PaymentSessionRequestDTO }): Promise<PaymentSessionResponseDTO> {
    const cartId = getCartIdFromContext();
    log.info('Creating payment session', { cartId });
    const ctCart = await this.ctCartService.getCart({ id: cartId });

    // Create payment with customer info
    const ctPayment = await this.createPaymentForCart(ctCart);

    // Link payment to cart
    const updatedCart = await this.ctCartService.addPayment({
      resource: { id: ctCart.id, version: ctCart.version },
      paymentId: ctPayment.id,
    });

    // Create and send CKO payment session request
    const ckoRequest = this.createPaymentSessionConverter.convertRequest({
      data: opts.data,
      cart: updatedCart,
      payment: ctPayment,
    });

    try {
      const ckoResponse = await getCkoApiClient().paymentSessions.createPaymentSession(ckoRequest);
      const interfaceInteraction = populateInterfaceInteraction({
        interactionId: randomUUID(),
        type: 'CreatePaymentSession',
        createdAt: new Date().toISOString(),
        request: JSON.stringify(ckoRequest),
        response: JSON.stringify(ckoResponse),
      });

      await this.ctPaymentService.updatePayment({
        id: ctPayment.id,
        pspInteractions: interfaceInteraction,
      });

      log.info('Payment session created successfully', {
        paymentId: ctPayment.id,
        sessionId: ckoResponse.id,
      });

      return this.createPaymentSessionConverter.convertResponse({ responseData: ckoResponse, payment: ctPayment });
    } catch (err) {
      log.error('Error creating payment session', { err, cartId: ctCart.id, paymentId: ctPayment.id });
      throw err;
    }
  }

  /**
   * Submits a CKO payment session
   *
   * @param id - The payment session ID
   * @param opts - The submit payment session request data
   * @returns The submit payment session response data
   */
  public async submitPaymentSession(
    id: string,
    opts: { data: SubmitPaymentSessionRequestDTO },
  ): Promise<SubmitPaymentSessionResponseDTO> {
    log.info('Submitting payment session', { sessionId: id, paymentReference: opts.data.paymentReference });
    const payment = await this.ctPaymentService.getPayment({
      id: opts.data.paymentReference,
    });

    const ckoRequest = this.submitPaymentSessionConverter.convertRequest({
      requestData: opts.data,
    });

    try {
      const ckoResponse = await getCkoApiClient().paymentSessions.submitPaymentSession(id, ckoRequest);

      const response = this.submitPaymentSessionConverter.convertResponse({ responseData: ckoResponse, payment });
      const transactionType = isMethodAutoCaptured(ckoResponse.type) ? 'Charge' : 'Authorization';
      const paymentMethodType = convertPaymentMethodFromCkoFormat(ckoResponse.type);
      const interfaceInteraction = populateInterfaceInteraction({
        interactionId: randomUUID(),
        type: 'SubmitPaymentSession',
        createdAt: new Date().toISOString(),
        request: JSON.stringify(ckoRequest),
        response: JSON.stringify(ckoResponse),
      });

      const updatedPayment = await this.ctPaymentService.updatePayment({
        id: payment.id,
        pspReference: response.id,
        paymentMethodInfo: {
          method: paymentMethodType,
        },
        transaction: {
          type: transactionType,
          amount: payment.amountPlanned,
          interfaceId: response.id,
          state: this.convertPaymentStatus(response.status),
        },
        pspInteractions: interfaceInteraction,
      });

      log.info('Payment session submitted', {
        payment: {
          id: updatedPayment.id,
          version: updatedPayment.version,
        },
        interactionId: response.id,
        result: response.status,
      });

      return response;
    } catch (err) {
      log.error('Error submitting payment session', { err, paymentId: payment.id });
      throw err;
    }
  }

  /**
   * Confirms a payment after user completes the payment flow
   *
   * @param opts - Payment confirmation data including payment reference, CKO payment ID and success status
   * @returns Promise with payment reference and merchant return URL
   */
  public async confirmPayment(opts: {
    paymentReference: string;
    ckoPaymentId: string;
    isSuccess: boolean;
  }): Promise<PaymentConfirmResponseDTO> {
    log.info('Confirming payment', {
      paymentReference: opts.paymentReference,
      ckoPaymentId: opts.ckoPaymentId,
      isSuccess: opts.isSuccess,
    });
    const payment = await this.ctPaymentService.getPayment({
      id: opts.paymentReference,
    });

    try {
      const ckoPayment = await getCkoApiClient().payments.getPayment(opts.ckoPaymentId);
      const methodType = ckoPayment.source?.type || 'unknown';
      const transactionType = isMethodAutoCaptured(methodType) ? 'Charge' : 'Authorization';
      const interfaceInteraction = populateInterfaceInteraction({
        interactionId: randomUUID(),
        type: 'ConfirmPaymentSession',
        createdAt: new Date().toISOString(),
        request: JSON.stringify({ ckoPaymentId: opts.ckoPaymentId, isSuccess: opts.isSuccess }),
      });

      const updatedPayment = await this.ctPaymentService.updatePayment({
        id: opts.paymentReference,
        transaction: {
          type: transactionType,
          amount: payment.amountPlanned,
          interfaceId: opts.ckoPaymentId,
          state: opts.isSuccess ? 'Success' : 'Failure',
        },
        pspInteractions: interfaceInteraction,
      });

      log.info(`Payment confirmation processed.`, {
        payment: {
          id: updatedPayment.id,
          version: updatedPayment.version,
        },
        interactionId: opts.ckoPaymentId,
        result: opts.isSuccess ? 'Success' : 'Failure',
      });

      return {
        paymentReference: updatedPayment.id,
        merchantReturnUrl: buildRedirectMerchantUrl(updatedPayment.id),
      };
    } catch (err) {
      log.error('Error confirming payment session', { err, paymentId: payment.id });
      throw err;
    }
  }

  /**
   * Processes webhook notifications from Checkout.com
   *
   * @remarks
   * Handles payment status updates from CKO webhooks and optionally stores payment methods
   * Silently ignores unsupported notifications or when payment is not found
   *
   * @param opts - Webhook event data from Checkout.com
   */
  public async processNotification(opts: { event: CkoWebhookEvent }): Promise<void> {
    log.info('Processing notification', { notification: JSON.stringify(opts.event) });
    try {
      const updateData = await this.notificationConverter.convert(opts);

      const interfaceInteraction = populateInterfaceInteraction({
        interactionId: randomUUID(),
        type: 'Notification',
        createdAt: new Date().toISOString(),
        request: JSON.stringify({ event: opts.event }),
      });

      const updatedPayment = await this.ctPaymentService.updatePayment({
        id: updateData.paymentId,
        ...(updateData.pspReference && { pspReference: updateData.pspReference }),
        ...(updateData.paymentMethodInfo && { paymentMethodInfo: updateData.paymentMethodInfo }),
        transaction: updateData.transaction,
        pspInteractions: interfaceInteraction,
      });

      log.info('Payment updated after processing the notification', {
        paymentId: updatedPayment.id,
        version: updatedPayment.version,
        pspReference: updateData.pspReference,
        paymentMethod: updateData.paymentMethodInfo,
        transaction: JSON.stringify(updateData.transaction),
      });

      // Save payment method if required
      const storePaymentMethod = await this.shouldStorePaymentMethod(updateData);
      await this.savePaymentMethod(updatedPayment, storePaymentMethod);
    } catch (e) {
      if (e instanceof UnsupportedNotificationError) {
        log.info('Unsupported notification received', { notification: JSON.stringify(opts.event) });
        return;
      } else if (e instanceof Errorx && e.code === 'ResourceNotFound') {
        log.info('Payment not found hence accepting the notification', { notification: JSON.stringify(opts.event) });
        return;
      }

      log.error('Error processing notification', { err: e, notification: JSON.stringify(opts.event) });
      throw e;
    }
  }

  /**
   * Creates a payment in commercetools for the given cart
   *
   * @remarks
   * Automatically associates the payment with the customer or anonymous ID from the cart
   *
   * @param cart - The cart to create payment for
   * @returns Promise with the created payment
   */
  private async createPaymentForCart(cart: Cart): Promise<Payment> {
    const amountPlanned = await this.ctCartService.getPlannedPaymentAmount({ cart });

    const paymentData = {
      amountPlanned,
      paymentMethodInfo: {
        paymentInterface: getConfig().getPaymentInterface(),
        interfaceAccount: getConfig().getInterfaceAccount(),
      },
      checkoutTransactionItemId: getCheckoutTransactionItemIdFromContext(),
    };

    // Add customer reference if available
    if (cart.customerId) {
      return this.ctPaymentService.createPayment({
        ...paymentData,
        customer: { typeId: 'customer', id: cart.customerId },
      });
    }

    // Add anonymous ID if no customer
    if (cart.anonymousId) {
      return this.ctPaymentService.createPayment({
        ...paymentData,
        anonymousId: cart.anonymousId,
      });
    }

    // Neither customer nor anonymous
    return this.ctPaymentService.createPayment(paymentData);
  }

  /**
   * Checks if the payment method should be stored based on notification update data
   *
   * @param updateData - The notification update payment data
   * @returns True if the payment method should be stored, false otherwise
   */
  private shouldStorePaymentMethod(updateData: NotificationUpdatePayment): boolean {
    return updateData.paymentMethodInfo?.custom?.fields?.storePaymentMethod === true;
  }

  /**
   * Saves a payment method for future use if requested by customer
   *
   * @param payment - The payment containing the method to save
   * @param storePaymentMethod - Whether to store the payment method
   */
  private async savePaymentMethod(payment: Payment, storePaymentMethod: boolean): Promise<void> {
    if (!storePaymentMethod) return;

    log.info('Storing payment method as per customer request', {
      paymentId: payment.id,
    });

    try {
      const doesTokenAlreadyExist = await this.ctPaymentMethodService.doesTokenBelongsToCustomer({
        customerId: payment.customer?.id as string,
        paymentInterface: payment.paymentMethodInfo.paymentInterface!,
        interfaceAccount: payment.paymentMethodInfo.interfaceAccount,
        tokenValue: payment.paymentMethodInfo.token!.value,
      });

      if (doesTokenAlreadyExist) {
        log.info('Payment method token already exists for customer, skipping storage', {
          paymentId: payment.id,
          customerId: payment.customer?.id,
        });
        return;
      }

      const spm = await this.ctPaymentMethodService.save({
        customerId: payment.customer?.id as string,
        method: payment.paymentMethodInfo.method as string,
        token: payment.paymentMethodInfo.token!.value,
        paymentInterface: payment.paymentMethodInfo.paymentInterface!,
        interfaceAccount: payment.paymentMethodInfo.interfaceAccount,
        customFields: payment.paymentMethodInfo.custom,
      });

      log.info('Stored payment method successfully', {
        paymentId: payment.id,
        storedPaymentMethodId: spm.id,
      });
    } catch (err) {
      log.error('Error storing payment method', { err, paymentId: payment.id });
    }
  }

  /**
   * Converts Checkout.com payment status to commercetools transaction state
   *
   * @param status - The CKO payment status
   * @returns Commercetools transaction state (Success, Failure, or Initial)
   */
  private convertPaymentStatus(status: CkoPaymentSessionStatus): string {
    if (status === CkoPaymentSessionStatus.APPROVED) {
      return 'Success';
    } else if (status === CkoPaymentSessionStatus.DECLINED) {
      return 'Failure';
    } else {
      return 'Initial';
    }
  }
}
