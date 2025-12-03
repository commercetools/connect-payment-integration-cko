import nock from 'nock';
import { PaymentSessionApi } from '../../../src/clients/api/payment-session.api';
import {
  PaymentSessionRequest,
  PaymentSessionResponse,
  SubmitPaymentSessionRequest,
  SubmitPaymentSessionResponse,
  CkoPaymentSessionStatus,
} from '../../../src/clients/types/payment-session.type';
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

describe('PaymentSessionApi', () => {
  let api: PaymentSessionApi;
  const baseUrl = 'https://api.sandbox.checkout.com';

  beforeEach(() => {
    api = new PaymentSessionApi();
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('createPaymentSession', () => {
    it('should successfully create a payment session', async () => {
      // Arrange
      const mockRequest: PaymentSessionRequest = {
        amount: 1000,
        currency: 'USD',
        reference: 'order-123',
        success_url: 'https://example.com/success',
        failure_url: 'https://example.com/failure',
        processing_channel_id: 'test-channel-id',
        billing: {
          address: {
            country: 'US',
            city: 'New York',
          },
        },
        capture: true,
        integration: {
          external_platform: {
            name: 'Commercetools',
            version: '1.0.0',
          },
        },
      } as unknown as PaymentSessionRequest;

      const mockResponse: PaymentSessionResponse = {
        id: 'ps_test123',
        payment_session_token: 'token_test123',
        payment_session_secret: 'secret_test123',
        _links: {
          self: {
            href: 'https://api.sandbox.checkout.com/payment-sessions/ps_test123',
          },
        },
      };

      nock(baseUrl)
        .post('/payment-sessions')
        .matchHeader('Authorization', 'Bearer test-secret-key')
        .reply(200, mockResponse);

      // Act
      const result = await api.createPaymentSession(mockRequest);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(result.id).toBe('ps_test123');
      expect(result.payment_session_token).toBe('token_test123');
    });

    it('should throw CkoApiError on 401 unauthorized', async () => {
      // Arrange
      const mockRequest = {} as unknown as PaymentSessionRequest;
      nock(baseUrl).post('/payment-sessions').reply(401, { error: 'Unauthorized' });

      // Act & Assert
      await expect(api.createPaymentSession(mockRequest)).rejects.toMatchObject({
        code: 'CkoError-Unauthorized',
        httpErrorStatus: 401,
      });
    });

    it('should throw CkoApiError on 422 invalid data', async () => {
      // Arrange
      const mockRequest = {} as unknown as PaymentSessionRequest;
      nock(baseUrl).post('/payment-sessions').reply(422, { error: 'Invalid data' });

      // Act & Assert
      await expect(api.createPaymentSession(mockRequest)).rejects.toMatchObject({
        code: 'CkoError-InvalidData',
        httpErrorStatus: 422,
      });
    });

    it('should throw CkoApiError on 500 server error', async () => {
      // Arrange
      const mockRequest = {} as unknown as PaymentSessionRequest;
      nock(baseUrl).post('/payment-sessions').reply(500, { error: 'Internal server error' });

      // Act & Assert
      await expect(api.createPaymentSession(mockRequest)).rejects.toMatchObject({
        code: 'CkoError-InternalError',
        httpErrorStatus: 500,
      });
    });

    it('should handle network errors', async () => {
      // Arrange
      const mockRequest = {} as unknown as PaymentSessionRequest;
      nock(baseUrl).post('/payment-sessions').replyWithError('Network error');

      // Act & Assert
      await expect(api.createPaymentSession(mockRequest)).rejects.toMatchObject({
        code: 'CkoError-InternalError',
        httpErrorStatus: 500,
      });
    });
  });

  describe('submitPaymentSession', () => {
    it('should successfully submit a payment session', async () => {
      // Arrange
      const sessionId = 'ps_test123';
      const mockRequest: SubmitPaymentSessionRequest = {
        session_data: 'encrypted_session_data',
        payment_type: 'Regular',
      };

      const mockResponse: SubmitPaymentSessionResponse = {
        id: 'pay_test123',
        status: CkoPaymentSessionStatus.APPROVED,
        type: 'card',
      };

      nock(baseUrl)
        .post(`/payment-sessions/${sessionId}/submit`)
        .matchHeader('Authorization', 'Bearer test-secret-key')
        .reply(200, mockResponse);

      // Act
      const result = await api.submitPaymentSession(sessionId, mockRequest);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(result.id).toBe('pay_test123');
      expect(result.status).toBe(CkoPaymentSessionStatus.APPROVED);
    });

    it('should handle action required status', async () => {
      // Arrange
      const sessionId = 'ps_test123';
      const mockRequest: SubmitPaymentSessionRequest = {
        session_data: 'encrypted_session_data',
      };

      const mockResponse: SubmitPaymentSessionResponse = {
        id: 'pay_test123',
        status: CkoPaymentSessionStatus.ACTION_REQUIRED,
        type: 'card',
        action: {
          type: '3ds',
          url: 'https://3ds.example.com',
        },
      };

      nock(baseUrl)
        .post(`/payment-sessions/${sessionId}/submit`)
        .matchHeader('Authorization', 'Bearer test-secret-key')
        .reply(200, mockResponse);

      // Act
      const result = await api.submitPaymentSession(sessionId, mockRequest);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(result.status).toBe(CkoPaymentSessionStatus.ACTION_REQUIRED);
      expect(result.action).toBeDefined();
    });

    it('should throw CkoApiError on 401 unauthorized', async () => {
      // Arrange
      const sessionId = 'ps_test123';
      const mockRequest = {} as unknown as SubmitPaymentSessionRequest;
      nock(baseUrl).post(`/payment-sessions/${sessionId}/submit`).reply(401, { error: 'Unauthorized' });

      // Act & Assert
      await expect(api.submitPaymentSession(sessionId, mockRequest)).rejects.toMatchObject({
        code: 'CkoError-Unauthorized',
        httpErrorStatus: 401,
      });
    });

    it('should throw CkoApiError on 404 not found', async () => {
      // Arrange
      const sessionId = 'ps_test123';
      const mockRequest = {} as unknown as SubmitPaymentSessionRequest;
      nock(baseUrl).post(`/payment-sessions/${sessionId}/submit`).reply(404, { error: 'Not found' });

      // Act & Assert
      await expect(api.submitPaymentSession(sessionId, mockRequest)).rejects.toMatchObject({
        code: 'CkoError-NotFound',
        httpErrorStatus: 404,
      });
    });

    it('should throw CkoApiError on 422 invalid data', async () => {
      // Arrange
      const sessionId = 'ps_test123';
      const mockRequest = {} as unknown as SubmitPaymentSessionRequest;
      nock(baseUrl).post(`/payment-sessions/${sessionId}/submit`).reply(422, { error: 'Invalid data' });

      // Act & Assert
      await expect(api.submitPaymentSession(sessionId, mockRequest)).rejects.toMatchObject({
        code: 'CkoError-InvalidData',
        httpErrorStatus: 422,
      });
    });

    it('should throw CkoApiError on 500 server error', async () => {
      // Arrange
      const sessionId = 'ps_test123';
      const mockRequest = {} as unknown as SubmitPaymentSessionRequest;
      nock(baseUrl).post(`/payment-sessions/${sessionId}/submit`).reply(500, { error: 'Internal server error' });

      // Act & Assert
      await expect(api.submitPaymentSession(sessionId, mockRequest)).rejects.toMatchObject({
        code: 'CkoError-InternalError',
        httpErrorStatus: 500,
      });
    });

    it('should handle network errors', async () => {
      // Arrange
      const sessionId = 'ps_test123';
      const mockRequest = {} as unknown as SubmitPaymentSessionRequest;
      nock(baseUrl).post(`/payment-sessions/${sessionId}/submit`).replyWithError('Network error');

      // Act & Assert
      await expect(api.submitPaymentSession(sessionId, mockRequest)).rejects.toMatchObject({
        code: 'CkoError-InternalError',
        httpErrorStatus: 500,
      });
    });
  });
});
