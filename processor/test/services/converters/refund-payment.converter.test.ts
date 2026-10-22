import { beforeEach, describe, expect, test } from 'vitest';
import { RefundPaymentConverter } from '../../../src/services/converters/refund-payment.converter';
import { RefundPaymentRequest } from '../../../src/services/types/operation.type';
import { Payment } from '@commercetools/connect-payments-sdk';

describe('RefundPaymentConverter', () => {
  const mockPayment = { id: 'payment-123', version: 1 } as Payment;
  let converter: RefundPaymentConverter;

  beforeEach(() => {
    converter = new RefundPaymentConverter();
  });

  describe('convertRequest', () => {
    test('should convert refund payment request with amount only', () => {
      const requestData: RefundPaymentRequest = {
        payment: mockPayment,
        amount: {
          centAmount: 10000,
          currencyCode: 'USD',
        },
      };

      const result = converter.convertRequest({ requestData });

      expect(result).toEqual({
        amount: 10000,
      });
    });

    test('should convert refund payment request with amount and merchantReference', () => {
      const requestData: RefundPaymentRequest = {
        payment: mockPayment,
        amount: {
          centAmount: 25000,
          currencyCode: 'EUR',
        },
        merchantReference: 'REFUND-67890',
      };

      const result = converter.convertRequest({ requestData });

      expect(result).toEqual({
        amount: 25000,
        reference: 'REFUND-67890',
      });
    });

    test('should omit reference when merchantReference is undefined', () => {
      const requestData: RefundPaymentRequest = {
        payment: mockPayment,
        amount: {
          centAmount: 7500,
          currencyCode: 'GBP',
        },
        merchantReference: undefined,
      };

      const result = converter.convertRequest({ requestData });

      expect(result).toEqual({
        amount: 7500,
      });
      expect(result).not.toHaveProperty('reference');
    });

    test('should omit reference when merchantReference is empty string', () => {
      const requestData: RefundPaymentRequest = {
        payment: mockPayment,
        amount: {
          centAmount: 3000,
          currencyCode: 'USD',
        },
        merchantReference: '',
      };

      const result = converter.convertRequest({ requestData });

      expect(result).toEqual({
        amount: 3000,
      });
      expect(result).not.toHaveProperty('reference');
    });
  });
});
