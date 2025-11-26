import { Cart, Payment } from '@commercetools/connect-payments-sdk';
import { PaymentSessionRequest, PaymentSessionResponse } from '@app/clients/types/payment-session.type';
import { getConfig } from '@app/config/config';
import {
  getCtSessionIdFromContext,
  getFutureOrderNumberFromContext,
  getProcessorUrlFromContext,
  getRequestContext,
} from '@lib/fastify/context/context';
import { paymentSDK } from '@app/payment-sdk';
import { PaymentSessionRequestDTO, PaymentSessionResponseDTO } from '@app/dtos/cko-payment.dto';
import { convertAllowedPaymentMethodsToCkoFormat } from '@app/helpers/method-name.helper';
import { convertAddress, convertCartItems, convertEnableCapture } from './helper.converter';

export class CreatePaymentSessionConverter {
  public convertRequest(opts: { data: PaymentSessionRequestDTO; cart: Cart; payment: Payment }): PaymentSessionRequest {
    const { cart, payment } = opts;
    const futureOrderNumber = getFutureOrderNumberFromContext();
    const deliveryAddress = paymentSDK.ctCartService.getOneShippingAddress({ cart: opts.cart });
    const locale = opts.data.locale || 'en-GB';
    return {
      processing_channel_id: getConfig().getChannelId(),
      amount: payment.amountPlanned.centAmount,
      currency: payment.amountPlanned.currencyCode,
      reference: payment.id,
      locale,
      billing: {
        address: convertAddress(cart.billingAddress!),
      },
      shipping: deliveryAddress ? { address: convertAddress(deliveryAddress) } : undefined,
      ...convertEnableCapture(),
      success_url: this.buildReturnUrl(payment.id, true),
      failure_url: this.buildReturnUrl(payment.id, false),
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
      enabled_payment_methods: convertAllowedPaymentMethodsToCkoFormat(),
    };
  }

  public convertResponse(opts: { responseData: PaymentSessionResponse; payment: Payment }): PaymentSessionResponseDTO {
    return {
      ...opts.responseData,
      paymentReference: opts.payment.id,
    };
  }

  private buildReturnUrl(paymentReference: string, isSuccessUrl: boolean): string {
    const url = new URL('/payment-sessions/confirm', getProcessorUrlFromContext());
    url.searchParams.append('paymentReference', paymentReference);
    url.searchParams.append('ctsid', getCtSessionIdFromContext());
    url.searchParams.append('success', isSuccessUrl ? 'true' : 'false');
    return url.toString();
  }
}
