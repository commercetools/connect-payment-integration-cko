import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { PaymentSessionApi } from '../../../src/clients/api/payment-session.api';
import {
  PaymentSessionRequest,
  PaymentSessionResponse,
  SubmitPaymentSessionRequest,
  SubmitPaymentSessionResponse,
  CkoPaymentSessionStatus,
} from '../../../src/clients/types/payment-session.type';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/config/config', () => {
  const mockConfigData = {
    projectKey: 'test-project',
    clientId: 'test-client-id',
    clientSecret: 'test-secret',
    jwksUrl: 'https://test.jwks.url',
    jwtIssuer: 'https://test.issuer',
    authUrl: 'https://test.auth.url',
    apiUrl: 'https://test.api.url',
    sessionUrl: 'https://test.session.url',
    checkoutUrl: 'https://test.checkout.url',
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
    getChannelId: vi.fn(() => 'test-channel-id'),
    getPublicKey: vi.fn(() => 'test-public-key'),
    getSecretKey: vi.fn(() => 'test-secret-key'),
    getHmacKey: vi.fn(() => 'test-hmac-key'),
    getApiBaseUrl: vi.fn(() => 'https://api.sandbox.checkout.com'),
    getAccessBaseUrl: vi.fn(() => 'https://access.sandbox.checkout.com'),
    getCaptureDelayHours: vi.fn(() => undefined),
    getEnableThreeDS: vi.fn(() => true),
    getChannelKey: vi.fn(() => Promise.resolve(undefined)),
    isStoredPaymentMethodsEnabled: vi.fn(() => true),
    getPaymentInterface: vi.fn(() => 'checkout-cko'),
    getInterfaceAccount: vi.fn(() => 'test-channel-id'),
    isSaveInterfaceInteractions: vi.fn(() => true),
    isSavePaymentMethodAdditionalDetails: vi.fn(() => true),
    hasMultiChannelConfig: vi.fn(() => false),
  };

  return {
    config: mockConfigData,
    getConfig: vi.fn(() => mockConfigData),
    hasMultiChannelConfig: vi.fn(() => false),
  };
});

const server = setupServer();

describe('PaymentSessionApi', () => {
  let api: PaymentSessionApi;
  const baseUrl = 'https://api.sandbox.checkout.com';

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  beforeEach(() => {
    api = new PaymentSessionApi();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
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

      server.use(
        http.post(`${baseUrl}/payment-sessions`, ({ request }) => {
          expect(request.headers.get('Authorization')).toBe('Bearer test-secret-key');
          return HttpResponse.json(mockResponse);
        }),
      );

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
      server.use(
        http.post(`${baseUrl}/payment-sessions`, () => HttpResponse.json({ error: 'Unauthorized' }, { status: 401 })),
      );

      // Act & Assert
      await expect(api.createPaymentSession(mockRequest)).rejects.toMatchObject({
        code: 'CkoError-Unauthorized',
        httpErrorStatus: 401,
      });
    });

    it('should throw CkoApiError on 422 invalid data', async () => {
      // Arrange
      const mockRequest = {} as unknown as PaymentSessionRequest;
      server.use(
        http.post(`${baseUrl}/payment-sessions`, () => HttpResponse.json({ error: 'Invalid data' }, { status: 422 })),
      );

      // Act & Assert
      await expect(api.createPaymentSession(mockRequest)).rejects.toMatchObject({
        code: 'CkoError-InvalidData',
        httpErrorStatus: 422,
      });
    });

    it('should throw CkoApiError on 500 server error', async () => {
      // Arrange
      const mockRequest = {} as unknown as PaymentSessionRequest;
      server.use(
        http.post(`${baseUrl}/payment-sessions`, () =>
          HttpResponse.json({ error: 'Internal server error' }, { status: 500 }),
        ),
      );

      // Act & Assert
      await expect(api.createPaymentSession(mockRequest)).rejects.toMatchObject({
        code: 'CkoError-InternalError',
        httpErrorStatus: 500,
      });
    });

    it('should handle network errors', async () => {
      // Arrange
      const mockRequest = {} as unknown as PaymentSessionRequest;
      server.use(http.post(`${baseUrl}/payment-sessions`, () => HttpResponse.error()));

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

      server.use(
        http.post(`${baseUrl}/payment-sessions/${sessionId}/submit`, ({ request }) => {
          expect(request.headers.get('Authorization')).toBe('Bearer test-secret-key');
          return HttpResponse.json(mockResponse);
        }),
      );

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

      server.use(
        http.post(`${baseUrl}/payment-sessions/${sessionId}/submit`, ({ request }) => {
          expect(request.headers.get('Authorization')).toBe('Bearer test-secret-key');
          return HttpResponse.json(mockResponse);
        }),
      );

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
      server.use(
        http.post(`${baseUrl}/payment-sessions/${sessionId}/submit`, () =>
          HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        ),
      );

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
      server.use(
        http.post(`${baseUrl}/payment-sessions/${sessionId}/submit`, () =>
          HttpResponse.json({ error: 'Not found' }, { status: 404 }),
        ),
      );

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
      server.use(
        http.post(`${baseUrl}/payment-sessions/${sessionId}/submit`, () =>
          HttpResponse.json({ error: 'Invalid data' }, { status: 422 }),
        ),
      );

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
      server.use(
        http.post(`${baseUrl}/payment-sessions/${sessionId}/submit`, () =>
          HttpResponse.json({ error: 'Internal server error' }, { status: 500 }),
        ),
      );

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
      server.use(http.post(`${baseUrl}/payment-sessions/${sessionId}/submit`, () => HttpResponse.error()));

      // Act & Assert
      await expect(api.submitPaymentSession(sessionId, mockRequest)).rejects.toMatchObject({
        code: 'CkoError-InternalError',
        httpErrorStatus: 500,
      });
    });
  });
});
