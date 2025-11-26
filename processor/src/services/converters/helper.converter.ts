import { getConfig } from '@app/config/config';
import { CkoAddress, CkoLineItems } from '@app/clients/types/payment-session.type';
import { Address, Cart, LocalizedString, Payment } from '@commercetools/connect-payments-sdk';

export const ckoCardBrandMap = new Map<string, string>([
  ['Amex', 'American Express'],
  ['Bancontact', 'Bancontact'],
  ['CartesBancaires', 'Cartes Bancaires'],
  ['Diners', 'Diners Club'],
  ['Discover', 'Discover'],
  ['EftposAu', 'Eftpos AU'],
  ['Jcb', 'JCB'],
  ['Link', 'Link'],
  ['Maestro', 'Maestro'],
  ['Mastercard', 'Mastercard'],
  ['UnionPay', 'UnionPay'],
  ['VISA', 'Visa'],
  ['Unknown', 'Unknown'],
]);

/**
 * Converts a CKO card brand identifier to a human-readable format
 *
 * @param brand - The CKO card brand identifier (e.g., 'VISA', 'Amex')
 * @returns Human-readable card brand name (e.g., 'Visa', 'American Express')
 */
export const convertCardBrand = (brand?: string): string => {
  if (brand) {
    return ckoCardBrandMap.get(brand) || brand;
  } else {
    return 'Unknown';
  }
};

/**
 * Converts a commercetools address to CKO address format
 *
 * @remarks
 * Maps commercetools address fields to Checkout.com API format.
 * Uses state if available, otherwise falls back to region.
 *
 * @param address - The commercetools address object
 * @returns CKO formatted address object
 */
export const convertAddress = (address: Address): CkoAddress => {
  return {
    country: address.country,
    address_line1: address.streetName,
    address_line2: address.additionalStreetInfo,
    city: address.city,
    state: address.state || address.region,
    zip: address.postalCode,
  };
};

/**
 * Determines capture configuration based on delay hours setting
 *
 * @remarks
 * - If captureDelayHours is null, undefined, or NaN: returns { capture: false } (manual capture)
 * - If captureDelayHours <= 0: returns { capture: true } (immediate capture)
 * - If captureDelayHours > 0: returns { capture: true, capture_on: ISO timestamp } (delayed capture)
 *
 * @returns Capture configuration object for CKO payment request
 */
export const convertEnableCapture = (): { capture: boolean; capture_on?: string } => {
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
};

/**
 * Convert cart items to CKO line items.
 * @param cart The cart object containing line items.
 * @param payment The payment object.
 * @param locale The locale to use for item names.
 * @returns An array of CKO line items.
 */
export const convertCartItems = (cart: Cart, payment: Payment, locale: string): CkoLineItems[] => {
  // Remaining amount to pay. This has discounted other payments (ie. gift cards)
  // Also it has included the shipping cost which will be distributed across the line items
  const amountPlanned = payment.amountPlanned.centAmount;

  const lineItems = buildLineItems(cart, locale);
  const customItems = buildCustomLineItems(cart, locale);

  const allItems = [...lineItems, ...customItems];
  const totalItems = sumUnitPrices(allItems);
  const discount = totalItems - amountPlanned;

  if (discount <= 0) return allItems;

  return applyDistributedDiscount(allItems, discount);
};

const buildLineItems = (cart: Cart, locale: string): CkoLineItems[] => {
  return cart.lineItems.map((li) =>
    buildItem(getItemName(li.name, li.id, locale), li.taxedPrice?.totalGross.centAmount ?? li.totalPrice.centAmount),
  );
};

const buildCustomLineItems = (cart: Cart, locale: string): CkoLineItems[] => {
  return cart.customLineItems.map((cli) =>
    buildItem(
      getItemName(cli.name, cli.id, locale),
      cli.taxedPrice?.totalGross.centAmount ?? cli.totalPrice.centAmount,
    ),
  );
};

const getItemName = (name: LocalizedString, id: string, locale: string): string => {
  const preferredLocales = [locale, 'en-GB', 'en-US'];

  for (const loc of preferredLocales) {
    if (name[loc]) {
      return name[loc];
    }
  }

  return `Item ${id}`;
};

const buildItem = (name: string, unitPrice: number): CkoLineItems => {
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
};

const sumUnitPrices = (items: CkoLineItems[]): number => {
  return items.reduce((sum, i) => sum + i.unit_price, 0);
};

/**
 * Apply a distributed discount to the items. The discount is applied in a way that no item's unit price goes below 1.
 * @param items List of line items to apply the discount to.
 * @param initialDiscount The initial discount amount to distribute.
 * @returns The updated list of line items with the applied discount.
 */
const applyDistributedDiscount = (items: CkoLineItems[], initialDiscount: number): CkoLineItems[] => {
  if (initialDiscount <= 0) return items;

  const adjustedItems = items.map((i) => ({ ...i }));
  let remaining = initialDiscount;

  while (remaining > 0) {
    const eligible = getEligibleDiscountItems(adjustedItems);
    if (!eligible.length) break;

    const perItem = Math.floor(remaining / eligible.length);
    if (perItem > 0) {
      remaining = applyBulkDiscount(eligible, remaining, perItem);
    } else {
      remaining = applyResidualDiscount(eligible, remaining);
    }
  }

  return adjustedItems;
};

/**
 * Get eligible discount items from the list. An item is eligible if its unit price is greater than 1.
 * @param items List of line items to filter.
 * @returns List of eligible line items for discount.
 */
const getEligibleDiscountItems = (items: CkoLineItems[]): CkoLineItems[] => {
  return items.filter((i) => i.unit_price > 1);
};

/**
 * Apply a bulk discount to the eligible items. The discount is applied evenly across all eligible items,
 * @param eligible List of eligible line items for discount.
 * @param remaining The remaining discount amount to distribute.
 * @param perItem The amount to deduct from each eligible item.
 * @returns The updated remaining discount amount.
 */
const applyBulkDiscount = (eligible: CkoLineItems[], remaining: number, perItem: number): number => {
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
};

/**
 * Apply a residual discount to the eligible items. The discount is applied one unit at a time.
 * @param eligible List of eligible line items for discount.
 * @param remaining The remaining discount amount to distribute.
 * @returns The updated remaining discount amount.
 */
const applyResidualDiscount = (eligible: CkoLineItems[], remaining: number): number => {
  for (const it of eligible) {
    if (remaining === 0) break;
    if (it.unit_price > 1) {
      it.unit_price -= 1;
      it.total_amount = it.unit_price;
      remaining -= 1;
    }
  }
  return remaining;
};
