import {
  ErrorInvalidOperation,
  PaymentMethod,
  CommercetoolsCartService,
  CommercetoolsPaymentService,
  CommercetoolsPaymentMethodService,
  Cart,
  ErrorResourceNotFound,
} from '@commercetools/connect-payments-sdk';

import { getCartIdFromContext, getMerchantReturnUrlFromContext } from '@lib/fastify/context/context';

import {
  ConfirmStoredPaymentResponseDTO,
  ProcessStoredPaymentRequestDTO,
  ProcessStoredPaymentResponseDTO,
  StoredPaymentMethodsResponseDTO,
} from '@app/dtos/stored-payment-methods.dto';
import { getConfig } from '@app/config/config';
import { CkoInstrument } from '@app/clients/types/instrument.type';
import { getCkoApiClient } from '@app/clients/cko.client';
import { log } from '@lib/logger';
import { GetStoredPaymentMethodsConverter } from './converters/get-stored-payment-methods.converter';
import { CkoStoredPaymentMethodServiceOptions } from './types/cko-payment.type';
import { ProcessStoredPaymentConverter } from './converters/process-stored-payment.converter';
import { CkoPaymentResponse, CkoPaymentStatus } from '@app/clients/types/payment.type';
import { populateInterfaceInteraction } from './helper.service';
import { randomUUID } from 'crypto';

export class CkoStoredPaymentMethodService {
  private readonly ctCartService: CommercetoolsCartService;
  private readonly ctPaymentService: CommercetoolsPaymentService;
  private readonly ctPaymentMethodService: CommercetoolsPaymentMethodService;
  private readonly getStoredPaymentMethodsConverter: GetStoredPaymentMethodsConverter;
  private readonly processStoredPaymentConverter: ProcessStoredPaymentConverter;

  constructor(opts: CkoStoredPaymentMethodServiceOptions) {
    this.ctCartService = opts.ctCartService;
    this.ctPaymentService = opts.ctPaymentService;
    this.ctPaymentMethodService = opts.ctPaymentMethodService;
    this.getStoredPaymentMethodsConverter = new GetStoredPaymentMethodsConverter();
    this.processStoredPaymentConverter = new ProcessStoredPaymentConverter();
  }

  /**
   * Retrieves all stored payment methods for the customer in the current cart context
   *
   * @remarks
   * Returns empty array if stored payment methods are disabled in configuration.
   * Fetches payment methods from commercetools and enriches them with CKO instrument data.
   *
   * @returns Promise with list of stored payment methods
   */
  public async getStoredPaymentMethods(): Promise<StoredPaymentMethodsResponseDTO> {
    if (!getConfig().isStoredPaymentMethodsEnabled()) {
      return {
        storedPaymentMethods: [],
      };
    }

    const cart = await this.getCartFromContext();
    const customerId = this.getCustomerIdFromCart(cart);

    log.info('Fetching stored payment methods', { customerId, cartId: cart.id });

    try {
      const { results: ctPaymentMethods } = await this.ctPaymentMethodService.find({
        customerId,
        paymentInterface: getConfig().getPaymentInterface(),
        interfaceAccount: getConfig().getInterfaceAccount(),
      });

      if (ctPaymentMethods.length === 0) {
        log.info('No stored payment methods found for customer', { customerId });
        return { storedPaymentMethods: [] };
      }

      const ckoInstruments = await this.getCkoPaymentMethods(ctPaymentMethods);

      log.info('Stored payment methods retrieved successfully', {
        customerId,
        count: ctPaymentMethods.length,
        instrumentsCount: ckoInstruments.length,
      });

      return this.getStoredPaymentMethodsConverter.convert({
        ctPaymentMethods,
        ckoInstruments,
      });
    } catch (err) {
      log.error('Unexpected error getting stored payment methods', { err, customerId, cartId: cart.id });
      throw err;
    }
  }

  /**
   * Processes a payment using a stored payment method
   *
   * @remarks
   * Creates a CKO payment using the stored instrument token and updates the
   * commercetools payment with the transaction result.
   *
   * @param id - The stored payment method ID
   * @param opts - The payment processing request data
   * @returns Promise with payment processing response including redirect URL if needed
   */
  public async processStoredPayment(
    id: string,
    opts: { data: ProcessStoredPaymentRequestDTO },
  ): Promise<ProcessStoredPaymentResponseDTO> {
    log.info('Processing stored payment', {
      storedPaymentMethodId: id,
      paymentReference: opts.data.paymentReference,
    });

    const payment = await this.ctPaymentService.getPayment({
      id: opts.data.paymentReference,
    });

    const cart = await this.getCartFromContext();
    const customerId = this.getCustomerIdFromCart(cart);
    const ctPaymentMethod = await this.getStoredPaymentMethod(id, customerId);

    const ckoRequest = this.processStoredPaymentConverter.convertRequest({
      token: ctPaymentMethod.token!.value!,
      cart,
      payment,
      paymentMethod: ctPaymentMethod,
    });

    let ckoResponse: CkoPaymentResponse;
    try {
      ckoResponse = await getCkoApiClient().payments.createPayment(ckoRequest);

      const interfaceInteraction = populateInterfaceInteraction({
        interactionId: randomUUID(),
        type: 'ProcessStoredPayment',
        createdAt: new Date().toISOString(),
        request: JSON.stringify(ckoRequest),
        response: JSON.stringify(ckoResponse),
      });

      const updatedPayment = await this.ctPaymentService.updatePayment({
        id: payment.id,
        pspReference: ckoResponse.id,
        paymentMethodInfo: {
          method: ctPaymentMethod.method,
        },
        transaction: {
          type: 'Authorization',
          amount: payment.amountPlanned,
          interfaceId: ckoResponse.id,
          state: this.convertPaymentStatus(ckoResponse.status),
        },
        pspInteractions: interfaceInteraction,
      });

      const response = this.processStoredPaymentConverter.convertResponse({
        responseData: ckoResponse,
        payment,
      });

      log.info('Stored payment processed successfully.', {
        payment: {
          id: updatedPayment.id,
          version: updatedPayment.version,
        },
        interactionId: ckoResponse.id,
        result: response.status,
      });

      return response;
    } catch (err) {
      log.error('Error processing stored payment with CKO', {
        err,
        ctPaymentMethodId: ctPaymentMethod.id,
        token: ctPaymentMethod.token?.value,
      });
      throw err;
    }
  }

  /**
   * Processes the confirmation of a stored payment
   *
   * @remarks
   * Does not update the payment transaction since CKO payment ID is not available at this point.
   * The payment will be updated via webhook notification.
   *
   * @param opts - Confirmation data including payment reference and success status
   * @returns Promise with payment reference and merchant return URL
   */
  public async confirmStoredPayment(opts: {
    paymentReference: string;
    isSuccess: boolean;
  }): Promise<ConfirmStoredPaymentResponseDTO> {
    const payment = await this.ctPaymentService.getPayment({
      id: opts.paymentReference,
    });

    log.info('Stored payment confirmation received', {
      payment: {
        id: payment.id,
        version: payment.version,
      },
      result: opts.isSuccess ? 'Success' : 'Failure',
    });

    return {
      paymentReference: payment.id,
      merchantReturnUrl: this.buildRedirectMerchantUrl(payment.id),
    };
  }

  /**
   * Deletes a stored payment method from both commercetools and Checkout.com
   *
   * @remarks
   * Deletes the payment method from commercetools first, then attempts to delete
   * the instrument from CKO. If the CKO instrument is not found, the deletion continues
   * without error since the CT payment method is already removed.
   *
   * @param id - The stored payment method ID
   */
  public async deleteStoredPaymentMethod(id: string): Promise<void> {
    log.info('Deleting stored payment method', { storedPaymentMethodId: id });

    const cart = await this.getCartFromContext();
    const customerId = this.getCustomerIdFromCart(cart);
    const ctPaymentMethod = await this.getStoredPaymentMethod(id, customerId);

    await this.deleteCtPaymentMethod(ctPaymentMethod, customerId);
    await this.deleteCkoInstrument(ctPaymentMethod);
  }

  private async deleteCtPaymentMethod(ctPaymentMethod: PaymentMethod, customerId: string): Promise<void> {
    try {
      await this.ctPaymentMethodService.delete({
        id: ctPaymentMethod.id,
        version: ctPaymentMethod.version!,
        customerId,
      });

      log.info('CT stored payment method deleted successfully', {
        ctPaymentMethodId: ctPaymentMethod.id,
        customerId,
      });
    } catch (err) {
      log.error('Error deleting CT stored payment method', {
        err,
        ctPaymentMethodId: ctPaymentMethod.id,
        customerId,
      });
      throw err;
    }
  }

  private async deleteCkoInstrument(ctPaymentMethod: PaymentMethod): Promise<void> {
    const token = ctPaymentMethod.token?.value;

    if (!token) {
      log.info('No token found on payment method, skipping CKO deletion', {
        ctPaymentMethodId: ctPaymentMethod.id,
      });
      return;
    }

    try {
      await getCkoApiClient().instruments.getInstrument(token);
      await getCkoApiClient().instruments.deleteInstrument(token);

      log.info('CKO instrument deleted successfully', {
        ctPaymentMethodId: ctPaymentMethod.id,
        token,
      });
    } catch (err) {
      log.info('CKO instrument not found or error during deletion', {
        err,
        ctPaymentMethodId: ctPaymentMethod.id,
        token,
      });
    }
  }

  /**
   * Fetches CKO instrument details for commercetools payment methods
   *
   * @remarks
   * Filters out payment methods without tokens and silently ignores instruments
   * that fail to fetch, returning only successfully retrieved instruments.
   *
   * @param ctPaymentMethods - List of commercetools payment methods
   * @returns Promise with array of CKO instruments
   */
  private async getCkoPaymentMethods(ctPaymentMethods: PaymentMethod[]): Promise<CkoInstrument[]> {
    const instrumentPromises = ctPaymentMethods
      .filter((pm) => pm.token?.value)
      .map(async (ctPaymentMethod) => {
        try {
          return await getCkoApiClient().instruments.getInstrument(ctPaymentMethod.token!.value);
        } catch (err) {
          log.error('Error fetching CKO instrument', {
            err,
            ctPaymentMethodId: ctPaymentMethod.id,
            token: ctPaymentMethod.token?.value,
          });
          return null;
        }
      });

    const results = await Promise.all(instrumentPromises);

    return results.filter((instrument): instrument is CkoInstrument => instrument !== null);
  }

  /**
   * Retrieves the cart from the current session context
   *
   * @remarks
   * Throws ErrorInvalidOperation if cartId is not found in context or cart cannot be fetched
   *
   * @returns Promise with the cart
   * @throws ErrorInvalidOperation if cart is not available
   */
  private async getCartFromContext(): Promise<Cart> {
    const cartId = getCartIdFromContext();

    if (!cartId) {
      throw new ErrorInvalidOperation('No cart in session context.', {
        privateMessage: 'Cannot get stored payment methods without a cartId in the context.',
      });
    }

    try {
      return this.ctCartService.getCart({
        id: getCartIdFromContext(),
      });
    } catch (err: unknown) {
      log.error('Error fetching cart from context', { err, cartId });
      throw new ErrorInvalidOperation('Error fetching cart from context.', {
        privateMessage: 'Cannot work with stored payment methods without a valid cart.',
        cause: err,
      });
    }
  }

  /**
   * Extracts and validates customer ID from cart
   *
   * @remarks
   * Stored payment methods require a customer ID to be present on the cart
   *
   * @param cart - The cart to extract customer ID from
   * @returns The customer ID
   * @throws ErrorInvalidOperation if cart has no customer ID
   */
  private getCustomerIdFromCart(cart: Cart): string {
    const customerId = cart.customerId;

    if (!customerId) {
      throw new ErrorInvalidOperation('The cart has no customerId set.', {
        privateMessage: 'Cannot work with stored payment methods without a customerId on the cart.',
        privateFields: {
          cart: {
            id: cart.id,
          },
        },
      });
    }

    return customerId;
  }

  /**
   * Fetches a stored payment method and validates it belongs to the customer
   *
   * @remarks
   * Throws ErrorInvalidOperation if payment method is not found or doesn't belong to customer
   *
   * @param paymentMethodId - The payment method ID to retrieve
   * @param customerId - The customer ID to validate ownership
   * @returns Promise with the payment method
   * @throws ErrorInvalidOperation if payment method not found for customer
   */
  private async getStoredPaymentMethod(paymentMethodId: string, customerId: string): Promise<PaymentMethod> {
    try {
      return await this.ctPaymentMethodService.get({
        id: paymentMethodId,
        customerId,
        paymentInterface: getConfig().getPaymentInterface(),
        interfaceAccount: getConfig().getInterfaceAccount(),
      });
    } catch (err) {
      if (err instanceof ErrorResourceNotFound) {
        log.error('Stored payment method not found for customer', { err, paymentMethodId, customerId });
        throw new ErrorInvalidOperation('Stored payment method not found.', {
          privateMessage: 'The stored payment method does not exist for this customer.',
          cause: err,
        });
      }
      log.error('Unexpected error fetching stored payment method', { err, paymentMethodId, customerId });
      throw err;
    }
  }

  /**
   * Builds the redirect URL to return the customer to the merchant site
   *
   * @param paymentReference - The payment ID to append as query parameter
   * @returns Complete URL with payment reference parameter
   */
  private buildRedirectMerchantUrl(paymentReference: string): string {
    const merchantReturnUrl = getMerchantReturnUrlFromContext() || getConfig().merchantReturnUrl;
    const redirectUrl = new URL(merchantReturnUrl);

    redirectUrl.searchParams.append('paymentReference', paymentReference);
    return redirectUrl.toString();
  }

  /**
   * Converts Checkout.com payment status to commercetools transaction state
   *
   * @param status - The CKO payment status
   * @returns Commercetools transaction state (Success, Failure, or Initial)
   */
  private convertPaymentStatus(status: CkoPaymentStatus): string {
    if (status === CkoPaymentStatus.Authorized) {
      return 'Success';
    } else if (status === CkoPaymentStatus.Declined) {
      return 'Failure';
    } else {
      return 'Initial';
    }
  }
}
