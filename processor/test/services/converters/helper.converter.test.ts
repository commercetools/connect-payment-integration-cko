import {
  convertCardBrand,
  convertAddress,
  convertEnableCapture,
  convertCartItems,
} from '../../../src/services/converters/helper.converter';
import { Address, Cart, Payment } from '@commercetools/connect-payments-sdk';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { getConfig } from '../../../src/config/config';

jest.mock('../../../src/config/config');

const mockGetConfig = jest.mocked(getConfig);

describe('helper.converter', () => {
  describe('convertCardBrand', () => {
    test('should convert VISA to Visa', () => {
      expect(convertCardBrand('VISA')).toBe('Visa');
    });

    test('should convert Amex to American Express', () => {
      expect(convertCardBrand('Amex')).toBe('American Express');
    });

    test('should convert Mastercard to Mastercard', () => {
      expect(convertCardBrand('Mastercard')).toBe('Mastercard');
    });

    test('should convert Maestro to Maestro', () => {
      expect(convertCardBrand('Maestro')).toBe('Maestro');
    });

    test('should convert Diners to Diners Club', () => {
      expect(convertCardBrand('Diners')).toBe('Diners Club');
    });

    test('should convert Discover to Discover', () => {
      expect(convertCardBrand('Discover')).toBe('Discover');
    });

    test('should convert Jcb to JCB', () => {
      expect(convertCardBrand('Jcb')).toBe('JCB');
    });

    test('should convert Bancontact to Bancontact', () => {
      expect(convertCardBrand('Bancontact')).toBe('Bancontact');
    });

    test('should convert CartesBancaires to Cartes Bancaires', () => {
      expect(convertCardBrand('CartesBancaires')).toBe('Cartes Bancaires');
    });

    test('should convert EftposAu to Eftpos AU', () => {
      expect(convertCardBrand('EftposAu')).toBe('Eftpos AU');
    });

    test('should convert Link to Link', () => {
      expect(convertCardBrand('Link')).toBe('Link');
    });

    test('should convert UnionPay to UnionPay', () => {
      expect(convertCardBrand('UnionPay')).toBe('UnionPay');
    });

    test('should return Unknown for unmapped brand', () => {
      expect(convertCardBrand('SomeUnknownCard')).toBe('SomeUnknownCard');
    });

    test('should return Unknown when brand is undefined', () => {
      expect(convertCardBrand(undefined)).toBe('Unknown');
    });

    test('should return Unknown when brand is null', () => {
      expect(convertCardBrand(null as unknown as string)).toBe('Unknown');
    });

    test('should return Unknown when brand is empty string', () => {
      expect(convertCardBrand('')).toBe('Unknown');
    });
  });

  describe('convertAddress', () => {
    test('should convert complete address with all fields', () => {
      const address: Address = {
        country: 'US',
        streetName: '123 Main St',
        additionalStreetInfo: 'Apt 4B',
        city: 'New York',
        state: 'NY',
        region: 'Northeast',
        postalCode: '10001',
      };

      const result = convertAddress(address);

      expect(result).toEqual({
        country: 'US',
        address_line1: '123 Main St',
        address_line2: 'Apt 4B',
        city: 'New York',
        state: 'NY',
        zip: '10001',
      });
    });

    test('should use region when state is not provided', () => {
      const address: Address = {
        country: 'GB',
        streetName: '10 Downing Street',
        city: 'London',
        region: 'Greater London',
        postalCode: 'SW1A 2AA',
      };

      const result = convertAddress(address);

      expect(result).toEqual({
        country: 'GB',
        address_line1: '10 Downing Street',
        address_line2: undefined,
        city: 'London',
        state: 'Greater London',
        zip: 'SW1A 2AA',
      });
    });

    test('should prioritize state over region when both provided', () => {
      const address: Address = {
        country: 'US',
        streetName: 'Main St',
        city: 'Springfield',
        state: 'IL',
        region: 'Midwest',
        postalCode: '62701',
      };

      const result = convertAddress(address);

      expect(result.state).toBe('IL');
    });

    test('should handle minimal address with only required fields', () => {
      const address: Address = {
        country: 'FR',
      };

      const result = convertAddress(address);

      expect(result).toEqual({
        country: 'FR',
        address_line1: undefined,
        address_line2: undefined,
        city: undefined,
        state: undefined,
        zip: undefined,
      });
    });

    test('should handle address without additionalStreetInfo', () => {
      const address: Address = {
        country: 'DE',
        streetName: 'Hauptstraße 1',
        city: 'Berlin',
        postalCode: '10115',
      };

      const result = convertAddress(address);

      expect(result.address_line2).toBeUndefined();
    });

    test('should handle address without state or region', () => {
      const address: Address = {
        country: 'JP',
        streetName: '1-1-1 Chiyoda',
        city: 'Tokyo',
        postalCode: '100-0001',
      };

      const result = convertAddress(address);

      expect(result.state).toBeUndefined();
    });
  });

  describe('convertEnableCapture', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should return { capture: false } when captureDelayHours is null', () => {
      mockGetConfig.mockReturnValue({
        getCaptureDelayHours: () => null,
      } as unknown as ReturnType<typeof getConfig>);

      const result = convertEnableCapture();

      expect(result).toEqual({ capture: false });
    });

    test('should return { capture: false } when captureDelayHours is undefined', () => {
      mockGetConfig.mockReturnValue({
        getCaptureDelayHours: () => undefined,
      } as unknown as ReturnType<typeof getConfig>);

      const result = convertEnableCapture();

      expect(result).toEqual({ capture: false });
    });

    test('should return { capture: false } when captureDelayHours is NaN', () => {
      mockGetConfig.mockReturnValue({
        getCaptureDelayHours: () => NaN,
      } as unknown as ReturnType<typeof getConfig>);

      const result = convertEnableCapture();

      expect(result).toEqual({ capture: false });
    });

    test('should return { capture: true } for immediate capture when captureDelayHours is 0', () => {
      mockGetConfig.mockReturnValue({
        getCaptureDelayHours: () => 0,
      } as unknown as ReturnType<typeof getConfig>);

      const result = convertEnableCapture();

      expect(result).toEqual({ capture: true });
    });

    test('should return { capture: true } for immediate capture when captureDelayHours is negative', () => {
      mockGetConfig.mockReturnValue({
        getCaptureDelayHours: () => -5,
      } as unknown as ReturnType<typeof getConfig>);

      const result = convertEnableCapture();

      expect(result).toEqual({ capture: true });
    });

    test('should return delayed capture with timestamp when captureDelayHours is positive', () => {
      const mockDate = new Date('2024-01-15T10:00:00.000Z');
      jest.spyOn(global.Date, 'now').mockReturnValue(mockDate.getTime());

      mockGetConfig.mockReturnValue({
        getCaptureDelayHours: () => 24,
      } as unknown as ReturnType<typeof getConfig>);

      const result = convertEnableCapture();

      expect(result.capture).toBe(true);
      expect(result.capture_on).toBeDefined();
      expect(new Date(result.capture_on!).getTime()).toBe(mockDate.getTime() + 24 * 60 * 60 * 1000);
    });

    test('should calculate correct delayed capture for 1 hour', () => {
      const mockDate = new Date('2024-01-15T12:00:00.000Z');
      jest.spyOn(global.Date, 'now').mockReturnValue(mockDate.getTime());

      mockGetConfig.mockReturnValue({
        getCaptureDelayHours: () => 1,
      } as unknown as ReturnType<typeof getConfig>);

      const result = convertEnableCapture();

      expect(result.capture).toBe(true);
      expect(result.capture_on).toBe('2024-01-15T13:00:00.000Z');
    });

    test('should calculate correct delayed capture for 168 hours (7 days)', () => {
      const mockDate = new Date('2024-01-01T00:00:00.000Z');
      jest.spyOn(global.Date, 'now').mockReturnValue(mockDate.getTime());

      mockGetConfig.mockReturnValue({
        getCaptureDelayHours: () => 168,
      } as unknown as ReturnType<typeof getConfig>);

      const result = convertEnableCapture();

      expect(result.capture).toBe(true);
      expect(result.capture_on).toBe('2024-01-08T00:00:00.000Z');
    });

    test('should return ISO string format for capture_on', () => {
      mockGetConfig.mockReturnValue({
        getCaptureDelayHours: () => 12,
      } as unknown as ReturnType<typeof getConfig>);

      const result = convertEnableCapture();

      expect(result.capture_on).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('convertCartItems', () => {
    const mockCart: Cart = {
      id: 'cart-123',
      version: 1,
      lineItems: [
        {
          id: 'line-1',
          name: {
            'en-GB': 'Product 1',
            'en-US': 'Product 1 US',
          },
          totalPrice: {
            centAmount: 10000,
            currencyCode: 'USD',
            fractionDigits: 2,
          },
          quantity: 1,
        } as unknown as Cart['lineItems'][0],
        {
          id: 'line-2',
          name: {
            'en-GB': 'Product 2',
          },
          totalPrice: {
            centAmount: 5000,
            currencyCode: 'USD',
            fractionDigits: 2,
          },
          quantity: 1,
        } as unknown as Cart['lineItems'][0],
      ],
      customLineItems: [],
    } as unknown as Cart;

    const mockPayment: Payment = {
      id: 'payment-123',
      version: 1,
      amountPlanned: {
        centAmount: 15000,
        currencyCode: 'USD',
        fractionDigits: 2,
      },
    } as unknown as Payment;

    test('should convert cart line items to CKO format', () => {
      const result = convertCartItems(mockCart, mockPayment, 'en-GB');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        name: 'Product 1',
        quantity: 1,
        unit_price: 10000,
        total_amount: 10000,
      });
      expect(result[1]).toEqual({
        name: 'Product 2',
        quantity: 1,
        unit_price: 5000,
        total_amount: 5000,
      });
    });

    test('should use fallback locale when preferred locale not available', () => {
      const result = convertCartItems(mockCart, mockPayment, 'fr-FR');

      expect(result[0].name).toBe('Product 1');
      expect(result[1].name).toBe('Product 2');
    });

    test('should use en-US fallback when en-GB not available', () => {
      const cart: Cart = {
        ...mockCart,
        lineItems: [
          {
            id: 'line-1',
            name: {
              'en-US': 'US Product',
              'de-DE': 'Deutsches Produkt',
            },
            totalPrice: {
              centAmount: 10000,
              currencyCode: 'USD',
              fractionDigits: 2,
            },
          } as unknown as Cart['lineItems'][0],
        ],
      } as unknown as Cart;

      const result = convertCartItems(cart, mockPayment, 'fr-FR');

      expect(result[0].name).toBe('US Product');
    });

    test('should use Item ID fallback when no locale matches', () => {
      const cart: Cart = {
        ...mockCart,
        lineItems: [
          {
            id: 'line-xyz',
            name: {
              'de-DE': 'Deutsches Produkt',
            },
            totalPrice: {
              centAmount: 10000,
              currencyCode: 'USD',
              fractionDigits: 2,
            },
          } as unknown as Cart['lineItems'][0],
        ],
      } as unknown as Cart;

      const result = convertCartItems(cart, mockPayment, 'fr-FR');

      expect(result[0].name).toBe('Item line-xyz');
    });

    test('should include custom line items', () => {
      const cart: Cart = {
        ...mockCart,
        customLineItems: [
          {
            id: 'custom-1',
            name: {
              'en-GB': 'Custom Item',
            },
            totalPrice: {
              centAmount: 2000,
              currencyCode: 'USD',
              fractionDigits: 2,
            },
          } as unknown as Cart['lineItems'][0],
        ],
      } as unknown as Cart;

      const payment: Payment = {
        ...mockPayment,
        amountPlanned: {
          centAmount: 17000,
          currencyCode: 'USD',
          fractionDigits: 2,
        },
      } as unknown as Payment;

      const result = convertCartItems(cart, payment, 'en-GB');

      expect(result).toHaveLength(3);
      expect(result[2]).toEqual({
        name: 'Custom Item',
        quantity: 1,
        unit_price: 2000,
        total_amount: 2000,
      });
    });

    test('should use taxedPrice when available', () => {
      const cart: Cart = {
        ...mockCart,
        lineItems: [
          {
            id: 'line-1',
            name: { 'en-GB': 'Product 1' },
            totalPrice: {
              centAmount: 10000,
              currencyCode: 'USD',
              fractionDigits: 2,
            },
            taxedPrice: {
              totalGross: {
                centAmount: 12000,
                currencyCode: 'USD',
                fractionDigits: 2,
              },
            },
          } as unknown as Cart['lineItems'][0],
        ],
      } as unknown as Cart;

      const payment: Payment = {
        ...mockPayment,
        amountPlanned: {
          centAmount: 12000,
          currencyCode: 'USD',
          fractionDigits: 2,
        },
      } as unknown as Payment;

      const result = convertCartItems(cart, payment, 'en-GB');

      expect(result[0].unit_price).toBe(12000);
      expect(result[0].total_amount).toBe(12000);
    });

    test('should apply distributed discount when payment amount is less than total items', () => {
      const cart: Cart = {
        ...mockCart,
        lineItems: [
          {
            id: 'line-1',
            name: { 'en-GB': 'Product 1' },
            totalPrice: {
              centAmount: 10000,
              currencyCode: 'USD',
              fractionDigits: 2,
            },
          } as unknown as Cart['lineItems'][0],
          {
            id: 'line-2',
            name: { 'en-GB': 'Product 2' },
            totalPrice: {
              centAmount: 5000,
              currencyCode: 'USD',
              fractionDigits: 2,
            },
          } as unknown as Cart['lineItems'][0],
        ],
      } as unknown as Cart;

      const payment: Payment = {
        ...mockPayment,
        amountPlanned: {
          centAmount: 12000, // 3000 discount
          currencyCode: 'USD',
          fractionDigits: 2,
        },
      } as unknown as Payment;

      const result = convertCartItems(cart, payment, 'en-GB');

      const totalAfterDiscount = result.reduce((sum, item) => sum + item.unit_price, 0);
      expect(totalAfterDiscount).toBe(12000);
    });

    test('should not reduce item price below 1', () => {
      const cart: Cart = {
        ...mockCart,
        lineItems: [
          {
            id: 'line-1',
            name: { 'en-GB': 'Product 1' },
            totalPrice: {
              centAmount: 100,
              currencyCode: 'USD',
              fractionDigits: 2,
            },
          } as unknown as Cart['lineItems'][0],
        ],
      } as unknown as Cart;

      const payment: Payment = {
        ...mockPayment,
        amountPlanned: {
          centAmount: 1, // Huge discount
          currencyCode: 'USD',
          fractionDigits: 2,
        },
      } as unknown as Payment;

      const result = convertCartItems(cart, payment, 'en-GB');

      expect(result[0].unit_price).toBeGreaterThanOrEqual(1);
    });

    test('should distribute discount evenly across multiple items', () => {
      const cart: Cart = {
        ...mockCart,
        lineItems: [
          {
            id: 'line-1',
            name: { 'en-GB': 'Product 1' },
            totalPrice: {
              centAmount: 10000,
              currencyCode: 'USD',
              fractionDigits: 2,
            },
          } as unknown as Cart['lineItems'][0],
          {
            id: 'line-2',
            name: { 'en-GB': 'Product 2' },
            totalPrice: {
              centAmount: 10000,
              currencyCode: 'USD',
              fractionDigits: 2,
            },
          } as unknown as Cart['lineItems'][0],
        ],
      } as unknown as Cart;

      const payment: Payment = {
        ...mockPayment,
        amountPlanned: {
          centAmount: 18000, // 2000 discount
          currencyCode: 'USD',
          fractionDigits: 2,
        },
      } as unknown as Payment;

      const result = convertCartItems(cart, payment, 'en-GB');

      expect(result[0].unit_price).toBe(9000);
      expect(result[1].unit_price).toBe(9000);
    });

    test('should handle empty line items', () => {
      const cart: Cart = {
        ...mockCart,
        lineItems: [],
        customLineItems: [],
      } as unknown as Cart;

      const payment: Payment = {
        ...mockPayment,
        amountPlanned: {
          centAmount: 0,
          currencyCode: 'USD',
          fractionDigits: 2,
        },
      } as unknown as Payment;

      const result = convertCartItems(cart, payment, 'en-GB');

      expect(result).toEqual([]);
    });

    test('should handle zero amount payment', () => {
      const payment: Payment = {
        ...mockPayment,
        amountPlanned: {
          centAmount: 0,
          currencyCode: 'USD',
          fractionDigits: 2,
        },
      } as unknown as Payment;

      const result = convertCartItems(mockCart, payment, 'en-GB');

      // Should apply maximum discount, but not below 1 per item
      result.forEach((item) => {
        expect(item.unit_price).toBeGreaterThanOrEqual(1);
      });
    });

    test('should always set quantity to 1', () => {
      const result = convertCartItems(mockCart, mockPayment, 'en-GB');

      result.forEach((item) => {
        expect(item.quantity).toBe(1);
      });
    });

    test('should set total_amount equal to unit_price', () => {
      const result = convertCartItems(mockCart, mockPayment, 'en-GB');

      result.forEach((item) => {
        expect(item.total_amount).toBe(item.unit_price);
      });
    });

    test('should apply residual discount when per-item discount is less than 1', () => {
      const cart: Cart = {
        ...mockCart,
        lineItems: [
          {
            id: 'line-1',
            name: { 'en-GB': 'Product 1' },
            totalPrice: {
              centAmount: 1000,
              currencyCode: 'USD',
              fractionDigits: 2,
            },
          } as unknown as Cart['lineItems'][0],
          {
            id: 'line-2',
            name: { 'en-GB': 'Product 2' },
            totalPrice: {
              centAmount: 1000,
              currencyCode: 'USD',
              fractionDigits: 2,
            },
          } as unknown as Cart['lineItems'][0],
          {
            id: 'line-3',
            name: { 'en-GB': 'Product 3' },
            totalPrice: {
              centAmount: 1000,
              currencyCode: 'USD',
              fractionDigits: 2,
            },
          } as unknown as Cart['lineItems'][0],
        ],
      } as unknown as Cart;

      const payment: Payment = {
        ...mockPayment,
        amountPlanned: {
          centAmount: 2998, // Discount of 2 (less than 1 per item)
          currencyCode: 'USD',
          fractionDigits: 2,
        },
      } as unknown as Payment;

      const result = convertCartItems(cart, payment, 'en-GB');

      // Should apply residual discount: -1 to first two items
      const totalAfterDiscount = result.reduce((sum, item) => sum + item.unit_price, 0);
      expect(totalAfterDiscount).toBe(2998);
      expect(result.filter((item) => item.unit_price === 999)).toHaveLength(2);
      expect(result.filter((item) => item.unit_price === 1000)).toHaveLength(1);
    });

    test('should apply residual discount one cent at a time when remaining is small', () => {
      const cart: Cart = {
        ...mockCart,
        lineItems: [
          {
            id: 'line-1',
            name: { 'en-GB': 'Product 1' },
            totalPrice: {
              centAmount: 500,
              currencyCode: 'USD',
              fractionDigits: 2,
            },
          } as unknown as Cart['lineItems'][0],
          {
            id: 'line-2',
            name: { 'en-GB': 'Product 2' },
            totalPrice: {
              centAmount: 500,
              currencyCode: 'USD',
              fractionDigits: 2,
            },
          } as unknown as Cart['lineItems'][0],
        ],
      } as unknown as Cart;

      const payment: Payment = {
        ...mockPayment,
        amountPlanned: {
          centAmount: 997, // Discount of 3 cents
          currencyCode: 'USD',
          fractionDigits: 2,
        },
      } as unknown as Payment;

      const result = convertCartItems(cart, payment, 'en-GB');

      const totalAfterDiscount = result.reduce((sum, item) => sum + item.unit_price, 0);
      expect(totalAfterDiscount).toBe(997);
    });

    test('should stop residual discount when remaining reaches zero', () => {
      const cart: Cart = {
        ...mockCart,
        lineItems: [
          {
            id: 'line-1',
            name: { 'en-GB': 'Product 1' },
            totalPrice: {
              centAmount: 100,
              currencyCode: 'USD',
              fractionDigits: 2,
            },
          } as unknown as Cart['lineItems'][0],
          {
            id: 'line-2',
            name: { 'en-GB': 'Product 2' },
            totalPrice: {
              centAmount: 100,
              currencyCode: 'USD',
              fractionDigits: 2,
            },
          } as unknown as Cart['lineItems'][0],
          {
            id: 'line-3',
            name: { 'en-GB': 'Product 3' },
            totalPrice: {
              centAmount: 100,
              currencyCode: 'USD',
              fractionDigits: 2,
            },
          } as unknown as Cart['lineItems'][0],
        ],
      } as unknown as Cart;

      const payment: Payment = {
        ...mockPayment,
        amountPlanned: {
          centAmount: 298, // Discount of 2
          currencyCode: 'USD',
          fractionDigits: 2,
        },
      } as unknown as Payment;

      const result = convertCartItems(cart, payment, 'en-GB');

      const totalAfterDiscount = result.reduce((sum, item) => sum + item.unit_price, 0);
      expect(totalAfterDiscount).toBe(298);
      // Only first 2 items should get -1 discount
      expect(result[0].unit_price).toBe(99);
      expect(result[1].unit_price).toBe(99);
      expect(result[2].unit_price).toBe(100);
    });

    test('should not apply residual discount to items with unit_price of 1', () => {
      const cart: Cart = {
        ...mockCart,
        lineItems: [
          {
            id: 'line-1',
            name: { 'en-GB': 'Cheap Item' },
            totalPrice: {
              centAmount: 1,
              currencyCode: 'USD',
              fractionDigits: 2,
            },
          } as unknown as Cart['lineItems'][0],
          {
            id: 'line-2',
            name: { 'en-GB': 'Product 2' },
            totalPrice: {
              centAmount: 100,
              currencyCode: 'USD',
              fractionDigits: 2,
            },
          } as unknown as Cart['lineItems'][0],
        ],
      } as unknown as Cart;

      const payment: Payment = {
        ...mockPayment,
        amountPlanned: {
          centAmount: 100, // Discount of 1, should skip first item
          currencyCode: 'USD',
          fractionDigits: 2,
        },
      } as unknown as Payment;

      const result = convertCartItems(cart, payment, 'en-GB');

      expect(result[0].unit_price).toBe(1); // Not discounted
      expect(result[1].unit_price).toBe(99); // Discounted by 1
    });
  });
});
