import { Cart, Payment, PaymentMethod } from '@commercetools/connect-payments-sdk';
import { getConfig } from '@app/config/config';
import {
  getCtSessionIdFromContext,
  getFutureOrderNumberFromContext,
  getProcessorUrlFromContext,
  getRequestContext,
} from '@lib/fastify/context/context';
import { paymentSDK } from '@app/payment-sdk';
import { ProcessStoredPaymentResponseDTO } from '@app/dtos/stored-payment-methods.dto';
import { CkoPaymentRequest, CkoPaymentResponse } from '@app/clients/types/payment.type';
import { convertAddress, convertCartItems, convertEnableCapture } from './helper.converter';

export class ProcessStoredPaymentConverter {
  public convertRequest(opts: {
    token: string;
    cart: Cart;
    payment: Payment;
    paymentMethod: PaymentMethod;
  }): CkoPaymentRequest {
    const { token, cart, payment, paymentMethod } = opts;
    const locale = 'en-GB';
    const futureOrderNumber = getFutureOrderNumberFromContext();
    const deliveryAddress = paymentSDK.ctCartService.getOneShippingAddress({ cart: opts.cart });
    return {
      processing_channel_id: getConfig().getChannelId(),
      amount: payment.amountPlanned.centAmount,
      currency: payment.amountPlanned.currencyCode,
      source: {
        type: 'id',
        id: token,
      },
      reference: payment.id,
      billing: {
        address: convertAddress(cart.billingAddress!),
      },
      shipping: deliveryAddress ? { address: convertAddress(deliveryAddress) } : undefined,
      ...convertEnableCapture(),
      success_url: this.buildReturnUrl(payment.id, paymentMethod.id, true),
      failure_url: this.buildReturnUrl(payment.id, paymentMethod.id, false),
      payment_type: 'Regular',
      ...(cart.customerEmail && {
        customer: {
          email: cart.customerEmail,
        },
      }),
      '3ds': { enabled: getConfig().getEnableThreeDS() },
      metadata: {
        correlation_id: getRequestContext().correlationId!,
        cart_id: cart.id,
        payment_id: payment.id,
        payment_method_id: paymentMethod.id,
        ...(cart.customerId && { customer_id: cart.customerId }),
        ...(futureOrderNumber && { merchant_order_reference: futureOrderNumber }),
      },
      integration: {
        external_platform: {
          name: 'Commercetools',
          version: '1.0.0',
        },
      },
      items: convertCartItems(cart, payment, locale),
    };
  }

  public convertResponse(opts: {
    responseData: CkoPaymentResponse;
    payment: Payment;
  }): ProcessStoredPaymentResponseDTO {
    return {
      id: opts.responseData.id,
      status: opts.responseData.status,
      paymentReference: opts.payment.id,
      type: opts.responseData.source?.type,
      ...(opts.responseData._links?.redirect?.href && {
        action: {
          ...(opts.responseData.source?.type === 'card' ? { type: '3ds' } : {}),
          url: opts.responseData._links.redirect.href,
        },
      }),
    };
  }

  private buildReturnUrl(paymentReference: string, paymentMethodId: string, isSuccessUrl: boolean): string {
    const url = new URL(`/stored-payment-methods/${paymentMethodId}/payments/confirm`, getProcessorUrlFromContext());
    url.searchParams.append('paymentReference', paymentReference);
    url.searchParams.append('ctsid', getCtSessionIdFromContext());
    url.searchParams.append('success', isSuccessUrl ? 'true' : 'false');
    return url.toString();
  }
}
