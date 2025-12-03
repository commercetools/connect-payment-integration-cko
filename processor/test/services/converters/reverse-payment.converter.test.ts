import { ReversePaymentConverter } from '../../../src/services/converters/reverse-payment.converter';
import { ReversePaymentRequest } from '../../../src/services/types/operation.type';
import { Payment } from '@commercetools/connect-payments-sdk';

describe('ReversePaymentConverter', () => {
  const mockPayment = { id: 'payment-123', version: 1 } as Payment;
  let converter: ReversePaymentConverter;

  beforeEach(() => {
    converter = new ReversePaymentConverter();
  });

  describe('convertRequest', () => {
    test('should convert reverse payment request without merchantReference', () => {
      const requestData: ReversePaymentRequest = {
        payment: mockPayment,
      };

      const result = converter.convertRequest({ requestData });

      expect(result).toEqual({});
    });

    test('should convert reverse payment request with merchantReference', () => {
      const requestData: ReversePaymentRequest = {
        payment: mockPayment,
        merchantReference: 'REVERSE-12345',
      };

      const result = converter.convertRequest({ requestData });

      expect(result).toEqual({
        reference: 'REVERSE-12345',
      });
    });

    test('should omit reference when merchantReference is undefined', () => {
      const requestData: ReversePaymentRequest = {
        payment: mockPayment,
        merchantReference: undefined,
      };

      const result = converter.convertRequest({ requestData });

      expect(result).toEqual({});
      expect(result).not.toHaveProperty('reference');
    });

    test('should omit reference when merchantReference is empty string', () => {
      const requestData: ReversePaymentRequest = {
        payment: mockPayment,
        merchantReference: '',
      };

      const result = converter.convertRequest({ requestData });

      expect(result).toEqual({});
      expect(result).not.toHaveProperty('reference');
    });
  });
});
