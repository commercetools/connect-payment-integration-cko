import {
  statusHandler,
  healthCheckCommercetoolsPermissions,
  ErrorInvalidOperation,
  Errorx,
} from '@commercetools/connect-payments-sdk';
import {
  CancelPaymentRequest,
  CapturePaymentRequest,
  ConfigResponse,
  PaymentProviderModificationResponse,
  RefundPaymentRequest,
  ReversePaymentRequest,
  StatusResponse,
} from './types/operation.type';

import { SupportedPaymentComponentsSchemaDTO } from '../dtos/operations/payment-componets.dto';
import { PaymentModificationStatus } from '../dtos/operations/payment-intents.dto';
import packageJSON from '../../package.json';

import { AbstractPaymentService } from './abstract-payment.service';
import { config, getConfig } from '../config/config';
import { appLogger, paymentSDK } from '../payment-sdk';
import {
  PaymentConfirmResponseDTO,
  PaymentSessionRequestDTO,
  PaymentSessionResponseDTO,
  SubmitPaymentSessionRequestDTO,
  SubmitPaymentSessionResponseDTO,
} from '../dtos/cko-payment.dto';
import {
  getCartIdFromContext,
  getMerchantReturnUrlFromContext,
  getPaymentInterfaceFromContext,
} from '../libs/fastify/context/context';
import { CkoPaymentStatus, PaymentSessionRequest } from '../clients/types/payment-session.type';
import { getCheckoutApiClient } from '../clients/cko.client';
import { CreatePaymentSessionConverter } from './converters/create-payment-session.converter';
import { PaymentComponentsConverter } from './converters/payment-components.converter';
import { SubmitPaymentSessionConverter } from './converters/submit-payment-session.converter';
import { log } from '../libs/logger';
import { ReversePaymentConverter } from './converters/reverse-payment.converter';
import { CapturePaymentConverter } from './converters/capture-payment.converter';
import { VoidPaymentConverter } from './converters/void-payment.converter';
import { RefundPaymentConverter } from './converters/refund-payment.converter';
import { CkoWebhookEvent } from '../clients/types/webhook.type';
import { NotificationConverter } from './converters/notification.converter';
import { UnsupportedNotificationError } from '../errors/cko-api.error';
import { CkoPaymentServiceOptions } from './types/cko-payment.type';
import { randomUUID } from 'crypto';
import { isMethodAutoCaptured } from '../helpers/method-auto-capture.helper';
import { convertPaymentMethodFromCkoFormat } from '../helpers/method-name.helper';

export class CkoPaymentService extends AbstractPaymentService {
  private paymentComponentsConverter: PaymentComponentsConverter;
  private createPaymentSessionConverter: CreatePaymentSessionConverter;
  private submitPaymentSessionConverter: SubmitPaymentSessionConverter;
  private voidPaymentConverter: VoidPaymentConverter;
  private reversePaymentConverter: ReversePaymentConverter;
  private capturePaymentConverter: CapturePaymentConverter;
  private refundPaymentConverter: RefundPaymentConverter;
  private notificationConverter: NotificationConverter;

  constructor(opts: CkoPaymentServiceOptions) {
    super(opts.ctCartService, opts.ctPaymentService);
    this.paymentComponentsConverter = new PaymentComponentsConverter();
    this.createPaymentSessionConverter = new CreatePaymentSessionConverter();
    this.submitPaymentSessionConverter = new SubmitPaymentSessionConverter();
    this.voidPaymentConverter = new VoidPaymentConverter();
    this.reversePaymentConverter = new ReversePaymentConverter();
    this.capturePaymentConverter = new CapturePaymentConverter();
    this.refundPaymentConverter = new RefundPaymentConverter();
    this.notificationConverter = new NotificationConverter();
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
            'manage_orders',
            'introspect_oauth_tokens',
            'manage_checkout_payment_intents',
            'manage_types',
          ],
          ctAuthorizationService: paymentSDK.ctAuthorizationService,
          projectKey: getConfig().projectKey,
        }),
        async () => {
          try {
            const paymentMethods = 'card';
            return {
              name: 'Mock Payment API',
              status: 'UP',
              message: 'Mock api is working',
              details: {
                paymentMethods,
              },
            };
          } catch (e) {
            return {
              name: 'Mock Payment API',
              status: 'DOWN',
              message: 'The mock paymentAPI is down for some reason. Please check the logs for more details.',
              details: {
                // TODO do not expose the error
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
   * Capture payment
   *
   * @remarks
   * Implementation to provide the mocking data for payment capture in external PSPs
   *
   * @param request - contains the amount and {@link https://docs.commercetools.com/api/projects/payments | Payment } defined in composable commerce
   * @returns Promise with mocking data containing operation status and PSP reference
   */
  public async capturePayment(request: CapturePaymentRequest): Promise<PaymentProviderModificationResponse> {
    log.info(`Processing payment modification.`, {
      paymentId: request.payment.id,
      action: 'capturePayment',
    });

    const ckoRequestData = this.capturePaymentConverter.convertRequest({ requestData: request });
    const ckoPaymentId = request.payment.interfaceId as string;

    let isSuccess = true;
    let operationId;
    try {
      const response = await getCheckoutApiClient().payments.capturePayment(ckoPaymentId, ckoRequestData);
      operationId = response.action_id;
    } catch (error) {
      log.error(`Error capturing payment: ${error}`, {
        paymentId: request.payment.id,
        action: 'capturePayment',
        result: 'Failure',
      });
      isSuccess = false;
    }

    const updatePayment = await this.ctPaymentService.updatePayment({
      id: request.payment.id,
      transaction: {
        type: 'Charge',
        amount: request.amount,
        interfaceId: operationId,
        state: isSuccess ? 'Success' : 'Failure',
      },
    });

    log.info(`Payment modification completed.`, {
      payment: {
        id: updatePayment.id,
        version: updatePayment.version,
      },
      interactionId: operationId || 'error',
      action: 'capturePayment',
      result: isSuccess ? 'Success' : 'Failure',
    });

    return {
      outcome: isSuccess ? PaymentModificationStatus.APPROVED : PaymentModificationStatus.REJECTED,
      pspReference: request.payment.interfaceId as string,
    };
  }

  /**
   * Cancel payment
   *
   * @remarks
   * Implementation to provide the mocking data for payment cancel in external PSPs
   *
   * @param request - contains {@link https://docs.commercetools.com/api/projects/payments | Payment } defined in composable commerce
   * @returns Promise with mocking data containing operation status and PSP reference
   */
  public async cancelPayment(request: CancelPaymentRequest): Promise<PaymentProviderModificationResponse> {
    log.info(`Processing payment modification.`, {
      paymentId: request.payment.id,
      action: 'cancelPayment',
    });

    const ckoRequestData = this.voidPaymentConverter.convertRequest({ requestData: request });
    const ckoPaymentId = request.payment.interfaceId as string;

    let isSuccess = true;
    let operationId;
    try {
      const response = await getCheckoutApiClient().payments.voidPayment(ckoPaymentId, ckoRequestData);
      operationId = response.action_id;
    } catch (error) {
      log.error(`Error cancelling payment: ${error}`, {
        paymentId: request.payment.id,
        action: 'cancelPayment',
        result: 'Failure',
      });
      isSuccess = false;
    }

    const updatePayment = await this.ctPaymentService.updatePayment({
      id: request.payment.id,
      transaction: {
        type: 'CancelAuthorization',
        amount: request.payment.amountPlanned,
        interfaceId: operationId,
        state: isSuccess ? 'Success' : 'Failure',
      },
    });

    log.info(`Payment modification completed.`, {
      payment: {
        id: updatePayment.id,
        version: updatePayment.version,
      },
      interactionId: operationId || 'error',
      action: 'cancelPayment',
      result: isSuccess ? 'Success' : 'Failure',
    });

    return {
      outcome: isSuccess ? PaymentModificationStatus.APPROVED : PaymentModificationStatus.REJECTED,
      pspReference: request.payment.interfaceId as string,
    };
  }

  /**
   * Refund payment
   *
   * @remarks
   * Implementation to provide the mocking data for payment refund in external PSPs
   *
   * @param request - contains amount and {@link https://docs.commercetools.com/api/projects/payments | Payment } defined in composable commerce
   * @returns Promise with mocking data containing operation status and PSP reference
   */
  public async refundPayment(request: RefundPaymentRequest): Promise<PaymentProviderModificationResponse> {
    log.info(`Processing payment modification.`, {
      paymentId: request.payment.id,
      action: 'refundPayment',
    });

    const ckoRequestData = this.refundPaymentConverter.convertRequest({ requestData: request });
    const ckoPaymentId = request.payment.interfaceId as string;

    let isSuccess = true;
    let operationId;
    try {
      const response = await getCheckoutApiClient().payments.refundPayment(ckoPaymentId, ckoRequestData);
      operationId = response.action_id;
    } catch (error) {
      log.error(`Error refunding payment: ${error}`, {
        paymentId: request.payment.id,
        action: 'refundPayment',
        result: 'Failure',
      });
      isSuccess = false;
    }

    const updatePayment = await this.ctPaymentService.updatePayment({
      id: request.payment.id,
      transaction: {
        type: 'Refund',
        amount: request.amount,
        interfaceId: operationId,
        state: isSuccess ? 'Success' : 'Failure',
      },
    });

    log.info(`Payment modification completed.`, {
      payment: {
        id: updatePayment.id,
        version: updatePayment.version,
      },
      interactionId: operationId || 'error',
      action: 'refundPayment',
      result: isSuccess ? 'Success' : 'Failure',
    });

    return {
      outcome: isSuccess ? PaymentModificationStatus.APPROVED : PaymentModificationStatus.REJECTED,
      pspReference: request.payment.interfaceId as string,
    };
  }

  /**
   * Reverse payment
   *
   * @remarks
   * Abstract method to execute payment reversals in support of automated reversals to be triggered by checkout api. The actual invocation to PSPs should be implemented in subclasses
   *
   * @param request
   * @returns Promise with outcome containing operation status and PSP reference
   */
  public async reversePayment(request: ReversePaymentRequest): Promise<PaymentProviderModificationResponse> {
    log.info(`Processing payment modification.`, {
      paymentId: request.payment.id,
      action: 'reversePayment',
    });

    const hasCharge = this.ctPaymentService.hasTransactionInState({
      payment: request.payment,
      transactionType: 'Charge',
      states: ['Pending', 'Success'],
    });

    const ckoRequestData = this.reversePaymentConverter.convertRequest({ requestData: request });
    const ckoPaymentId = request.payment.interfaceId as string;

    let isSuccess = true;
    let operationId;
    try {
      const response = await getCheckoutApiClient().payments.reversePayment(ckoPaymentId, ckoRequestData);
      operationId = response.action_id;
    } catch (error) {
      log.error(`Error reversing payment: ${error}`, {
        paymentId: request.payment.id,
        action: 'reversePayment',
        result: 'Failure',
      });
      isSuccess = false;
    }

    const updatePayment = await this.ctPaymentService.updatePayment({
      id: request.payment.id,
      transaction: {
        type: hasCharge ? 'Refund' : 'CancelAuthorization',
        amount: request.payment.amountPlanned,
        interfaceId: operationId,
        state: isSuccess ? 'Success' : 'Failure',
      },
    });

    log.info(`Payment modification completed.`, {
      payment: {
        id: updatePayment.id,
        version: updatePayment.version,
      },
      interactionId: operationId || 'error',
      action: 'reversePayment',
      result: isSuccess ? 'Success' : 'Failure',
    });

    return {
      outcome: isSuccess ? PaymentModificationStatus.APPROVED : PaymentModificationStatus.REJECTED,
      pspReference: request.payment.interfaceId as string,
    };
  }

  async createSession(opts: { data: PaymentSessionRequestDTO }): Promise<PaymentSessionResponseDTO> {
    const ctCart = await this.ctCartService.getCart({
      id: getCartIdFromContext(),
    });

    const amountPlanned = await this.ctCartService.getPlannedPaymentAmount({ cart: ctCart });
    const ctPayment = await this.ctPaymentService.createPayment({
      amountPlanned,
      paymentMethodInfo: {
        paymentInterface: 'checkout-cko',
        interfaceAccount: getConfig().getChannelId(),
      },
      checkoutTransactionItemId: getPaymentInterfaceFromContext(),
      ...(ctCart.customerId && {
        customer: {
          typeId: 'customer',
          id: ctCart.customerId,
        },
      }),
      ...(!ctCart.customerId &&
        ctCart.anonymousId && {
          anonymousId: ctCart.anonymousId,
        }),
    });

    const updatedCart = await this.ctCartService.addPayment({
      resource: {
        id: ctCart.id,
        version: ctCart.version,
      },
      paymentId: ctPayment.id,
    });

    const ckoRequestData = this.createPaymentSessionConverter.convertRequest({
      data: opts.data,
      cart: updatedCart,
      payment: ctPayment,
    });

    console.log('Creating payment session with data:', JSON.stringify(ckoRequestData, null, 2));

    try {
      const res = await getCheckoutApiClient().paymentSessions.createPaymentSession(ckoRequestData);

      console.log('Payment session created with response:', JSON.stringify(res, null, 2));

      await this.ctPaymentService.updatePayment({
        id: ctPayment.id,
        pspInteractions: [
          {
            type: {
              typeId: 'type',
              key: 'ctcheckout-payment-interface-interaction-type',
            },
            fields: {
              interactionId: randomUUID(),
              type: 'CreatePaymentSession',
              createdAt: new Date().toISOString(),
              request: JSON.stringify(ckoRequestData),
              response: JSON.stringify(res),
            },
          },
        ],
      });

      return this.createPaymentSessionConverter.convertResponse({ responseData: res, payment: ctPayment });
    } catch (e) {
      console.error('Error creating payment session:', e);
      throw e;
    }
  }

  async submitPaymentSession(
    id: string,
    opts: { data: SubmitPaymentSessionRequestDTO },
  ): Promise<SubmitPaymentSessionResponseDTO> {
    try {
      const payment = await this.ctPaymentService.getPayment({
        id: opts.data.paymentReference,
      });

      const ckoRequestData = this.submitPaymentSessionConverter.convertRequest({
        requestData: opts.data,
      });
      const res = await getCheckoutApiClient().paymentSessions.submitPaymentSession(id, ckoRequestData);

      const response = this.submitPaymentSessionConverter.convertResponse({ responseData: res, payment });
      const transactionType = isMethodAutoCaptured(res.type) ? 'Charge' : 'Authorization';

      const updatedPayment = await this.ctPaymentService.updatePayment({
        id: payment.id,
        pspReference: response.id,
        paymentMethodInfo: {
          method: convertPaymentMethodFromCkoFormat(res.type),
        },
        transaction: {
          type: transactionType,
          amount: payment.amountPlanned,
          interfaceId: response.id,
          state: this.convertPaymentStatus(response.status),
        },
        pspInteractions: [
          {
            type: {
              typeId: 'type',
              key: 'ctcheckout-payment-interface-interaction-type',
            },
            fields: {
              interactionId: randomUUID(),
              type: 'SubmitPaymentSession',
              createdAt: new Date().toISOString(),
              request: JSON.stringify(ckoRequestData),
              response: JSON.stringify(res),
            },
          },
        ],
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
    } catch (e) {
      throw e;
    }
  }

  public async confirmPayment(opts: {
    paymentReference: string;
    ckoPaymentId: string;
    isSuccess: boolean;
  }): Promise<PaymentConfirmResponseDTO> {
    const payment = await this.ctPaymentService.getPayment({
      id: opts.paymentReference,
    });

    const ckoPayment = await getCheckoutApiClient().payments.getPayment(opts.ckoPaymentId);
    const methodType = ckoPayment.source?.type || 'unknown';
    const transactionType = isMethodAutoCaptured(methodType) ? 'Charge' : 'Authorization';

    const updatedPayment = await this.ctPaymentService.updatePayment({
      id: opts.paymentReference,
      transaction: {
        type: transactionType,
        amount: payment.amountPlanned,
        interfaceId: opts.ckoPaymentId,
        state: opts.isSuccess ? 'Success' : 'Failure',
      },
      pspInteractions: [
        {
          type: {
            typeId: 'type',
            key: 'ctcheckout-payment-interface-interaction-type',
          },
          fields: {
            interactionId: randomUUID(),
            type: 'ConfirmPaymentSession',
            createdAt: new Date().toISOString(),
            request: JSON.stringify({ ckoPaymentId: opts.ckoPaymentId, isSuccess: opts.isSuccess }),
            response: JSON.stringify({}),
          },
        },
      ],
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
      merchantReturnUrl: this.buildRedirectMerchantUrl(updatedPayment.id),
    };
  }

  public async processNotification(opts: { event: CkoWebhookEvent }): Promise<void> {
    try {
      const updateData = await this.notificationConverter.convert(opts);

      const updatedPayment = await this.ctPaymentService.updatePayment({
        id: updateData.paymentId,
        ...(updateData.pspReference && { pspReference: updateData.pspReference }),
        ...(updateData.paymentMethodInfo && { paymentMethodInfo: updateData.paymentMethodInfo }),
        transaction: updateData.transaction,
      });

      log.info('Payment updated after processing the notification', {
        paymentId: updatedPayment.id,
        version: updatedPayment.version,
        pspReference: updateData.pspReference,
        paymentMethod: updateData.paymentMethodInfo,
        transaction: JSON.stringify(updateData.transaction),
      });
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

  private convertPaymentStatus(status: CkoPaymentStatus): string {
    if (status === CkoPaymentStatus.APPROVED) {
      return 'Success';
    } else if (status === CkoPaymentStatus.DECLINED) {
      return 'Failure';
    } else {
      return 'Initial';
    }
  }

  private buildRedirectMerchantUrl(paymentReference: string): string {
    const merchantReturnUrl = getMerchantReturnUrlFromContext() || config.merchantReturnUrl;
    const redirectUrl = new URL(merchantReturnUrl);

    redirectUrl.searchParams.append('paymentReference', paymentReference);
    return redirectUrl.toString();
  }
}
