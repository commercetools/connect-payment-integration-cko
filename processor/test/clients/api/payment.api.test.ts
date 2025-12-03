import nock from 'nock';
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

describe('PaymentApi', () => {
  let api: PaymentApi;
  const baseUrl = 'https://api.sandbox.checkout.com';

  beforeEach(() => {
    api = new PaymentApi();
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('createPayment', () => {
    it('should successfully create a payment', async () => {
      // Arrange
      const mockRequest = {} as unknown as CkoPaymentRequest;
      const mockResponse = {
        id: 'pay_test123',
        status: 'Authorized',
      } as unknown as CkoPaymentResponse;

      nock(baseUrl).post('/payments').matchHeader('Authorization', 'Bearer test-secret-key').reply(200, mockResponse);

      // Act
      const result = await api.createPayment(mockRequest);

      // Assert
      expect(result.id).toBe('pay_test123');
    });

    it('should throw CkoApiError on error', async () => {
      // Arrange
      const mockRequest = {} as unknown as CkoPaymentRequest;
      nock(baseUrl).post('/payments').reply(422, { error: 'Invalid data' });

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

      nock(baseUrl)
        .get(`/payments/${paymentId}`)
        .matchHeader('Authorization', 'Bearer test-secret-key')
        .reply(200, mockResponse);

      // Act
      const result = await api.getPayment(paymentId);

      // Assert
      expect(result.id).toBe(paymentId);
    });

    it('should throw CkoApiError on 404', async () => {
      // Arrange
      const paymentId = 'pay_test123';
      nock(baseUrl).get(`/payments/${paymentId}`).reply(404, { error: 'Not found' });

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

      nock(baseUrl)
        .post(`/payments/${paymentId}/voids`)
        .matchHeader('Authorization', 'Bearer test-secret-key')
        .reply(200, mockResponse);

      // Act
      const result = await api.voidPayment(paymentId, mockRequest);

      // Assert
      expect(result.action_id).toBe('act_test123');
    });

    it('should throw CkoApiError on error', async () => {
      // Arrange
      const paymentId = 'pay_test123';
      const mockRequest = {} as unknown as CkoVoidPaymentRequest;
      nock(baseUrl).post(`/payments/${paymentId}/voids`).reply(422, { error: 'Invalid data' });

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

      nock(baseUrl)
        .post(`/payments/${paymentId}/reversals`)
        .matchHeader('Authorization', 'Bearer test-secret-key')
        .reply(200, mockResponse);

      // Act
      const result = await api.reversePayment(paymentId, mockRequest);

      // Assert
      expect(result.action_id).toBe('act_test123');
    });

    it('should throw CkoApiError on error', async () => {
      // Arrange
      const paymentId = 'pay_test123';
      const mockRequest = {} as unknown as CkoReversePaymentRequest;
      nock(baseUrl).post(`/payments/${paymentId}/reversals`).reply(422, { error: 'Invalid data' });

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

      nock(baseUrl)
        .post(`/payments/${paymentId}/captures`)
        .matchHeader('Authorization', 'Bearer test-secret-key')
        .reply(200, mockResponse);

      // Act
      const result = await api.capturePayment(paymentId, mockRequest);

      // Assert
      expect(result.action_id).toBe('act_test123');
    });

    it('should throw CkoApiError on error', async () => {
      // Arrange
      const paymentId = 'pay_test123';
      const mockRequest = {} as unknown as CkoCapturePaymentRequest;
      nock(baseUrl).post(`/payments/${paymentId}/captures`).reply(422, { error: 'Invalid data' });

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

      nock(baseUrl)
        .post(`/payments/${paymentId}/refunds`)
        .matchHeader('Authorization', 'Bearer test-secret-key')
        .reply(200, mockResponse);

      // Act
      const result = await api.refundPayment(paymentId, mockRequest);

      // Assert
      expect(result.action_id).toBe('act_test123');
    });

    it('should throw CkoApiError on error', async () => {
      // Arrange
      const paymentId = 'pay_test123';
      const mockRequest = {} as unknown as CkoRefundPaymentRequest;
      nock(baseUrl).post(`/payments/${paymentId}/refunds`).reply(422, { error: 'Invalid data' });

      // Act & Assert
      await expect(api.refundPayment(paymentId, mockRequest)).rejects.toMatchObject({
        code: 'CkoError-InvalidData',
        httpErrorStatus: 422,
      });
    });
  });
});
