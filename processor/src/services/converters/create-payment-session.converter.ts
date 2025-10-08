import { Address, Cart, Payment } from '@commercetools/connect-payments-sdk';
import {
  CkoAddress,
  CkoLineItems,
  PaymentSessionRequest,
  PaymentSessionResponse,
} from '../../clients/types/payment-session.type';
import { config, getConfig } from '../../config/config';
import {
  getAllowedPaymentMethodsFromContext,
  getCtSessionIdFromContext,
  getFutureOrderNumberFromContext,
  getProcessorUrlFromContext,
  getRequestContext,
} from '../../libs/fastify/context/context';
import { paymentSDK } from '../../payment-sdk';
import { PaymentSessionResponseDTO } from '../../dtos/cko-payment.dto';

export class CreatePaymentSessionConverter {
  public convertRequest(opts: { cart: Cart; payment: Payment }): PaymentSessionRequest {
    const { cart, payment } = opts;
    const futureOrderNumber = getFutureOrderNumberFromContext();
    const deliveryAddress = paymentSDK.ctCartService.getOneShippingAddress({ cart: opts.cart });

    return {
      processing_channel_id: getConfig().getChannelId(),
      amount: payment.amountPlanned.centAmount,
      currency: payment.amountPlanned.currencyCode,
      reference: payment.id,
      billing: {
        address: this.convertAddress(cart.billingAddress!),
      },
      shipping: deliveryAddress ? { address: this.convertAddress(deliveryAddress) } : undefined,
      capture: false,
      success_url: this.buildReturnUrl(payment.id, true),
      failure_url: this.buildReturnUrl(payment.id, false),
      payment_type: cart.customerId ? 'Unscheduled' : 'Regular',
      ...(cart.customerId && {
        customer: {
          id: cart.customerId,
          email: cart.customerEmail,
        },
      }),
      '3ds': { enabled: getConfig().getEnableThreeDS() },
      metadata: {
        cart_id: cart.id,
        payment_id: payment.id,
        correlation_id: getRequestContext().correlationId!,
        ...(futureOrderNumber && { merchant_order_reference: futureOrderNumber }),
      },
      integration: {
        external_platform: {
          name: 'Commercetools',
          version: '1.0.0',
        },
      },
      items: this.convertCartItems(cart),
      enabled_payment_methods: getAllowedPaymentMethodsFromContext(),
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

  private convertAddress(address: Address): CkoAddress {
    return {
      country: address.country,
      address_line1: address.streetName,
      address_line2: address.additionalStreetInfo,
      city: address.city,
      state: address.region,
      zip: address.postalCode,
    };
  }

  private convertCartItems(cart: Cart): CkoLineItems[] {
    const items: CkoLineItems[] = [];
    // TODO: take into account gift cards
    const cartTotalPrice = cart.taxedPrice?.totalGross.centAmount || cart.totalPrice.centAmount;
    let totalPrice = 0;

    //TODO: fix this
    cart.lineItems.forEach((i) => {
      const quantity = i.quantity;
      // const unitPrice = (i.taxedPrice?.totalGross.centAmount || i.totalPrice.centAmount) / quantity;
      const unitPrice = cartTotalPrice;
      totalPrice += unitPrice * quantity;
      items.push({
        name: Object.values(i.name)[0],
        quantity,
        unit_price: unitPrice,
      });
    });

    if (totalPrice != cartTotalPrice) {
      items.push({
        name: 'Adjustment',
        quantity: 1,
        unit_price: cartTotalPrice - totalPrice,
      });
    }

    return items;
  }
}
