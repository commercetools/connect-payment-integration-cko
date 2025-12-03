import nock from 'nock';
import { InstrumentApi } from '../../../src/clients/api/instrument.api';
import { CkoInstrument } from '../../../src/clients/types/instrument.type';
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

describe('InstrumentApi', () => {
  let api: InstrumentApi;
  const baseUrl = 'https://api.sandbox.checkout.com';

  beforeEach(() => {
    api = new InstrumentApi();
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
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

      nock(baseUrl)
        .get(`/instruments/${instrumentId}`)
        .matchHeader('Authorization', 'Bearer test-secret-key')
        .reply(200, mockResponse);

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
      nock(baseUrl).get(`/instruments/${instrumentId}`).reply(401, { error: 'Unauthorized' });

      // Act & Assert
      await expect(api.getInstrument(instrumentId)).rejects.toMatchObject({
        code: 'CkoError-Unauthorized',
        httpErrorStatus: 401,
      });
    });

    it('should throw CkoApiError on 404 not found', async () => {
      // Arrange
      const instrumentId = 'src_test123';
      nock(baseUrl).get(`/instruments/${instrumentId}`).reply(404, { error: 'Not found' });

      // Act & Assert
      await expect(api.getInstrument(instrumentId)).rejects.toMatchObject({
        code: 'CkoError-NotFound',
        httpErrorStatus: 404,
      });
    });

    it('should throw CkoApiError on 500 server error', async () => {
      // Arrange
      const instrumentId = 'src_test123';
      nock(baseUrl).get(`/instruments/${instrumentId}`).reply(500, { error: 'Internal server error' });

      // Act & Assert
      await expect(api.getInstrument(instrumentId)).rejects.toMatchObject({
        code: 'CkoError-InternalError',
        httpErrorStatus: 500,
      });
    });

    it('should handle network errors', async () => {
      // Arrange
      const instrumentId = 'src_test123';
      nock(baseUrl).get(`/instruments/${instrumentId}`).replyWithError('Network error');

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

      nock(baseUrl)
        .delete(`/instruments/${instrumentId}`)
        .matchHeader('Authorization', 'Bearer test-secret-key')
        .reply(204);

      // Act
      await api.deleteInstrument(instrumentId);

      // Assert - no error thrown
      expect(true).toBe(true);
    });

    it('should throw CkoApiError on 401 unauthorized', async () => {
      // Arrange
      const instrumentId = 'src_test123';
      nock(baseUrl).delete(`/instruments/${instrumentId}`).reply(401, { error: 'Unauthorized' });

      // Act & Assert
      await expect(api.deleteInstrument(instrumentId)).rejects.toMatchObject({
        code: 'CkoError-Unauthorized',
        httpErrorStatus: 401,
      });
    });

    it('should throw CkoApiError on 404 not found', async () => {
      // Arrange
      const instrumentId = 'src_test123';
      nock(baseUrl).delete(`/instruments/${instrumentId}`).reply(404, { error: 'Not found' });

      // Act & Assert
      await expect(api.deleteInstrument(instrumentId)).rejects.toMatchObject({
        code: 'CkoError-NotFound',
        httpErrorStatus: 404,
      });
    });

    it('should throw CkoApiError on 500 server error', async () => {
      // Arrange
      const instrumentId = 'src_test123';
      nock(baseUrl).delete(`/instruments/${instrumentId}`).reply(500, { error: 'Internal server error' });

      // Act & Assert
      await expect(api.deleteInstrument(instrumentId)).rejects.toMatchObject({
        code: 'CkoError-InternalError',
        httpErrorStatus: 500,
      });
    });

    it('should handle network errors', async () => {
      // Arrange
      const instrumentId = 'src_test123';
      nock(baseUrl).delete(`/instruments/${instrumentId}`).replyWithError('Network error');

      // Act & Assert
      await expect(api.deleteInstrument(instrumentId)).rejects.toMatchObject({
        code: 'CkoError-InternalError',
        httpErrorStatus: 500,
      });
    });
  });
});
