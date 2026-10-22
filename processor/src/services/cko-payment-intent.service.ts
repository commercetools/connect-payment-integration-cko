import { ErrorInvalidOperation, CommercetoolsPaymentService } from '@commercetools/connect-payments-sdk';
import {
  CancelPaymentRequest,
  CapturePaymentRequest,
  ModifyPayment,
  PaymentProviderModificationResponse,
  RefundPaymentRequest,
  ReversePaymentRequest,
} from './types/operation.type';
import { PaymentModificationStatus } from '@app/dtos/operations/payment-intents.dto';
import { getCkoApiClient } from '@app/clients/cko.client';
import { log } from '@lib/logger';
import { ReversePaymentConverter } from './converters/reverse-payment.converter';
import { CapturePaymentConverter } from './converters/capture-payment.converter';
import { VoidPaymentConverter } from './converters/void-payment.converter';
import { RefundPaymentConverter } from './converters/refund-payment.converter';
import { CkoPaymentIntentServiceOptions } from './types/cko-payment.type';
import { populateInterfaceInteraction } from './helper.service';
import { randomUUID } from 'crypto';

export class CkoPaymentIntentService {
  private readonly voidPaymentConverter: VoidPaymentConverter;
  private readonly reversePaymentConverter: ReversePaymentConverter;
  private readonly capturePaymentConverter: CapturePaymentConverter;
  private readonly refundPaymentConverter: RefundPaymentConverter;
  private readonly ctPaymentService: CommercetoolsPaymentService;

  constructor(opts: CkoPaymentIntentServiceOptions) {
    this.ctPaymentService = opts.ctPaymentService;
    this.voidPaymentConverter = opts.voidPaymentConverter;
    this.reversePaymentConverter = opts.reversePaymentConverter;
    this.capturePaymentConverter = opts.capturePaymentConverter;
    this.refundPaymentConverter = opts.refundPaymentConverter;
  }

  /**
   * Modify payment
   *
   * @remarks
   * Executes Capture/Cancel/Refund/Reverse payment operations in Checkout.com and updates commercetools
   *
   * @param opts - input for payment modification including payment ID, action and payment amount
   * @returns Promise with outcome of payment modification
   */
  public async modifyPayment(opts: ModifyPayment): Promise<PaymentProviderModificationResponse> {
    const ctPayment = await this.ctPaymentService.getPayment({ id: opts.paymentId });
    const request = opts.data.actions[0];

    log.info('Processing payment modification', {
      paymentId: opts.paymentId,
      action: request.action,
      amount: 'amount' in request ? request.amount : undefined,
    });

    switch (request.action) {
      case 'cancelPayment':
        return this.cancelPayment({ payment: ctPayment, merchantReference: request.merchantReference });
      case 'capturePayment':
        return this.capturePayment({
          payment: ctPayment,
          merchantReference: request.merchantReference,
          amount: request.amount,
        });
      case 'refundPayment':
        return this.refundPayment({
          amount: request.amount,
          payment: ctPayment,
          merchantReference: request.merchantReference,
          transactionId: request.transactionId,
        });
      case 'reversePayment':
        return this.reversePayment({ payment: ctPayment, merchantReference: request.merchantReference });
      default:
        throw new ErrorInvalidOperation(`Operation not supported`);
    }
  }

  /**
   * Capture payment
   *
   * @remarks
   * Executes payment capture in Checkout.com and creates a Charge transaction in commercetools
   *
   * @param request - contains the amount and {@link https://docs.commercetools.com/api/projects/payments | Payment }
   * @returns Promise with operation status and PSP reference
   */
  public async capturePayment(request: CapturePaymentRequest): Promise<PaymentProviderModificationResponse> {
    log.info('Processing payment capture.', {
      paymentId: request.payment.id,
    });

    const ckoRequest = this.capturePaymentConverter.convertRequest({ requestData: request });
    const ckoPaymentId = request.payment.interfaceId as string;

    let isSuccess = true;
    let operationId: string | undefined;
    let ckoResponse;
    try {
      ckoResponse = await getCkoApiClient().payments.capturePayment(ckoPaymentId, ckoRequest);
      operationId = ckoResponse.action_id;
    } catch (error) {
      isSuccess = false;
      ckoResponse = error;
      log.error('Error capturing payment', {
        paymentId: request.payment.id,
        result: 'Failure',
        err: error,
      });
    }

    const interfaceInteraction = await populateInterfaceInteraction({
      interactionId: randomUUID(),
      type: 'CapturePayment',
      createdAt: new Date().toISOString(),
      request: ckoRequest,
      response: ckoResponse,
    });

    const updatePayment = await this.ctPaymentService.updatePayment({
      id: request.payment.id,
      transaction: {
        type: 'Charge',
        amount: request.amount,
        interfaceId: operationId,
        state: isSuccess ? 'Success' : 'Failure',
      },
      pspInteractions: interfaceInteraction,
    });

    log.info('Payment capture completed.', {
      payment: {
        id: updatePayment.id,
        version: updatePayment.version,
      },
      interactionId: operationId || 'error',
      result: isSuccess ? 'Success' : 'Failure',
    });

    return {
      outcome: isSuccess ? PaymentModificationStatus.APPROVED : PaymentModificationStatus.REJECTED,
      pspReference: ckoPaymentId,
    };
  }

  /**
   * Cancel payment
   *
   * @remarks
   * Executes payment void in Checkout.com and creates a CancelAuthorization transaction in commercetools
   *
   * @param request - contains {@link https://docs.commercetools.com/api/projects/payments | Payment }
   * @returns Promise with operation status and PSP reference
   */
  public async cancelPayment(request: CancelPaymentRequest): Promise<PaymentProviderModificationResponse> {
    log.info('Processing payment cancellation.', {
      paymentId: request.payment.id,
    });

    const ckoRequest = this.voidPaymentConverter.convertRequest({ requestData: request });
    const ckoPaymentId = request.payment.interfaceId as string;

    let isSuccess = true;
    let operationId: string | undefined;
    let ckoResponse;
    try {
      ckoResponse = await getCkoApiClient().payments.voidPayment(ckoPaymentId, ckoRequest);
      operationId = ckoResponse.action_id;
    } catch (error) {
      isSuccess = false;
      ckoResponse = error;
      log.error('Error cancelling payment', {
        paymentId: request.payment.id,
        result: 'Failure',
        err: error,
      });
    }

    const interfaceInteraction = await populateInterfaceInteraction({
      interactionId: randomUUID(),
      type: 'CancelPayment',
      createdAt: new Date().toISOString(),
      request: ckoRequest,
      response: ckoResponse,
    });
    const updatePayment = await this.ctPaymentService.updatePayment({
      id: request.payment.id,
      transaction: {
        type: 'CancelAuthorization',
        amount: request.payment.amountPlanned,
        interfaceId: operationId,
        state: isSuccess ? 'Success' : 'Failure',
      },
      pspInteractions: interfaceInteraction,
    });

    log.info('Payment cancellation completed.', {
      payment: {
        id: updatePayment.id,
        version: updatePayment.version,
      },
      interactionId: operationId || 'error',
      result: isSuccess ? 'Success' : 'Failure',
    });

    return {
      outcome: isSuccess ? PaymentModificationStatus.APPROVED : PaymentModificationStatus.REJECTED,
      pspReference: ckoPaymentId,
    };
  }

  /**
   * Refund payment
   *
   * @remarks
   * Executes payment refund in Checkout.com and creates a Refund transaction in commercetools
   *
   * @param request - contains amount and {@link https://docs.commercetools.com/api/projects/payments | Payment }
   * @returns Promise with operation status and PSP reference
   */
  public async refundPayment(request: RefundPaymentRequest): Promise<PaymentProviderModificationResponse> {
    log.info('Processing payment refund.', {
      paymentId: request.payment.id,
    });

    const ckoRequest = this.refundPaymentConverter.convertRequest({ requestData: request });
    const ckoPaymentId = request.payment.interfaceId as string;

    let isSuccess = true;
    let operationId: string | undefined;
    let ckoResponse;
    try {
      ckoResponse = await getCkoApiClient().payments.refundPayment(ckoPaymentId, ckoRequest);
      operationId = ckoResponse.action_id;
    } catch (error) {
      isSuccess = false;
      ckoResponse = error;
      log.error('Error refunding payment', {
        paymentId: request.payment.id,
        result: 'Failure',
        err: error,
      });
    }
    const interfaceInteraction = await populateInterfaceInteraction({
      interactionId: randomUUID(),
      type: 'RefundPayment',
      createdAt: new Date().toISOString(),
      request: ckoRequest,
      response: ckoResponse,
    });

    const updatePayment = await this.ctPaymentService.updatePayment({
      id: request.payment.id,
      transaction: {
        type: 'Refund',
        amount: request.amount,
        interfaceId: operationId,
        state: isSuccess ? 'Success' : 'Failure',
      },
      pspInteractions: interfaceInteraction,
    });

    log.info('Payment refund completed.', {
      payment: {
        id: updatePayment.id,
        version: updatePayment.version,
      },
      interactionId: operationId || 'error',
      result: isSuccess ? 'Success' : 'Failure',
    });

    return {
      outcome: isSuccess ? PaymentModificationStatus.APPROVED : PaymentModificationStatus.REJECTED,
      pspReference: ckoPaymentId,
    };
  }

  /**
   * Reverse payment
   *
   * @remarks
   * Executes payment reversal in Checkout.com and creates either a Refund or CancelAuthorization transaction
   * in commercetools depending on whether the payment was charged or only authorized
   *
   * @param request - contains {@link https://docs.commercetools.com/api/projects/payments | Payment }
   * @returns Promise with operation status and PSP reference
   */
  public async reversePayment(request: ReversePaymentRequest): Promise<PaymentProviderModificationResponse> {
    log.info('Processing payment reversal.', {
      paymentId: request.payment.id,
    });

    const hasCharge = this.ctPaymentService.hasTransactionInState({
      payment: request.payment,
      transactionType: 'Charge',
      states: ['Pending', 'Success'],
    });

    const ckoRequest = this.reversePaymentConverter.convertRequest({ requestData: request });
    const ckoPaymentId = request.payment.interfaceId as string;

    let isSuccess = true;
    let operationId: string | undefined;
    let ckoResponse;
    try {
      ckoResponse = await getCkoApiClient().payments.reversePayment(ckoPaymentId, ckoRequest);
      operationId = ckoResponse.action_id;
    } catch (error) {
      isSuccess = false;
      ckoResponse = error;
      log.error('Error reversing payment', {
        paymentId: request.payment.id,
        result: 'Failure',
        err: error,
      });
    }

    const interfaceInteraction = await populateInterfaceInteraction({
      interactionId: randomUUID(),
      type: 'ReversePayment',
      createdAt: new Date().toISOString(),
      request: ckoRequest,
      response: ckoResponse,
    });

    const updatePayment = await this.ctPaymentService.updatePayment({
      id: request.payment.id,
      transaction: {
        type: hasCharge ? 'Refund' : 'CancelAuthorization',
        amount: request.payment.amountPlanned,
        interfaceId: operationId,
        state: isSuccess ? 'Success' : 'Failure',
      },
      pspInteractions: interfaceInteraction,
    });

    log.info('Payment reversal completed.', {
      payment: {
        id: updatePayment.id,
        version: updatePayment.version,
      },
      interactionId: operationId || 'error',
      result: isSuccess ? 'Success' : 'Failure',
    });

    return {
      outcome: isSuccess ? PaymentModificationStatus.APPROVED : PaymentModificationStatus.REJECTED,
      pspReference: ckoPaymentId,
    };
  }
}
