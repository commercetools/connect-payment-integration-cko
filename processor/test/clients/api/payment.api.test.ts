import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { PaymentApi } from '../../../src/clients/api/payment.api';
import {
  CkoPaymentRequest,
  CkoPaymentResponse,
  CkoGetPaymentResponse,
  CkoVoidPaymentRequest,
  CkoVoidPaymentResponse,
  CkoReversePaymentRequest,
  CkoReversePaymentResponse,
  CkoCapturePaymentRequest,
  CkoCapturePaymentResponse,
  CkoRefundPaymentRequest,
  CkoRefundPaymentResponse,
} from '../../../src/clients/types/payment.type';
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

describe('PaymentApi', () => {
  let api: PaymentApi;
  const baseUrl = 'https://api.sandbox.checkout.com';

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  beforeEach(() => {
    api = new PaymentApi();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  describe('createPayment', () => {
    it('should successfully create a payment', async () => {
      // Arrange
      const mockRequest = {} as unknown as CkoPaymentRequest;
      const mockResponse = {
        id: 'pay_test123',
        status: 'Authorized',
      } as unknown as CkoPaymentResponse;

      server.use(
        http.post(`${baseUrl}/payments`, ({ request }) => {
          expect(request.headers.get('Authorization')).toBe('Bearer test-secret-key');
          return HttpResponse.json(mockResponse);
        }),
      );

      // Act
      const result = await api.createPayment(mockRequest);

      // Assert
      expect(result.id).toBe('pay_test123');
    });

    it('should throw CkoApiError on error', async () => {
      // Arrange
      const mockRequest = {} as unknown as CkoPaymentRequest;
      server.use(http.post(`${baseUrl}/payments`, () => HttpResponse.json({ error: 'Invalid data' }, { status: 422 })));

      // Act & Assert
      await expect(api.createPayment(mockRequest)).rejects.toMatchObject({
        code: 'CkoError-InvalidData',
        httpErrorStatus: 422,
      });
    });
  });

  describe('getPayment', () => {
    it('should successfully retrieve a payment', async () => {
      // Arrange
      const paymentId = 'pay_test123';
      const mockResponse = {
        id: paymentId,
        amount: 1000,
        currency: 'USD',
      } as unknown as CkoGetPaymentResponse;

      server.use(
        http.get(`${baseUrl}/payments/${paymentId}`, ({ request }) => {
          expect(request.headers.get('Authorization')).toBe('Bearer test-secret-key');
          return HttpResponse.json(mockResponse);
        }),
      );

      // Act
      const result = await api.getPayment(paymentId);

      // Assert
      expect(result.id).toBe(paymentId);
    });

    it('should throw CkoApiError on 404', async () => {
      // Arrange
      const paymentId = 'pay_test123';
      server.use(
        http.get(`${baseUrl}/payments/${paymentId}`, () => HttpResponse.json({ error: 'Not found' }, { status: 404 })),
      );

      // Act & Assert
      await expect(api.getPayment(paymentId)).rejects.toMatchObject({
        code: 'CkoError-NotFound',
        httpErrorStatus: 404,
      });
    });
  });

  describe('voidPayment', () => {
    it('should successfully void a payment', async () => {
      // Arrange
      const paymentId = 'pay_test123';
      const mockRequest = {} as unknown as CkoVoidPaymentRequest;
      const mockResponse = {
        action_id: 'act_test123',
        reference: 'void-123',
      } as unknown as CkoVoidPaymentResponse;

      server.use(
        http.post(`${baseUrl}/payments/${paymentId}/voids`, ({ request }) => {
          expect(request.headers.get('Authorization')).toBe('Bearer test-secret-key');
          return HttpResponse.json(mockResponse);
        }),
      );

      // Act
      const result = await api.voidPayment(paymentId, mockRequest);

      // Assert
      expect(result.action_id).toBe('act_test123');
    });

    it('should throw CkoApiError on error', async () => {
      // Arrange
      const paymentId = 'pay_test123';
      const mockRequest = {} as unknown as CkoVoidPaymentRequest;
      server.use(
        http.post(`${baseUrl}/payments/${paymentId}/voids`, () =>
          HttpResponse.json({ error: 'Invalid data' }, { status: 422 }),
        ),
      );

      // Act & Assert
      await expect(api.voidPayment(paymentId, mockRequest)).rejects.toMatchObject({
        code: 'CkoError-InvalidData',
        httpErrorStatus: 422,
      });
    });
  });

  describe('reversePayment', () => {
    it('should successfully reverse a payment', async () => {
      // Arrange
      const paymentId = 'pay_test123';
      const mockRequest = {} as unknown as CkoReversePaymentRequest;
      const mockResponse = {
        action_id: 'act_test123',
        reference: 'reverse-123',
      } as unknown as CkoReversePaymentResponse;

      server.use(
        http.post(`${baseUrl}/payments/${paymentId}/reversals`, ({ request }) => {
          expect(request.headers.get('Authorization')).toBe('Bearer test-secret-key');
          return HttpResponse.json(mockResponse);
        }),
      );

      // Act
      const result = await api.reversePayment(paymentId, mockRequest);

      // Assert
      expect(result.action_id).toBe('act_test123');
    });

    it('should throw CkoApiError on error', async () => {
      // Arrange
      const paymentId = 'pay_test123';
      const mockRequest = {} as unknown as CkoReversePaymentRequest;
      server.use(
        http.post(`${baseUrl}/payments/${paymentId}/reversals`, () =>
          HttpResponse.json({ error: 'Invalid data' }, { status: 422 }),
        ),
      );

      // Act & Assert
      await expect(api.reversePayment(paymentId, mockRequest)).rejects.toMatchObject({
        code: 'CkoError-InvalidData',
        httpErrorStatus: 422,
      });
    });
  });

  describe('capturePayment', () => {
    it('should successfully capture a payment', async () => {
      // Arrange
      const paymentId = 'pay_test123';
      const mockRequest = {} as unknown as CkoCapturePaymentRequest;
      const mockResponse = {
        action_id: 'act_test123',
        reference: 'capture-123',
      } as unknown as CkoCapturePaymentResponse;

      server.use(
        http.post(`${baseUrl}/payments/${paymentId}/captures`, ({ request }) => {
          expect(request.headers.get('Authorization')).toBe('Bearer test-secret-key');
          return HttpResponse.json(mockResponse);
        }),
      );

      // Act
      const result = await api.capturePayment(paymentId, mockRequest);

      // Assert
      expect(result.action_id).toBe('act_test123');
    });

    it('should throw CkoApiError on error', async () => {
      // Arrange
      const paymentId = 'pay_test123';
      const mockRequest = {} as unknown as CkoCapturePaymentRequest;
      server.use(
        http.post(`${baseUrl}/payments/${paymentId}/captures`, () =>
          HttpResponse.json({ error: 'Invalid data' }, { status: 422 }),
        ),
      );

      // Act & Assert
      await expect(api.capturePayment(paymentId, mockRequest)).rejects.toMatchObject({
        code: 'CkoError-InvalidData',
        httpErrorStatus: 422,
      });
    });
  });

  describe('refundPayment', () => {
    it('should successfully refund a payment', async () => {
      // Arrange
      const paymentId = 'pay_test123';
      const mockRequest = {} as unknown as CkoRefundPaymentRequest;
      const mockResponse = {
        action_id: 'act_test123',
        reference: 'refund-123',
      } as unknown as CkoRefundPaymentResponse;

      server.use(
        http.post(`${baseUrl}/payments/${paymentId}/refunds`, ({ request }) => {
          expect(request.headers.get('Authorization')).toBe('Bearer test-secret-key');
          return HttpResponse.json(mockResponse);
        }),
      );

      // Act
      const result = await api.refundPayment(paymentId, mockRequest);

      // Assert
      expect(result.action_id).toBe('act_test123');
    });

    it('should throw CkoApiError on error', async () => {
      // Arrange
      const paymentId = 'pay_test123';
      const mockRequest = {} as unknown as CkoRefundPaymentRequest;
      server.use(
        http.post(`${baseUrl}/payments/${paymentId}/refunds`, () =>
          HttpResponse.json({ error: 'Invalid data' }, { status: 422 }),
        ),
      );

      // Act & Assert
      await expect(api.refundPayment(paymentId, mockRequest)).rejects.toMatchObject({
        code: 'CkoError-InvalidData',
        httpErrorStatus: 422,
      });
    });
  });
});
