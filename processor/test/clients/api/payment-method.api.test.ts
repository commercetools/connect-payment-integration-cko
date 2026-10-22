import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { PaymentMethodsApi } from '../../../src/clients/api/payment-method.api';
import { CkoGetPaymentMethodsResponse } from '../../../src/clients/types/payment-method.type';
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

describe('PaymentMethodsApi', () => {
  let api: PaymentMethodsApi;
  const baseUrl = 'https://api.sandbox.checkout.com';

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  beforeEach(() => {
    api = new PaymentMethodsApi();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  describe('getPaymentMethods', () => {
    it('should successfully retrieve payment methods', async () => {
      // Arrange
      const mockResponse: CkoGetPaymentMethodsResponse = {
        methods: [{ type: 'card' }, { type: 'paypal' }, { type: 'klarna' }],
      };

      server.use(
        http.get(`${baseUrl}/payment-methods`, ({ request }) => {
          expect(new URL(request.url).searchParams.get('processing_channel_id')).toBe('test-channel-id');
          expect(request.headers.get('Authorization')).toBe('Bearer test-secret-key');
          return HttpResponse.json(mockResponse);
        }),
      );

      // Act
      const result = await api.getPaymentMethods();

      // Assert
      expect(result).toEqual(mockResponse);
      expect(result.methods).toHaveLength(3);
      expect(result.methods[0].type).toBe('card');
    });

    it('should throw CkoApiError on 401 unauthorized', async () => {
      // Arrange
      server.use(
        http.get(`${baseUrl}/payment-methods`, ({ request }) => {
          expect(new URL(request.url).searchParams.get('processing_channel_id')).toBe('test-channel-id');
          return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }),
      );

      // Act & Assert
      await expect(api.getPaymentMethods()).rejects.toMatchObject({
        code: 'CkoError-Unauthorized',
        httpErrorStatus: 401,
      });
    });

    it('should throw CkoApiError on 404 not found', async () => {
      // Arrange
      server.use(
        http.get(`${baseUrl}/payment-methods`, ({ request }) => {
          expect(new URL(request.url).searchParams.get('processing_channel_id')).toBe('test-channel-id');
          return HttpResponse.json({ error: 'Not found' }, { status: 404 });
        }),
      );

      // Act & Assert
      await expect(api.getPaymentMethods()).rejects.toMatchObject({
        code: 'CkoError-NotFound',
        httpErrorStatus: 404,
      });
    });

    it('should throw CkoApiError on 500 server error', async () => {
      // Arrange
      server.use(
        http.get(`${baseUrl}/payment-methods`, ({ request }) => {
          expect(new URL(request.url).searchParams.get('processing_channel_id')).toBe('test-channel-id');
          return HttpResponse.json({ error: 'Internal server error' }, { status: 500 });
        }),
      );

      // Act & Assert
      await expect(api.getPaymentMethods()).rejects.toMatchObject({
        code: 'CkoError-InternalError',
        httpErrorStatus: 500,
      });
    });

    it('should handle network errors', async () => {
      // Arrange
      server.use(
        http.get(`${baseUrl}/payment-methods`, ({ request }) => {
          expect(new URL(request.url).searchParams.get('processing_channel_id')).toBe('test-channel-id');
          return HttpResponse.error();
        }),
      );

      // Act & Assert
      await expect(api.getPaymentMethods()).rejects.toMatchObject({
        code: 'CkoError-InternalError',
        httpErrorStatus: 500,
      });
    });
  });
});
