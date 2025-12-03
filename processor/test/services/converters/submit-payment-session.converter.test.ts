import { SubmitPaymentSessionConverter } from '../../../src/services/converters/submit-payment-session.converter';
import { Payment } from '@commercetools/connect-payments-sdk';
import { SubmitPaymentSessionResponse } from '../../../src/clients/types/payment-session.type';
import { getConfig } from '../../../src/config/config';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

// Mocks
jest.mock('../../../src/config/config', () => {
  const mockConfigData = {
    projectKey: 'test-project',
    clientId: 'test-client-id',
    clientSecret: 'test-secret',
    jwksUrl: 'https://test.jwks.url',
    jwtIssuer: 'https://test.issuer',
    authUrl: 'https://test.auth.url',
    apiUrl: 'https://test.api.url',
    sessionUrl: 'https://test.session.url',
    healthCheckTimeout: 5000,
    loggerLevel: 'info',
    merchantReturnUrl: 'https://test.return.url',
    ckoEnvironment: 'sandbox',
    ckoConfig: {
      default: {
        channelId: 'test-channel-id',
        publicKey: 'test-public-key',
        secretKey: 'test-secret-key',
        hmacKey: 'test-hmac-key',
      },
    },
  };

  return {
    config: mockConfigData,
    getConfig: jest.fn(() => mockConfigData),
    hasMultiChannelConfig: jest.fn(() => false),
  };
});

const mockGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;

describe('SubmitPaymentSessionConverter', () => {
  let converter: SubmitPaymentSessionConverter;

  const mockPayment: Payment = {
    id: 'payment-123',
    version: 1,
    amountPlanned: {
      centAmount: 10000,
      currencyCode: 'USD',
      fractionDigits: 2,
    },
  } as Payment;

  beforeEach(() => {
    converter = new SubmitPaymentSessionConverter();
    jest.clearAllMocks();
  });

  describe('convertRequest', () => {
    test('should use Regular payment type by default', () => {
      mockGetConfig.mockReturnValue({
        isStoredPaymentMethodsEnabled: () => false,
      } as any);

      const requestData = {
        paymentReference: 'payment-123',
        session_data: 'session-data-token-xyz',
        storePaymentMethod: false,
      };

      const result = converter.convertRequest({ requestData });

      expect(result).toEqual({
        session_data: 'session-data-token-xyz',
        payment_type: 'Regular',
      });
    });

    test('should use Unscheduled payment type when feature enabled and storePaymentMethod is true', () => {
      mockGetConfig.mockReturnValue({
        isStoredPaymentMethodsEnabled: () => true,
      } as any);

      const requestData = {
        paymentReference: 'payment-123',
        session_data: 'session-data-token-abc',
        storePaymentMethod: true,
      };

      const result = converter.convertRequest({ requestData });

      expect(result).toEqual({
        session_data: 'session-data-token-abc',
        payment_type: 'Unscheduled',
      });
    });

    test('should use Regular when feature disabled even if storePaymentMethod is true', () => {
      mockGetConfig.mockReturnValue({
        isStoredPaymentMethodsEnabled: () => false,
      } as any);

      const requestData = {
        paymentReference: 'payment-123',
        session_data: 'session-data-token-def',
        storePaymentMethod: true,
      };

      const result = converter.convertRequest({ requestData });

      expect(result.payment_type).toBe('Regular');
    });
  });

  describe('convertResponse', () => {
    test('should convert the response from cko', () => {
      const responseData = {
        id: 'payment-id-123',
        status: 'Authorized',
        amount: 15000,
        currency: 'EUR',
      } as unknown as SubmitPaymentSessionResponse;

      const result = converter.convertResponse({ responseData, payment: mockPayment });

      expect(result).toEqual({
        id: 'payment-id-123',
        status: 'Authorized',
        amount: 15000,
        currency: 'EUR',
        paymentReference: 'payment-123',
      });
    });
  });
});
