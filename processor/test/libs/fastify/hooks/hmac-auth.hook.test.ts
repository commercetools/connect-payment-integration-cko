import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { HmacAuthHook } from '../../../../src/libs/fastify/hooks/hmac-auth.hook';
import { ErrorAuthErrorResponse } from '@commercetools/connect-payments-sdk';
import crypto from 'crypto';

// Mocks
jest.mock('../../../../src/config/config', () => {
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
    getConfig: jest.fn(() => ({
      ...mockConfigData,
      getHmacKey: () => 'test-hmac-key',
    })),
    hasMultiChannelConfig: jest.fn(() => false),
  };
});

jest.mock('@lib/logger', () => ({
  log: {
    debug: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('HmacAuthHook', () => {
  let hook: HmacAuthHook;

  beforeEach(() => {
    jest.clearAllMocks();
    hook = new HmacAuthHook();
  });

  test('should authenticate request with valid HMAC signature', async () => {
    const rawBody = '{"data":{"id":"evt_123"}}';
    const validSignature = crypto.createHmac('sha256', 'test-hmac-key').update(rawBody, 'utf8').digest('hex');

    const request = {
      headers: {
        'cko-signature': validSignature,
      },
      rawBody,
    } as any;

    const authenticateFn = hook.authenticate();
    await expect(authenticateFn(request)).resolves.toBeUndefined();
  });

  test('should throw error when HMAC signature is invalid', async () => {
    const rawBody = '{"data":{"id":"evt_123"}}';
    const invalidSignature = 'invalid-signature-123456789';

    const request = {
      headers: {
        'cko-signature': invalidSignature,
      },
      rawBody,
    } as any;

    const authenticateFn = hook.authenticate();
    await expect(authenticateFn(request)).rejects.toThrow(ErrorAuthErrorResponse);
  });

  test('should throw error when signature header is missing', async () => {
    const request = {
      headers: {},
      rawBody: '{"data":{"id":"evt_123"}}',
    } as any;

    const authenticateFn = hook.authenticate();
    await expect(authenticateFn(request)).rejects.toThrow(ErrorAuthErrorResponse);
  });

  test('should throw error when signature length does not match', async () => {
    const rawBody = '{"data":{"id":"evt_456"}}';
    const shortSignature = 'abc123';

    const request = {
      headers: {
        'cko-signature': shortSignature,
      },
      rawBody,
    } as any;

    const authenticateFn = hook.authenticate();
    await expect(authenticateFn(request)).rejects.toThrow(ErrorAuthErrorResponse);
  });

  test('should handle request with rawBody undefined', async () => {
    const request = {
      headers: {
        'cko-signature': 'some-signature',
      },
    } as any;

    const authenticateFn = hook.authenticate();
    await expect(authenticateFn(request)).rejects.toThrow(ErrorAuthErrorResponse);
  });

  test('should authenticate different payload correctly', async () => {
    const rawBody = '{"type":"payment_approved","data":{"amount":10000}}';
    const validSignature = crypto.createHmac('sha256', 'test-hmac-key').update(rawBody, 'utf8').digest('hex');

    const request = {
      headers: {
        'cko-signature': validSignature,
      },
      rawBody,
    } as any;

    const authenticateFn = hook.authenticate();
    await expect(authenticateFn(request)).resolves.toBeUndefined();
  });

  test('should reject tampered payload with valid signature of different content', async () => {
    const originalBody = '{"data":{"id":"evt_123"}}';
    const tamperedBody = '{"data":{"id":"evt_999"}}';
    const signatureOfOriginal = crypto.createHmac('sha256', 'test-hmac-key').update(originalBody, 'utf8').digest('hex');

    const request = {
      headers: {
        'cko-signature': signatureOfOriginal,
      },
      rawBody: tamperedBody,
    } as any;

    const authenticateFn = hook.authenticate();
    await expect(authenticateFn(request)).rejects.toThrow(ErrorAuthErrorResponse);
  });
});
