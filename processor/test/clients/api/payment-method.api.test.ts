import nock from 'nock';
import { PaymentMethodsApi } from '../../../src/clients/api/payment-method.api';
import { CkoGetPaymentMethodsResponse } from '../../../src/clients/types/payment-method.type';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

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
        key: 'default',
        channelId: 'test-channel-id',
        publicKey: 'test-public-key',
        secretKey: 'test-secret-key',
        hmacKey: 'test-hmac-key',
      },
    },
    getChannelId: jest.fn(() => 'test-channel-id'),
    getPublicKey: jest.fn(() => 'test-public-key'),
    getSecretKey: jest.fn(() => 'test-secret-key'),
    getHmacKey: jest.fn(() => 'test-hmac-key'),
    getCaptureDelayHours: jest.fn(() => undefined),
    getEnableThreeDS: jest.fn(() => true),
    getChannelKey: jest.fn(() => Promise.resolve(undefined)),
    isStoredPaymentMethodsEnabled: jest.fn(() => true),
    getPaymentInterface: jest.fn(() => 'checkout-cko'),
    getInterfaceAccount: jest.fn(() => 'test-channel-id'),
    isSaveInterfaceInteractions: jest.fn(() => true),
    isSavePaymentMethodAdditionalDetails: jest.fn(() => true),
    hasMultiChannelConfig: jest.fn(() => false),
  };

  return {
    config: mockConfigData,
    getConfig: jest.fn(() => mockConfigData),
    hasMultiChannelConfig: jest.fn(() => false),
  };
});

describe('PaymentMethodsApi', () => {
  let api: PaymentMethodsApi;
  const baseUrl = 'https://api.sandbox.checkout.com';

  beforeEach(() => {
    api = new PaymentMethodsApi();
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('getPaymentMethods', () => {
    it('should successfully retrieve payment methods', async () => {
      // Arrange
      const mockResponse: CkoGetPaymentMethodsResponse = {
        methods: [{ type: 'card' }, { type: 'paypal' }, { type: 'klarna' }],
      };

      nock(baseUrl)
        .get('/payment-methods')
        .matchHeader('Authorization', 'Bearer test-secret-key')
        .reply(200, mockResponse);

      // Act
      const result = await api.getPaymentMethods();

      // Assert
      expect(result).toEqual(mockResponse);
      expect(result.methods).toHaveLength(3);
      expect(result.methods[0].type).toBe('card');
    });

    it('should throw CkoApiError on 401 unauthorized', async () => {
      // Arrange
      nock(baseUrl).get('/payment-methods').reply(401, { error: 'Unauthorized' });

      // Act & Assert
      await expect(api.getPaymentMethods()).rejects.toMatchObject({
        code: 'CkoError-Unauthorized',
        httpErrorStatus: 401,
      });
    });

    it('should throw CkoApiError on 404 not found', async () => {
      // Arrange
      nock(baseUrl).get('/payment-methods').reply(404, { error: 'Not found' });

      // Act & Assert
      await expect(api.getPaymentMethods()).rejects.toMatchObject({
        code: 'CkoError-NotFound',
        httpErrorStatus: 404,
      });
    });

    it('should throw CkoApiError on 500 server error', async () => {
      // Arrange
      nock(baseUrl).get('/payment-methods').reply(500, { error: 'Internal server error' });

      // Act & Assert
      await expect(api.getPaymentMethods()).rejects.toMatchObject({
        code: 'CkoError-InternalError',
        httpErrorStatus: 500,
      });
    });

    it('should handle network errors', async () => {
      // Arrange
      nock(baseUrl).get('/payment-methods').replyWithError('Network error');

      // Act & Assert
      await expect(api.getPaymentMethods()).rejects.toMatchObject({
        code: 'CkoError-InternalError',
        httpErrorStatus: 500,
      });
    });
  });
});
