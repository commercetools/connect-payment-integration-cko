import { beforeEach, describe, expect, test } from 'vitest';
import { CapturePaymentConverter } from '../../../src/services/converters/capture-payment.converter';
import { CapturePaymentRequest } from '../../../src/services/types/operation.type';
import { Payment } from '@commercetools/connect-payments-sdk';

describe('CapturePaymentConverter', () => {
  const mockPayment = { id: 'payment-123', version: 1 } as Payment;
  let converter: CapturePaymentConverter;

  beforeEach(() => {
    converter = new CapturePaymentConverter();
  });

  describe('convertRequest', () => {
    test('should convert capture payment request with amount only', () => {
      const requestData: CapturePaymentRequest = {
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

    test('should convert capture payment request with amount and merchantReference', () => {
      const requestData: CapturePaymentRequest = {
        payment: mockPayment,
        amount: {
          centAmount: 15050,
          currencyCode: 'EUR',
        },
        merchantReference: 'CAPTURE-12345',
      };

      const result = converter.convertRequest({ requestData });

      expect(result).toEqual({
        amount: 15050,
        reference: 'CAPTURE-12345',
      });
    });

    test('should omit reference when merchantReference is undefined', () => {
      const requestData: CapturePaymentRequest = {
        payment: mockPayment,
        amount: {
          centAmount: 5000,
          currencyCode: 'GBP',
        },
        merchantReference: undefined,
      };

      const result = converter.convertRequest({ requestData });

      expect(result).toEqual({
        amount: 5000,
      });
      expect(result).not.toHaveProperty('reference');
    });

    test('should omit reference when merchantReference is empty string', () => {
      const requestData: CapturePaymentRequest = {
        payment: mockPayment,
        amount: {
          centAmount: 2500,
          currencyCode: 'USD',
        },
        merchantReference: '',
      };

      const result = converter.convertRequest({ requestData });

      expect(result).toEqual({
        amount: 2500,
      });
      expect(result).not.toHaveProperty('reference');
    });
  });
});
