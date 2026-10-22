import { beforeEach, describe, expect, test } from 'vitest';
import { VoidPaymentConverter } from '../../../src/services/converters/void-payment.converter';
import { CancelPaymentRequest } from '../../../src/services/types/operation.type';
import { Payment } from '@commercetools/connect-payments-sdk';

describe('VoidPaymentConverter', () => {
  const mockPayment = { id: 'payment-123', version: 1 } as Payment;
  let converter: VoidPaymentConverter;

  beforeEach(() => {
    converter = new VoidPaymentConverter();
  });

  describe('convertRequest', () => {
    test('should convert void payment request without merchantReference', () => {
      const requestData: CancelPaymentRequest = {
        payment: mockPayment,
      };

      const result = converter.convertRequest({ requestData });

      expect(result).toEqual({});
    });

    test('should convert void payment request with merchantReference', () => {
      const requestData: CancelPaymentRequest = {
        payment: mockPayment,
        merchantReference: 'VOID-54321',
      };

      const result = converter.convertRequest({ requestData });

      expect(result).toEqual({
        reference: 'VOID-54321',
      });
    });

    test('should omit reference when merchantReference is undefined', () => {
      const requestData: CancelPaymentRequest = {
        payment: mockPayment,
        merchantReference: undefined,
      };

      const result = converter.convertRequest({ requestData });

      expect(result).toEqual({});
      expect(result).not.toHaveProperty('reference');
    });

    test('should omit reference when merchantReference is empty string', () => {
      const requestData: CancelPaymentRequest = {
        payment: mockPayment,
        merchantReference: '',
      };

      const result = converter.convertRequest({ requestData });

      expect(result).toEqual({});
      expect(result).not.toHaveProperty('reference');
    });
  });
});
