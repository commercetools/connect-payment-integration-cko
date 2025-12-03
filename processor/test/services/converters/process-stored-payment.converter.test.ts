import { ProcessStoredPaymentConverter } from '../../../src/services/converters/process-stored-payment.converter';
import { Address, Cart, Payment, PaymentMethod } from '@commercetools/connect-payments-sdk';
import { getConfig } from '../../../src/config/config';
import {
  getCtSessionIdFromContext,
  getFutureOrderNumberFromContext,
  getProcessorUrlFromContext,
  getRequestContext,
} from '../../../src/libs/fastify/context/context';
import { paymentSDK } from '../../../src/payment-sdk';
import { CkoPaymentResponse } from '../../../src/clients/types/payment.type';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

// Mocks
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
        channelId: 'test-channel-id',
        publicKey: 'test-public-key',
        secretKey: 'test-secret-key',
        hmacKey: 'test-hmac-key',
      },
    },
  };

  return {
    config: mockConfigData,
    getConfig: jest.fn(() => mockConfigData),
    hasMultiChannelConfig: jest.fn(() => false),
  };
});

jest.mock('@lib/fastify/context/context', () => {
  const mockRequestContextData = {
    correlationId: 'test-correlation-id',
    pathTemplate: '/test-path',
    path: '/test-path',
  };

  return {
    getRequestContext: jest.fn(() => mockRequestContextData),
    getCtSessionIdFromContext: jest.fn(),
    getFutureOrderNumberFromContext: jest.fn(),
    getProcessorUrlFromContext: jest.fn(),
    getCkoConfigKeyFromContext: jest.fn(),
  };
});
jest.mock('../../../src/payment-sdk');
jest.mock('../../../src/services/converters/helper.converter', () => ({
  convertAddress: jest.fn((address: Address) => ({ country: address?.country || 'US', address_line1: 'Mock St' })),
  convertCartItems: jest.fn(() => [{ name: 'Item 1', quantity: 1, unit_price: 10000, total_amount: 10000 }]),
  convertEnableCapture: jest.fn(() => ({ capture: true })),
}));

const mockGetConfig = getConfig as jest.MockedFunction<typeof getConfig>;
const mockGetCtSessionIdFromContext = getCtSessionIdFromContext as jest.MockedFunction<
  typeof getCtSessionIdFromContext
>;
const mockGetFutureOrderNumberFromContext = getFutureOrderNumberFromContext as jest.MockedFunction<
  typeof getFutureOrderNumberFromContext
>;
const mockGetProcessorUrlFromContext = getProcessorUrlFromContext as jest.MockedFunction<
  typeof getProcessorUrlFromContext
>;
const mockGetRequestContext = getRequestContext as jest.MockedFunction<typeof getRequestContext>;

describe('ProcessStoredPaymentConverter', () => {
  let converter: ProcessStoredPaymentConverter;

  const mockCart: Cart = {
    id: 'cart-123',
    version: 1,
    lineItems: [],
    customLineItems: [],
    billingAddress: {
      country: 'US',
      streetName: '123 Main St',
      city: 'New York',
      postalCode: '10001',
    },
    customerEmail: 'test@example.com',
    customerId: 'customer-456',
  } as unknown as Cart;

  const mockPayment: Payment = {
    id: 'payment-789',
    version: 1,
    amountPlanned: {
      centAmount: 10000,
      currencyCode: 'USD',
      fractionDigits: 2,
    },
  } as unknown as Payment;

  const mockPaymentMethod: PaymentMethod = {
    id: 'pm-123',
    version: 1,
    method: 'card',
    createdAt: '2024-01-01T00:00:00Z',
    default: true,
  } as unknown as PaymentMethod;

  beforeEach(() => {
    converter = new ProcessStoredPaymentConverter();
    jest.clearAllMocks();

    mockGetConfig.mockReturnValue({
      getChannelId: () => 'channel-id-123',
      getEnableThreeDS: () => true,
    } as unknown as ReturnType<typeof getConfig>);

    mockGetCtSessionIdFromContext.mockReturnValue('ct-session-id');
    mockGetFutureOrderNumberFromContext.mockReturnValue('ORDER-2024-001');
    mockGetProcessorUrlFromContext.mockReturnValue('https://processor.example.com');
    mockGetRequestContext.mockReturnValue({ correlationId: 'corr-id-123' } as unknown as ReturnType<
      typeof getRequestContext
    >);

    (paymentSDK.ctCartService.getOneShippingAddress as jest.Mock) = jest.fn(() => ({
      country: 'US',
      streetName: '456 Oak Ave',
      city: 'Los Angeles',
      postalCode: '90001',
    }));
  });

  describe('convertRequest', () => {
    test('should convert complete stored payment request', () => {
      const token = 'src_card_token_xyz';

      const result = converter.convertRequest({
        token,
        cart: mockCart,
        payment: mockPayment,
        paymentMethod: mockPaymentMethod,
      });

      expect(result).toMatchObject({
        processing_channel_id: 'channel-id-123',
        amount: 10000,
        currency: 'USD',
        source: {
          type: 'id',
          id: 'src_card_token_xyz',
        },
        reference: 'payment-789',
        payment_type: 'Regular',
      });
    });

    test('should include billing address', () => {
      const token = 'src_token_123';

      const result = converter.convertRequest({
        token,
        cart: mockCart,
        payment: mockPayment,
        paymentMethod: mockPaymentMethod,
      });

      expect(result.billing).toEqual({
        address: { country: 'US', address_line1: 'Mock St' },
      });
    });

    test('should include shipping address when available', () => {
      const token = 'src_token_456';

      const result = converter.convertRequest({
        token,
        cart: mockCart,
        payment: mockPayment,
        paymentMethod: mockPaymentMethod,
      });

      expect(result.shipping).toEqual({
        address: { country: 'US', address_line1: 'Mock St' },
      });
    });

    test('should omit shipping when no shipping address', () => {
      (paymentSDK.ctCartService.getOneShippingAddress as jest.Mock).mockReturnValue(undefined);
      const token = 'src_token_789';

      const result = converter.convertRequest({
        token,
        cart: mockCart,
        payment: mockPayment,
        paymentMethod: mockPaymentMethod,
      });

      expect(result.shipping).toBeUndefined();
    });

    test('should include customer email when available', () => {
      const token = 'src_token_abc';

      const result = converter.convertRequest({
        token,
        cart: mockCart,
        payment: mockPayment,
        paymentMethod: mockPaymentMethod,
      });

      expect(result.customer).toEqual({
        email: 'test@example.com',
      });
    });

    test('should omit customer when no email', () => {
      const cartWithoutEmail = { ...mockCart, customerEmail: undefined };
      const token = 'src_token_def';

      const result = converter.convertRequest({
        token,
        cart: cartWithoutEmail,
        payment: mockPayment,
        paymentMethod: mockPaymentMethod,
      });

      expect(result.customer).toBeUndefined();
    });

    test('should include 3DS configuration', () => {
      const token = 'src_token_3ds';

      const result = converter.convertRequest({
        token,
        cart: mockCart,
        payment: mockPayment,
        paymentMethod: mockPaymentMethod,
      });

      expect(result['3ds']).toEqual({ enabled: true });
    });

    test('should disable 3DS when config is false', () => {
      mockGetConfig.mockReturnValue({
        getChannelId: () => 'channel-id-123',
        getEnableThreeDS: () => false,
      } as unknown as ReturnType<typeof getConfig>);

      const token = 'src_token_no3ds';

      const result = converter.convertRequest({
        token,
        cart: mockCart,
        payment: mockPayment,
        paymentMethod: mockPaymentMethod,
      });

      expect(result['3ds']).toEqual({ enabled: false });
    });

    test('should include complete metadata with payment_method_id', () => {
      const token = 'src_token_metadata';

      const result = converter.convertRequest({
        token,
        cart: mockCart,
        payment: mockPayment,
        paymentMethod: mockPaymentMethod,
      });

      expect(result.metadata).toEqual({
        correlation_id: 'corr-id-123',
        cart_id: 'cart-123',
        payment_id: 'payment-789',
        payment_method_id: 'pm-123',
        customer_id: 'customer-456',
        merchant_order_reference: 'ORDER-2024-001',
      });
    });

    test('should omit customer_id from metadata when not available', () => {
      const cartWithoutCustomerId = { ...mockCart, customerId: undefined };
      const token = 'src_token_nocustid';

      const result = converter.convertRequest({
        token,
        cart: cartWithoutCustomerId,
        payment: mockPayment,
        paymentMethod: mockPaymentMethod,
      });

      expect(result.metadata).not.toHaveProperty('customer_id');
    });

    test('should omit merchant_order_reference when future order number is undefined', () => {
      mockGetFutureOrderNumberFromContext.mockReturnValue(undefined);
      const token = 'src_token_noorder';

      const result = converter.convertRequest({
        token,
        cart: mockCart,
        payment: mockPayment,
        paymentMethod: mockPaymentMethod,
      });

      expect(result.metadata).not.toHaveProperty('merchant_order_reference');
    });

    test('should include integration information', () => {
      const token = 'src_token_integration';

      const result = converter.convertRequest({
        token,
        cart: mockCart,
        payment: mockPayment,
        paymentMethod: mockPaymentMethod,
      });

      expect(result.integration).toEqual({
        external_platform: {
          name: 'Commercetools',
          version: '1.0.0',
        },
      });
    });

    test('should include success and failure URLs with payment method id', () => {
      const token = 'src_token_urls';

      const result = converter.convertRequest({
        token,
        cart: mockCart,
        payment: mockPayment,
        paymentMethod: mockPaymentMethod,
      });

      expect(result.success_url).toBe(
        'https://processor.example.com/stored-payment-methods/pm-123/payments/confirm?paymentReference=payment-789&ctsid=ct-session-id&success=true',
      );
      expect(result.failure_url).toBe(
        'https://processor.example.com/stored-payment-methods/pm-123/payments/confirm?paymentReference=payment-789&ctsid=ct-session-id&success=false',
      );
    });

    test('should include cart items', () => {
      const token = 'src_token_items';

      const result = converter.convertRequest({
        token,
        cart: mockCart,
        payment: mockPayment,
        paymentMethod: mockPaymentMethod,
      });

      expect(result.items).toEqual([{ name: 'Item 1', quantity: 1, unit_price: 10000, total_amount: 10000 }]);
    });

    test('should include capture configuration', () => {
      const token = 'src_token_capture';

      const result = converter.convertRequest({
        token,
        cart: mockCart,
        payment: mockPayment,
        paymentMethod: mockPaymentMethod,
      });

      expect(result.capture).toBe(true);
    });

    test('should use source type id with provided token', () => {
      const token = 'src_custom_token_12345';

      const result = converter.convertRequest({
        token,
        cart: mockCart,
        payment: mockPayment,
        paymentMethod: mockPaymentMethod,
      });

      expect(result.source).toEqual({
        type: 'id',
        id: 'src_custom_token_12345',
      });
    });
  });

  describe('convertResponse', () => {
    test('should convert basic payment response', () => {
      const responseData: CkoPaymentResponse = {
        id: 'pay_123',
        status: 'Authorized',
        source: {
          type: 'card',
        },
      } as unknown as CkoPaymentResponse;

      const result = converter.convertResponse({ responseData, payment: mockPayment });

      expect(result).toEqual({
        id: 'pay_123',
        status: 'Authorized',
        paymentReference: 'payment-789',
        type: 'card',
      });
    });

    test('should include redirect action for 3DS card payments', () => {
      const responseData: CkoPaymentResponse = {
        id: 'pay_3ds',
        status: 'Pending',
        source: {
          type: 'card',
        },
        _links: {
          redirect: {
            href: 'https://3ds.example.com/challenge',
          },
        },
      } as unknown as CkoPaymentResponse;

      const result = converter.convertResponse({ responseData, payment: mockPayment });

      expect(result).toEqual({
        id: 'pay_3ds',
        status: 'Pending',
        paymentReference: 'payment-789',
        type: 'card',
        action: {
          type: '3ds',
          url: 'https://3ds.example.com/challenge',
        },
      });
    });

    test('should handle declined payment response', () => {
      const responseData: CkoPaymentResponse = {
        id: 'pay_declined',
        status: 'Declined',
        source: {
          type: 'card',
        },
        response_code: '20051',
        response_summary: 'Insufficient Funds',
      } as unknown as CkoPaymentResponse;

      const result = converter.convertResponse({ responseData, payment: mockPayment });

      expect(result).toMatchObject({
        id: 'pay_declined',
        status: 'Declined',
        paymentReference: 'payment-789',
        type: 'card',
      });
    });
  });
});
