import {
  AuthorityAuthorizationHook,
  JWTAuthenticationHook,
  Oauth2AuthenticationHook,
  SessionHeaderAuthenticationHook,
} from '@commercetools/connect-payments-sdk';
import Fastify, { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, type Mocked, vi } from 'vitest';
import { CkoConfigHook } from '../../src/libs/fastify/hooks/cko-config.hook';
import { errorHandler } from '../../src/libs/fastify/error-handler';
import { NotImplementedError } from '../../src/errors/cko-api.error';
import { operationsRoute } from '../../src/routes/operation.route';
import { CkoPaymentIntentService } from '../../src/services/cko-payment-intent.service';
import { CkoPaymentService } from '../../src/services/cko-payment.service';
import { TransactionDraftDTO, TransactionResponseDTO } from '../../src/dtos/operations/transaction.dto';

vi.mock('@app/config/config', () => {
  const mockConfigData = {
    projectKey: 'test-project',
    loggerLevel: 'info',
    ckoEnvironment: 'sandbox',
  };

  return {
    config: mockConfigData,
    getConfig: vi.fn(() => mockConfigData),
    hasMultiChannelConfig: vi.fn(() => false),
  };
});

describe('operationsRoute POST /operations/transactions', () => {
  const noopHook = async () => undefined;
  const authenticate = vi.fn(() => noopHook);
  const authorize = vi.fn(() => noopHook);

  const mockPaymentService = {
    handleTransaction: vi.fn(),
  } as unknown as Mocked<CkoPaymentService>;

  const validBody: TransactionDraftDTO = {
    cartId: '3f2b8a52-7f0a-4d7e-9f0e-0b8f5f4f6a11',
    checkoutTransactionItemId: '8a1c1f9e-2b4d-4c53-8a67-1f6a9c3d2e10',
    paymentMethodId: 'c2a5b1d4-9c1e-4f6a-8b7d-5e3f2a1b0c9d',
    idempotencyKey: 'idem-key-1',
    futureOrderNumber: 'order-1',
    type: 'Recurring',
  };

  let fastify: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    fastify = Fastify();
    fastify.setErrorHandler(errorHandler);
    await fastify.register(operationsRoute, {
      prefix: '/operations',
      jwtAuthHook: { authenticate } as unknown as JWTAuthenticationHook,
      oauth2AuthHook: { authenticate } as unknown as Oauth2AuthenticationHook,
      sessionHeaderAuthHook: { authenticate } as unknown as SessionHeaderAuthenticationHook,
      authorizationHook: { authorize } as unknown as AuthorityAuthorizationHook,
      ckoConfigHook: { setConfigKey: vi.fn(() => noopHook) } as unknown as CkoConfigHook,
      paymentService: mockPaymentService,
      paymentIntentService: {} as unknown as CkoPaymentIntentService,
    });
    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  it('should delegate to paymentService.handleTransaction and return 201 with the response', async () => {
    const expected: TransactionResponseDTO = {
      transactionStatus: { state: 'Completed', errors: [] },
      paymentId: 'payment-id',
    };
    mockPaymentService.handleTransaction.mockResolvedValue(expected);

    const response = await fastify.inject({ method: 'POST', url: '/operations/transactions', payload: validBody });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toStrictEqual(expected);
    expect(mockPaymentService.handleTransaction).toHaveBeenCalledWith(validBody);
    expect(authorize).toHaveBeenCalledWith('manage_project', 'manage_checkout_transactions');
  });

  it('should return 400 when the body does not match the schema', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/operations/transactions',
      payload: { ...validBody, type: 'OneOff' },
    });

    expect(response.statusCode).toBe(400);
    expect(mockPaymentService.handleTransaction).not.toHaveBeenCalled();
  });

  it('should return 501 when the transaction handling is not implemented', async () => {
    mockPaymentService.handleTransaction.mockRejectedValue(new NotImplementedError('not implemented'));

    const response = await fastify.inject({ method: 'POST', url: '/operations/transactions', payload: validBody });

    expect(response.statusCode).toBe(501);
    expect(response.json().errors[0].code).toBe('NotImplemented');
  });
});
