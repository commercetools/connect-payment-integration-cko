import { Address, Cart, LocalizedString, Payment } from '@commercetools/connect-payments-sdk';
import {
  CkoAddress,
  CkoLineItems,
} from '../../clients/types/payment-session.type';
import { getConfig } from '../../config/config';
import {
  getCtSessionIdFromContext,
  getFutureOrderNumberFromContext,
  getProcessorUrlFromContext,
  getRequestContext,
} from '../../libs/fastify/context/context';
import { paymentSDK } from '../../payment-sdk';
import {  PaymentSessionResponseDTO } from '../../dtos/cko-payment.dto';
import { convertAllowedPaymentMethodsToCkoFormat } from '../../helpers/method-name.helper';
import { ProcessStoredPaymentResponseDTO } from '../../dtos/stored-payment-methods.dto';
import { CkoPaymentRequest, CkoPaymentResponse } from '../../clients/types/payment.type';

export class ProcessStoredPaymentConverter {
  public convertRequest(opts: { token: string; cart: Cart; payment: Payment }): CkoPaymentRequest {
    const { token, cart, payment } = opts;
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
        address: this.convertAddress(cart.billingAddress!),
      },
      shipping: deliveryAddress ? { address: this.convertAddress(deliveryAddress) } : undefined,
      ...this.convertEnableCapture(),
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
      items: this.convertCartItems(cart, payment, locale),
      enabled_payment_methods: convertAllowedPaymentMethodsToCkoFormat(),
      payment_method_configuration: {
        stored_card: {
          customer_id: 'cus_qfadfxctfz4ufa3d35rlpkas5e',
          default_instrument_id: 'src_f5mlm42knbou3cftfsjdgfshhy',
          instrument_ids: ['src_f5mlm42knbou3cftfsjdgfshhy'],
        },
      },
    };
  }

  public convertResponse(opts: { responseData: CkoPaymentResponse; payment: Payment }): ProcessStoredPaymentResponseDTO {
    return {
      id: opts.responseData.id,
      status: opts.responseData.status,
      paymentReference: opts.payment.id,
      type: opts.responseData.source?.type,
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
      state: address.state || address.region,
      zip: address.postalCode,
    };
  }

  private convertEnableCapture(): { capture: boolean; capture_on?: string } {
    const { getCaptureDelayHours } = getConfig();
    const captureDelayHours = getCaptureDelayHours();

    // Explicitly handle unset or invalid config values
    if (captureDelayHours == null || isNaN(captureDelayHours)) {
      return { capture: false };
    }

    // Immediate capture
    if (captureDelayHours <= 0) {
      return { capture: true };
    }

    // Delayed capture
    const captureDate = new Date(Date.now() + captureDelayHours * 60 * 60 * 1000);

    return {
      capture: true,
      capture_on: captureDate.toISOString(),
    };
  }

  /**
   * Convert cart items to CKO line items.
   * @param cart The cart object containing line items.
   * @param payment The payment object.
   * @param locale The locale to use for item names.
   * @returns An array of CKO line items.
   */
  private convertCartItems(cart: Cart, payment: Payment, locale: string): CkoLineItems[] {
    // Remaining amount to pay. This has discounted other payments (ie. gift cards)
    // Also it has included the shipping cost which will be distributed across the line items
    const amountPlanned = payment.amountPlanned.centAmount;

    const lineItems = this.buildLineItems(cart, locale);
    const customItems = this.buildCustomLineItems(cart, locale);

    const allItems = [...lineItems, ...customItems];
    const totalItems = this.sumUnitPrices(allItems);
    const discount = totalItems - amountPlanned;

    if (discount <= 0) return allItems;

    return this.applyDistributedDiscount(allItems, discount);
  }

  private buildLineItems(cart: Cart, locale: string): CkoLineItems[] {
    return cart.lineItems.map((li) =>
      this.buildItem(
        this.getItemName(li.name, li.id, locale),
        li.taxedPrice?.totalGross.centAmount ?? li.totalPrice.centAmount,
      ),
    );
  }

  private buildCustomLineItems(cart: Cart, locale: string): CkoLineItems[] {
    return cart.customLineItems.map((cli) =>
      this.buildItem(
        this.getItemName(cli.name, cli.id, locale),
        cli.taxedPrice?.totalGross.centAmount ?? cli.totalPrice.centAmount,
      ),
    );
  }

  private getItemName(name: LocalizedString, id: string, locale: string): string {
    const preferredLocales = [locale, 'en-GB', 'en-US'];

    for (const loc of preferredLocales) {
      if (name[loc]) {
        return name[loc];
      }
    }

    return `Item ${id}`;
  }

  private buildItem(name: string, unitPrice: number): CkoLineItems {
    /**
     * IMPORTANT: quantity is always one in order to miss cents and avoid errors since
     * cko validates that payment amount matches the sum of all items amount
     */
    return {
      name,
      quantity: 1,
      unit_price: unitPrice,
      total_amount: unitPrice,
    };
  }

  private sumUnitPrices(items: CkoLineItems[]): number {
    return items.reduce((sum, i) => sum + i.unit_price, 0);
  }

  /**
   * Apply a distributed discount to the items. The discount is applied in a way that no item's unit price goes below 1.
   * @param items List of line items to apply the discount to.
   * @param initialDiscount The initial discount amount to distribute.
   * @returns The updated list of line items with the applied discount.
   */
  private applyDistributedDiscount(items: CkoLineItems[], initialDiscount: number): CkoLineItems[] {
    if (initialDiscount <= 0) return items;

    const adjustedItems = items.map((i) => ({ ...i }));
    let remaining = initialDiscount;

    while (remaining > 0) {
      const eligible = this.getEligibleDiscountItems(adjustedItems);
      if (!eligible.length) break;

      const perItem = Math.floor(remaining / eligible.length);
      if (perItem > 0) {
        remaining = this.applyBulkDiscount(eligible, remaining, perItem);
      } else {
        remaining = this.applyResidualDiscount(eligible, remaining);
      }
    }

    return adjustedItems;
  }

  /**
   * Get eligible discount items from the list. An item is eligible if its unit price is greater than 1.
   * @param items List of line items to filter.
   * @returns List of eligible line items for discount.
   */
  private getEligibleDiscountItems(items: CkoLineItems[]): CkoLineItems[] {
    return items.filter((i) => i.unit_price > 1);
  }

  /**
   * Apply a bulk discount to the eligible items. The discount is applied evenly across all eligible items,
   * @param eligible List of eligible line items for discount.
   * @param remaining The remaining discount amount to distribute.
   * @param perItem The amount to deduct from each eligible item.
   * @returns The updated remaining discount amount.
   */
  private applyBulkDiscount(eligible: CkoLineItems[], remaining: number, perItem: number): number {
    for (const it of eligible) {
      if (remaining === 0) break;

      const capacity = it.unit_price - 1;
      if (capacity <= 0) continue;

      const apply = Math.min(perItem, capacity, remaining);
      it.unit_price -= apply;
      it.total_amount = it.unit_price;
      remaining -= apply;
    }
    return remaining;
  }

  /**
   * Apply a residual discount to the eligible items. The discount is applied one unit at a time.
   * @param eligible List of eligible line items for discount.
   * @param remaining The remaining discount amount to distribute.
   * @returns The updated remaining discount amount.
   */
  private applyResidualDiscount(eligible: CkoLineItems[], remaining: number): number {
    for (const it of eligible) {
      if (remaining === 0) break;
      if (it.unit_price > 1) {
        it.unit_price -= 1;
        it.total_amount = it.unit_price;
        remaining -= 1;
      }
    }
    return remaining;
  }
}
