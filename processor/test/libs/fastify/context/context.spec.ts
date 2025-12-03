import { describe, test, expect, afterEach, jest, beforeEach } from '@jest/globals';
import { SessionAuthentication, SessionPrincipal } from '@commercetools/connect-payments-sdk';
import * as Context from '../../../../src/libs/fastify/context/context';

describe('context', () => {
  const sessionId: string = '123456-123456-123456-123456';
  const principal: SessionPrincipal = {
    cartId: '123456',
    allowedPaymentMethods: [],
    processorUrl: 'http://127.0.0.1',
    paymentInterface: 'dummyPaymentInterface',
    merchantReturnUrl: 'https://merchant.return.url',
  };

  const mockSessionAuthentication: SessionAuthentication = new SessionAuthentication(sessionId, principal);

  beforeEach(() => {
    jest.setTimeout(10000);
    jest.resetAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('getCtSessionIdFromContext', async () => {
    const mockRequestContext = {
      authentication: mockSessionAuthentication,
    };
    jest.spyOn(Context, 'getRequestContext').mockReturnValue(mockRequestContext);
    const result = Context.getCtSessionIdFromContext();
    expect(result).toStrictEqual(sessionId);
  });

  test('getAllowedPaymentMethodsFromContext', async () => {
    const mockRequestContext = {
      authentication: mockSessionAuthentication,
    };
    jest.spyOn(Context, 'getRequestContext').mockReturnValue(mockRequestContext);
    const result = Context.getAllowedPaymentMethodsFromContext();
    expect(result).toHaveLength(0);
  });

  test('getCartIdFromContext', async () => {
    const mockRequestContext = {
      authentication: mockSessionAuthentication,
    };
    jest.spyOn(Context, 'getRequestContext').mockReturnValue(mockRequestContext);
    const result = Context.getCartIdFromContext();
    expect(result).toStrictEqual('123456');
  });

  test('getMerchantReturnUrlFromContext', async () => {
    const mockRequestContext = {
      authentication: mockSessionAuthentication,
    };
    jest.spyOn(Context, 'getRequestContext').mockReturnValue(mockRequestContext);
    const result = Context.getMerchantReturnUrlFromContext();
    expect(result).toStrictEqual('https://merchant.return.url');
  });

  test('getProcessorUrlFromContext', async () => {
    const mockRequestContext = {
      authentication: mockSessionAuthentication,
    };
    jest.spyOn(Context, 'getRequestContext').mockReturnValue(mockRequestContext);
    const result = Context.getProcessorUrlFromContext();
    expect(result).toStrictEqual('http://127.0.0.1');
  });

  test('getCheckoutTransactionItemIdFromContext', async () => {
    const principalWithTransactionId: SessionPrincipal = {
      ...principal,
      checkoutTransactionItemId: 'transaction-item-123',
    };
    const mockRequestContext = {
      authentication: new SessionAuthentication(sessionId, principalWithTransactionId),
    };
    jest.spyOn(Context, 'getRequestContext').mockReturnValue(mockRequestContext);
    const result = Context.getCheckoutTransactionItemIdFromContext();
    expect(result).toStrictEqual('transaction-item-123');
  });

  test('getFutureOrderNumberFromContext', async () => {
    const principalWithOrderNumber: SessionPrincipal = {
      ...principal,
      futureOrderNumber: 'ORDER-2024-001',
    };
    const mockRequestContext = {
      authentication: new SessionAuthentication(sessionId, principalWithOrderNumber),
    };
    jest.spyOn(Context, 'getRequestContext').mockReturnValue(mockRequestContext);
    const result = Context.getFutureOrderNumberFromContext();
    expect(result).toStrictEqual('ORDER-2024-001');
  });

  test('getCkoConfigKeyFromContext', async () => {
    const mockRequestContext = {
      authentication: mockSessionAuthentication,
      ckoConfigKey: 'custom-cko-key',
    };
    jest.spyOn(Context, 'getRequestContext').mockReturnValue(mockRequestContext);
    const result = Context.getCkoConfigKeyFromContext();
    expect(result).toStrictEqual('custom-cko-key');
  });

  test('getCkoConfigKeyFromContext returns undefined when not set', async () => {
    const mockRequestContext = {
      authentication: mockSessionAuthentication,
    };
    jest.spyOn(Context, 'getRequestContext').mockReturnValue(mockRequestContext);
    const result = Context.getCkoConfigKeyFromContext();
    expect(result).toBeUndefined();
  });
});
