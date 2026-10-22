import { GetStoredPaymentMethodsConverter } from '../../../src/services/converters/get-stored-payment-methods.converter';
import { PaymentMethod } from '@commercetools/connect-payments-sdk';
import { CkoInstrument } from '../../../src/clients/types/instrument.type';
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@lib/logger', () => ({
  log: {
    warn: vi.fn(),
  },
}));

vi.mock('../../../src/services/converters/helper.converter', () => ({
  convertCardBrand: vi.fn((brand: string) => `Converted ${brand}`),
}));

describe('GetStoredPaymentMethodsConverter', () => {
  let converter: GetStoredPaymentMethodsConverter;

  beforeEach(() => {
    converter = new GetStoredPaymentMethodsConverter();
    vi.clearAllMocks();
  });

  describe('convert', () => {
    test('should convert CT payment methods with matching CKO instruments', () => {
      const ctPaymentMethods: PaymentMethod[] = [
        {
          id: 'pm-1',
          createdAt: '2024-01-01T00:00:00Z',
          default: true,
          method: 'card',
          token: {
            value: 'src_card_123',
          },
        } as unknown as PaymentMethod,
      ];

      const ckoInstruments: CkoInstrument[] = [
        {
          id: 'src_card_123',
          type: 'card',
          scheme: 'Visa',
          last4: '4242',
          expiry_month: 12,
          expiry_year: 2025,
        },
      ];

      const result = converter.convert({ ctPaymentMethods, ckoInstruments });

      expect(result.storedPaymentMethods).toHaveLength(1);
      expect(result.storedPaymentMethods[0]).toEqual({
        id: 'pm-1',
        createdAt: '2024-01-01T00:00:00Z',
        isDefault: true,
        type: 'card',
        displayOptions: {
          brand: {
            key: 'Converted Visa',
          },
          endDigits: '4242',
          expiryMonth: 12,
          expiryYear: 2025,
        },
      });
    });

    test('should filter out payment methods without matching CKO instrument', () => {
      const ctPaymentMethods: PaymentMethod[] = [
        {
          id: 'pm-1',
          createdAt: '2024-01-01T00:00:00Z',
          default: true,
          method: 'card',
          token: { value: 'src_card_123' },
        } as unknown as PaymentMethod,
        {
          id: 'pm-2',
          createdAt: '2024-01-02T00:00:00Z',
          default: false,
          method: 'card',
          token: { value: 'src_card_missing' },
        } as unknown as PaymentMethod,
      ];

      const ckoInstruments: CkoInstrument[] = [
        {
          id: 'src_card_123',
          type: 'card',
          scheme: 'Visa',
          last4: '4242',
          expiry_month: 12,
          expiry_year: 2025,
        },
      ];

      const result = converter.convert({ ctPaymentMethods, ckoInstruments });

      expect(result.storedPaymentMethods).toHaveLength(1);
      expect(result.storedPaymentMethods[0].id).toBe('pm-1');
    });

    test('should filter out payment methods without token', () => {
      const ctPaymentMethods: PaymentMethod[] = [
        {
          id: 'pm-1',
          createdAt: '2024-01-01T00:00:00Z',
          default: true,
          method: 'card',
          token: { value: 'src_card_123' },
        } as unknown as PaymentMethod,
        {
          id: 'pm-2',
          createdAt: '2024-01-02T00:00:00Z',
          default: false,
          method: 'card',
        } as unknown as PaymentMethod,
      ];

      const ckoInstruments: CkoInstrument[] = [
        {
          id: 'src_card_123',
          type: 'card',
          scheme: 'Visa',
          last4: '4242',
          expiryMonth: 12,
          expiryYear: 2025,
        } as unknown as CkoInstrument,
      ];

      const result = converter.convert({ ctPaymentMethods, ckoInstruments });

      expect(result.storedPaymentMethods).toHaveLength(1);
      expect(result.storedPaymentMethods[0].id).toBe('pm-1');
    });

    test('should filter out payment methods with null token value', () => {
      const ctPaymentMethods: PaymentMethod[] = [
        {
          id: 'pm-1',
          createdAt: '2024-01-01T00:00:00Z',
          default: true,
          method: 'card',
          token: { value: null },
        } as unknown as PaymentMethod,
      ];

      const ckoInstruments: CkoInstrument[] = [
        {
          id: 'src_card_123',
          type: 'card',
          scheme: 'Visa',
          last4: '4242',
          expiryMonth: 12,
          expiryYear: 2025,
        } as unknown as CkoInstrument,
      ];

      const result = converter.convert({ ctPaymentMethods, ckoInstruments });

      expect(result.storedPaymentMethods).toHaveLength(0);
    });

    test('should handle empty payment methods array', () => {
      const result = converter.convert({ ctPaymentMethods: [], ckoInstruments: [] });

      expect(result.storedPaymentMethods).toEqual([]);
    });

    test('should handle empty CKO instruments array', () => {
      const ctPaymentMethods: PaymentMethod[] = [
        {
          id: 'pm-1',
          createdAt: '2024-01-01T00:00:00Z',
          default: true,
          method: 'card',
          token: { value: 'src_card_123' },
        } as unknown as PaymentMethod,
      ];

      const result = converter.convert({ ctPaymentMethods, ckoInstruments: [] });

      expect(result.storedPaymentMethods).toEqual([]);
    });

    test('should convert card display options with all fields', () => {
      const ctPaymentMethods: PaymentMethod[] = [
        {
          id: 'pm-1',
          createdAt: '2024-01-01T00:00:00Z',
          default: true,
          method: 'card',
          token: { value: 'src_card_123' },
        } as unknown as PaymentMethod,
      ];

      const ckoInstruments: CkoInstrument[] = [
        {
          id: 'src_card_123',
          type: 'card',
          scheme: 'Amex',
          last4: '1111',
          expiry_month: 3,
          expiry_year: 2027,
        },
      ];

      const result = converter.convert({ ctPaymentMethods, ckoInstruments });

      expect(result.storedPaymentMethods[0].displayOptions).toEqual({
        brand: { key: 'Converted Amex' },
        endDigits: '1111',
        expiryMonth: 3,
        expiryYear: 2027,
      });
    });

    test('should convert card display options with optional fields missing', () => {
      const ctPaymentMethods: PaymentMethod[] = [
        {
          id: 'pm-1',
          createdAt: '2024-01-01T00:00:00Z',
          default: true,
          method: 'card',
          token: { value: 'src_card_123' },
        } as unknown as PaymentMethod,
      ];

      const ckoInstruments: CkoInstrument[] = [
        {
          id: 'src_card_123',
          type: 'card',
          scheme: 'Visa',
        } as unknown as CkoInstrument,
      ];

      const result = converter.convert({ ctPaymentMethods, ckoInstruments });

      expect(result.storedPaymentMethods[0].displayOptions).toEqual({
        brand: { key: 'Converted Visa' },
        endDigits: '',
      });
    });

    test('should return empty display options for non-card payment methods', () => {
      const ctPaymentMethods: PaymentMethod[] = [
        {
          id: 'pm-1',
          createdAt: '2024-01-01T00:00:00Z',
          default: true,
          method: 'paypal',
          token: { value: 'src_paypal_123' },
        } as unknown as PaymentMethod,
      ];

      const ckoInstruments: CkoInstrument[] = [
        {
          id: 'src_paypal_123',
          type: 'paypal',
        } as unknown as CkoInstrument,
      ];

      const result = converter.convert({ ctPaymentMethods, ckoInstruments });

      expect(result.storedPaymentMethods[0].displayOptions).toEqual({});
    });

    test('should handle multiple payment methods with mixed validity', () => {
      const ctPaymentMethods: PaymentMethod[] = [
        {
          id: 'pm-1',
          createdAt: '2024-01-01T00:00:00Z',
          default: true,
          method: 'card',
          token: { value: 'src_card_valid' },
        } as unknown as PaymentMethod,
        {
          id: 'pm-2',
          createdAt: '2024-01-02T00:00:00Z',
          default: false,
          method: 'card',
          token: { value: 'src_card_invalid' },
        } as unknown as PaymentMethod,
        {
          id: 'pm-3',
          createdAt: '2024-01-03T00:00:00Z',
          default: false,
          method: 'card',
        } as unknown as PaymentMethod,
        {
          id: 'pm-4',
          createdAt: '2024-01-04T00:00:00Z',
          default: false,
          method: 'card',
          token: { value: 'src_card_another_valid' },
        } as unknown as PaymentMethod,
      ];

      const ckoInstruments: CkoInstrument[] = [
        {
          id: 'src_card_valid',
          type: 'card',
          scheme: 'Visa',
          last4: '4242',
          expiryMonth: 12,
          expiryYear: 2025,
        } as unknown as CkoInstrument,
        {
          id: 'src_card_another_valid',
          type: 'card',
          scheme: 'Mastercard',
          last4: '5555',
          expiryMonth: 6,
          expiryYear: 2026,
        } as unknown as CkoInstrument,
      ];

      const result = converter.convert({ ctPaymentMethods, ckoInstruments });

      expect(result.storedPaymentMethods).toHaveLength(2);
      expect(result.storedPaymentMethods.map((pm: any) => pm.id)).toEqual(['pm-1', 'pm-4']);
    });

    test('should preserve original order of payment methods', () => {
      const ctPaymentMethods: PaymentMethod[] = [
        {
          id: 'pm-3',
          createdAt: '2024-01-03T00:00:00Z',
          default: false,
          method: 'card',
          token: { value: 'src_card_3' },
        } as unknown as PaymentMethod,
        {
          id: 'pm-1',
          createdAt: '2024-01-01T00:00:00Z',
          default: true,
          method: 'card',
          token: { value: 'src_card_1' },
        } as unknown as PaymentMethod,
        {
          id: 'pm-2',
          createdAt: '2024-01-02T00:00:00Z',
          default: false,
          method: 'card',
          token: { value: 'src_card_2' },
        } as unknown as PaymentMethod,
      ];

      const ckoInstruments: CkoInstrument[] = [
        {
          id: 'src_card_1',
          type: 'card',
          scheme: 'Visa',
          last4: '1111',
          expiryMonth: 1,
          expiryYear: 2025,
        } as unknown as CkoInstrument,
        {
          id: 'src_card_2',
          type: 'card',
          scheme: 'Visa',
          last4: '2222',
          expiryMonth: 2,
          expiryYear: 2025,
        } as unknown as CkoInstrument,
        {
          id: 'src_card_3',
          type: 'card',
          scheme: 'Visa',
          last4: '3333',
          expiryMonth: 3,
          expiryYear: 2025,
        } as unknown as CkoInstrument,
      ];

      const result = converter.convert({ ctPaymentMethods, ckoInstruments });

      expect(result.storedPaymentMethods.map((pm: any) => pm.id)).toEqual(['pm-3', 'pm-1', 'pm-2']);
    });
  });
});
