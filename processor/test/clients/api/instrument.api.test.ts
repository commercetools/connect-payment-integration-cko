import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { InstrumentApi } from '../../../src/clients/api/instrument.api';
import { CkoInstrument } from '../../../src/clients/types/instrument.type';
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

describe('InstrumentApi', () => {
  let api: InstrumentApi;
  const baseUrl = 'https://api.sandbox.checkout.com';

  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  beforeEach(() => {
    api = new InstrumentApi();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  describe('getInstrument', () => {
    it('should successfully retrieve an instrument', async () => {
      // Arrange
      const instrumentId = 'src_test123';
      const mockResponse: CkoInstrument = {
        id: instrumentId,
        type: 'card',
        customer: {
          id: 'cus_test123',
          email: 'test@example.com',
          name: 'Test Customer',
        },
        scheme: 'Visa',
        expiry_month: 12,
        expiry_year: 2025,
        last4: '4242',
        bin: '424242',
      };

      server.use(
        http.get(`${baseUrl}/instruments/${instrumentId}`, ({ request }) => {
          expect(request.headers.get('Authorization')).toBe('Bearer test-secret-key');
          return HttpResponse.json(mockResponse);
        }),
      );

      // Act
      const result = await api.getInstrument(instrumentId);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(result.id).toBe(instrumentId);
      expect(result.type).toBe('card');
      expect(result.last4).toBe('4242');
    });

    it('should throw CkoApiError on 401 unauthorized', async () => {
      // Arrange
      const instrumentId = 'src_test123';
      server.use(
        http.get(`${baseUrl}/instruments/${instrumentId}`, () =>
          HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        ),
      );

      // Act & Assert
      await expect(api.getInstrument(instrumentId)).rejects.toMatchObject({
        code: 'CkoError-Unauthorized',
        httpErrorStatus: 401,
      });
    });

    it('should throw CkoApiError on 404 not found', async () => {
      // Arrange
      const instrumentId = 'src_test123';
      server.use(
        http.get(`${baseUrl}/instruments/${instrumentId}`, () =>
          HttpResponse.json({ error: 'Not found' }, { status: 404 }),
        ),
      );

      // Act & Assert
      await expect(api.getInstrument(instrumentId)).rejects.toMatchObject({
        code: 'CkoError-NotFound',
        httpErrorStatus: 404,
      });
    });

    it('should throw CkoApiError on 500 server error', async () => {
      // Arrange
      const instrumentId = 'src_test123';
      server.use(
        http.get(`${baseUrl}/instruments/${instrumentId}`, () =>
          HttpResponse.json({ error: 'Internal server error' }, { status: 500 }),
        ),
      );

      // Act & Assert
      await expect(api.getInstrument(instrumentId)).rejects.toMatchObject({
        code: 'CkoError-InternalError',
        httpErrorStatus: 500,
      });
    });

    it('should handle network errors', async () => {
      // Arrange
      const instrumentId = 'src_test123';
      server.use(http.get(`${baseUrl}/instruments/${instrumentId}`, () => HttpResponse.error()));

      // Act & Assert
      await expect(api.getInstrument(instrumentId)).rejects.toMatchObject({
        code: 'CkoError-InternalError',
        httpErrorStatus: 500,
      });
    });
  });

  describe('deleteInstrument', () => {
    it('should successfully delete an instrument', async () => {
      // Arrange
      const instrumentId = 'src_test123';

      server.use(
        http.delete(`${baseUrl}/instruments/${instrumentId}`, ({ request }) => {
          expect(request.headers.get('Authorization')).toBe('Bearer test-secret-key');
          return new HttpResponse(null, { status: 204 });
        }),
      );

      // Act
      await api.deleteInstrument(instrumentId);

      // Assert - no error thrown
      expect(true).toBe(true);
    });

    it('should throw CkoApiError on 401 unauthorized', async () => {
      // Arrange
      const instrumentId = 'src_test123';
      server.use(
        http.delete(`${baseUrl}/instruments/${instrumentId}`, () =>
          HttpResponse.json({ error: 'Unauthorized' }, { status: 401 }),
        ),
      );

      // Act & Assert
      await expect(api.deleteInstrument(instrumentId)).rejects.toMatchObject({
        code: 'CkoError-Unauthorized',
        httpErrorStatus: 401,
      });
    });

    it('should throw CkoApiError on 404 not found', async () => {
      // Arrange
      const instrumentId = 'src_test123';
      server.use(
        http.delete(`${baseUrl}/instruments/${instrumentId}`, () =>
          HttpResponse.json({ error: 'Not found' }, { status: 404 }),
        ),
      );

      // Act & Assert
      await expect(api.deleteInstrument(instrumentId)).rejects.toMatchObject({
        code: 'CkoError-NotFound',
        httpErrorStatus: 404,
      });
    });

    it('should throw CkoApiError on 500 server error', async () => {
      // Arrange
      const instrumentId = 'src_test123';
      server.use(
        http.delete(`${baseUrl}/instruments/${instrumentId}`, () =>
          HttpResponse.json({ error: 'Internal server error' }, { status: 500 }),
        ),
      );

      // Act & Assert
      await expect(api.deleteInstrument(instrumentId)).rejects.toMatchObject({
        code: 'CkoError-InternalError',
        httpErrorStatus: 500,
      });
    });

    it('should handle network errors', async () => {
      // Arrange
      const instrumentId = 'src_test123';
      server.use(http.delete(`${baseUrl}/instruments/${instrumentId}`, () => HttpResponse.error()));

      // Act & Assert
      await expect(api.deleteInstrument(instrumentId)).rejects.toMatchObject({
        code: 'CkoError-InternalError',
        httpErrorStatus: 500,
      });
    });
  });
});
