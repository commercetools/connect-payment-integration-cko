import { beforeEach, describe, expect, type Mock, type Mocked, type MockInstance, test, vi } from 'vitest';
import { CkoConfigHook } from '../../../../src/libs/fastify/hooks/cko-config.hook';
import { Cart, CommercetoolsCartService, CommercetoolsOrderService, Order } from '@commercetools/connect-payments-sdk';
import { FastifyRequest } from 'fastify';
import * as Context from '../../../../src/libs/fastify/context/context';

// Mocks
vi.mock('../../../../src/config/config', () => {
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
        channelId: 'test-channel-id',
        publicKey: 'test-public-key',
        secretKey: 'test-secret-key',
        hmacKey: 'test-hmac-key',
      },
    },
  };

  return {
    config: mockConfigData,
    getConfig: vi.fn(() => mockConfigData),
    hasMultiChannelConfig: vi.fn(() => false),
  };
});

vi.mock('@lib/logger', () => ({
  log: {
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('CkoConfigHook', () => {
  let hook: CkoConfigHook;
  let mockCartService: Mocked<CommercetoolsCartService>;
  let mockOrderService: Mocked<CommercetoolsOrderService>;
  let mockUpdateRequestContext: MockInstance<typeof Context.updateRequestContext>;
  let mockGetConfig: Mock;

  const mockCart: Cart = {
    id: 'cart-123',
    version: 1,
    lineItems: [],
    customLineItems: [],
    totalPrice: {
      centAmount: 10000,
      currencyCode: 'USD',
      fractionDigits: 2,
    },
  } as any;

  const mockOrder: Order = {
    id: 'order-456',
    version: 1,
    orderNumber: 'ORDER-001',
    lineItems: [],
    totalPrice: {
      centAmount: 10000,
      currencyCode: 'USD',
      fractionDigits: 2,
    },
  } as any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const configModule = await import('../../../../src/config/config');
    mockGetConfig = configModule.getConfig as Mock;

    mockCartService = {
      getCart: vi.fn(),
      getCartByPaymentId: vi.fn(),
    } as any;

    mockOrderService = {
      getOrderByPaymentId: vi.fn(),
    } as any;

    hook = new CkoConfigHook({
      cartService: mockCartService,
      orderService: mockOrderService,
    });

    mockUpdateRequestContext = vi.spyOn(Context, 'updateRequestContext').mockImplementation(() => {});
  });

  test('should skip resolution when single-channel mode', async () => {
    mockGetConfig.mockReturnValue({
      hasMultiChannelConfig: () => false,
    } as any);

    const request = { url: '/some-endpoint' } as FastifyRequest;

    const hookFn = hook.setConfigKey();
    await hookFn(request);

    expect(mockUpdateRequestContext).toHaveBeenCalledWith({ ckoConfigKey: undefined });
    expect(mockCartService.getCart).not.toHaveBeenCalled();
  });

  test('should use default config when channel key extraction fails', async () => {
    mockGetConfig.mockReturnValue({
      hasMultiChannelConfig: () => true,
      getChannelKey: vi.fn<() => Promise<string>>().mockRejectedValue(new Error('JSONata evaluation failed')),
    } as any);

    vi.spyOn(Context, 'getCartIdFromContext').mockReturnValue('cart-123');
    mockCartService.getCart.mockResolvedValue(mockCart);

    const request = { url: '/some-endpoint' } as FastifyRequest;

    const hookFn = hook.setConfigKey();
    await hookFn(request);

    expect(mockUpdateRequestContext).toHaveBeenCalledWith({ ckoConfigKey: undefined });
  });

  describe('/operations/payment-intents/:id', () => {
    test('should resolve config from cart by payment ID', async () => {
      const channelKey = 'channel-de';
      mockGetConfig.mockReturnValue({
        hasMultiChannelConfig: () => true,
        getChannelKey: vi.fn<() => Promise<string>>().mockResolvedValue(channelKey),
      } as any);

      mockCartService.getCartByPaymentId.mockResolvedValue(mockCart);

      const request = {
        url: '/operations/payment-intents/payment-789',
        params: { id: 'payment-789' },
      } as any;

      const hookFn = hook.setConfigKey();
      await hookFn(request);

      expect(mockCartService.getCartByPaymentId).toHaveBeenCalledWith({ paymentId: 'payment-789' });
      expect(mockUpdateRequestContext).toHaveBeenCalledWith({ ckoConfigKey: channelKey });
    });

    test('should fallback to order when cart not found', async () => {
      const channelKey = 'channel-fr';
      mockGetConfig.mockReturnValue({
        hasMultiChannelConfig: () => true,
        getChannelKey: vi.fn<() => Promise<string>>().mockResolvedValue(channelKey),
      } as any);

      mockCartService.getCartByPaymentId.mockRejectedValue(new Error('Cart not found'));
      mockOrderService.getOrderByPaymentId.mockResolvedValue(mockOrder);

      const request = {
        url: '/operations/payment-intents/payment-789',
        params: { id: 'payment-789' },
      } as any;

      const hookFn = hook.setConfigKey();
      await hookFn(request);

      expect(mockCartService.getCartByPaymentId).toHaveBeenCalledWith({ paymentId: 'payment-789' });
      expect(mockOrderService.getOrderByPaymentId).toHaveBeenCalledWith({ paymentId: 'payment-789' });
      expect(mockUpdateRequestContext).toHaveBeenCalledWith({ ckoConfigKey: channelKey });
    });

    test('should use default config when neither cart nor order found', async () => {
      mockGetConfig.mockReturnValue({
        hasMultiChannelConfig: () => true,
        getChannelKey: vi.fn<() => Promise<string>>(),
      } as any);

      mockCartService.getCartByPaymentId.mockRejectedValue(new Error('Cart not found'));
      mockOrderService.getOrderByPaymentId.mockRejectedValue(new Error('Order not found'));

      const request = {
        url: '/operations/payment-intents/payment-999',
        params: { id: 'payment-999' },
      } as any;

      const hookFn = hook.setConfigKey();
      await hookFn(request);

      expect(mockUpdateRequestContext).toHaveBeenCalledWith({ ckoConfigKey: undefined });
    });

    test('should handle missing payment ID in params', async () => {
      mockGetConfig.mockReturnValue({
        hasMultiChannelConfig: () => true,
        getChannelKey: vi.fn<() => Promise<string>>(),
      } as any);

      const request = {
        url: '/operations/payment-intents/undefined',
        params: {},
      } as any;

      const hookFn = hook.setConfigKey();
      await hookFn(request);

      expect(mockCartService.getCartByPaymentId).not.toHaveBeenCalled();
      expect(mockUpdateRequestContext).toHaveBeenCalledWith({ ckoConfigKey: undefined });
    });
  });

  describe('/notifications', () => {
    test('should resolve config from payment_id in metadata', async () => {
      const channelKey = 'channel-es';
      mockGetConfig.mockReturnValue({
        hasMultiChannelConfig: () => true,
        getChannelKey: vi.fn<() => Promise<string>>().mockResolvedValue(channelKey),
      } as any);

      mockCartService.getCartByPaymentId.mockResolvedValue(mockCart);

      const request = {
        url: '/notifications',
        body: {
          data: {
            id: 'evt-123',
            metadata: {
              payment_id: 'payment-456',
            },
          },
        },
      } as any;

      const hookFn = hook.setConfigKey();
      await hookFn(request);

      expect(mockCartService.getCartByPaymentId).toHaveBeenCalledWith({ paymentId: 'payment-456' });
      expect(mockUpdateRequestContext).toHaveBeenCalledWith({ ckoConfigKey: channelKey });
    });

    test('should fallback to reference when payment_id not in metadata', async () => {
      const channelKey = 'channel-it';
      mockGetConfig.mockReturnValue({
        hasMultiChannelConfig: () => true,
        getChannelKey: vi.fn<() => Promise<string>>().mockResolvedValue(channelKey),
      } as any);

      mockCartService.getCartByPaymentId.mockResolvedValue(mockCart);

      const request = {
        url: '/notifications',
        body: {
          data: {
            id: 'evt-789',
            reference: 'payment-ref-123',
            metadata: {},
          },
        },
      } as any;

      const hookFn = hook.setConfigKey();
      await hookFn(request);

      expect(mockCartService.getCartByPaymentId).toHaveBeenCalledWith({ paymentId: 'payment-ref-123' });
      expect(mockUpdateRequestContext).toHaveBeenCalledWith({ ckoConfigKey: channelKey });
    });
  });

  describe('session context requests', () => {
    test('should resolve config from session cart', async () => {
      const channelKey = 'channel-nl';
      mockGetConfig.mockReturnValue({
        hasMultiChannelConfig: () => true,
        getChannelKey: vi.fn<() => Promise<string>>().mockResolvedValue(channelKey),
      } as any);

      vi.spyOn(Context, 'getCartIdFromContext').mockReturnValue('cart-session-123');
      mockCartService.getCart.mockResolvedValue(mockCart);

      const request = {
        url: '/operations/payment-sessions',
      } as any;

      const hookFn = hook.setConfigKey();
      await hookFn(request);

      expect(mockCartService.getCart).toHaveBeenCalledWith({ id: 'cart-session-123' });
      expect(mockUpdateRequestContext).toHaveBeenCalledWith({ ckoConfigKey: channelKey });
    });

    test('should use default config when cart ID not in context', async () => {
      mockGetConfig.mockReturnValue({
        hasMultiChannelConfig: () => true,
        getChannelKey: vi.fn<() => Promise<string>>(),
      } as any);

      vi.spyOn(Context, 'getCartIdFromContext').mockReturnValue(undefined as any);

      const request = {
        url: '/operations/payment-sessions',
      } as any;

      const hookFn = hook.setConfigKey();
      await hookFn(request);

      expect(mockCartService.getCart).not.toHaveBeenCalled();
      expect(mockUpdateRequestContext).toHaveBeenCalledWith({ ckoConfigKey: undefined });
    });

    test('should use default config when cart retrieval fails', async () => {
      mockGetConfig.mockReturnValue({
        hasMultiChannelConfig: () => true,
        getChannelKey: vi.fn<() => Promise<string>>(),
      } as any);

      vi.spyOn(Context, 'getCartIdFromContext').mockReturnValue('cart-invalid');
      mockCartService.getCart.mockRejectedValue(new Error('Cart not found'));

      const request = {
        url: '/operations/payment-sessions',
      } as any;

      const hookFn = hook.setConfigKey();
      await hookFn(request);

      expect(mockUpdateRequestContext).toHaveBeenCalledWith({ ckoConfigKey: undefined });
    });
  });
});
