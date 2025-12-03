import { CreatePaymentSessionConverter } from '../../../src/services/converters/create-payment-session.converter';
import { Address, Cart, Payment } from '@commercetools/connect-payments-sdk';
import {
  getCtSessionIdFromContext,
  getFutureOrderNumberFromContext,
  getProcessorUrlFromContext,
  getRequestContext,
} from '../../../src/libs/fastify/context/context';
import { paymentSDK } from '../../../src/payment-sdk';
import { PaymentSessionResponse } from '../../../src/clients/types/payment-session.type';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { getConfig } from '../../../src/config/config';

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
jest.mock('@app/payment-sdk');
jest.mock('@app/helpers/method-name.helper', () => ({
  convertAllowedPaymentMethodsToCkoFormat: jest.fn(() => ['card', 'paypal']),
}));
jest.mock('../../../src/services/converters/helper.converter', () => ({
  convertAddress: jest.fn((address: Address) => ({
    country: address?.country || 'US',
    address_line1: address?.streetName || 'Mock St',
    city: address?.city || 'Mock City',
    zip: address?.postalCode || '12345',
  })),
  convertCartItems: jest.fn(() => [{ name: 'Mock Item', quantity: 1, unit_price: 10000, total_amount: 10000 }]),
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

describe('CreatePaymentSessionConverter', () => {
  let converter: CreatePaymentSessionConverter;
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

  beforeEach(() => {
    converter = new CreatePaymentSessionConverter();
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
    test('should convert complete payment session request with all fields', () => {
      const requestData = { locale: 'en-US' };

      const result = converter.convertRequest({ data: requestData, cart: mockCart, payment: mockPayment });

      // Verify complete structure in one assertion
      expect(result).toEqual({
        processing_channel_id: 'channel-id-123',
        amount: 10000,
        currency: 'USD',
        reference: 'payment-789',
        locale: 'en-US',
        billing: { address: { country: 'US', address_line1: '123 Main St', city: 'New York', zip: '10001' } },
        shipping: { address: { country: 'US', address_line1: '456 Oak Ave', city: 'Los Angeles', zip: '90001' } },
        capture: true,
        success_url:
          'https://processor.example.com/payment-sessions/confirm?paymentReference=payment-789&ctsid=ct-session-id&success=true',
        failure_url:
          'https://processor.example.com/payment-sessions/confirm?paymentReference=payment-789&ctsid=ct-session-id&success=false',
        payment_type: 'Regular',
        customer: { email: 'test@example.com' },
        '3ds': { enabled: true },
        metadata: {
          correlation_id: 'corr-id-123',
          cart_id: 'cart-123',
          payment_id: 'payment-789',
          customer_id: 'customer-456',
          merchant_order_reference: 'ORDER-2024-001',
        },
        integration: {
          external_platform: { name: 'Commercetools', version: '1.0.0' },
        },
        items: [{ name: 'Mock Item', quantity: 1, unit_price: 10000, total_amount: 10000 }],
        enabled_payment_methods: ['card', 'paypal'],
      });
    });

    test('should use default locale when not provided', () => {
      const result = converter.convertRequest({ data: {}, cart: mockCart, payment: mockPayment });
      expect(result.locale).toBe('en-GB');
    });

    test('should handle optional fields - no shipping address', () => {
      (paymentSDK.ctCartService.getOneShippingAddress as jest.Mock).mockReturnValue(undefined);

      const result = converter.convertRequest({ data: {}, cart: mockCart, payment: mockPayment });

      expect(result.shipping).toBeUndefined();
    });

    test('should handle optional fields - no customer email', () => {
      const cartWithoutEmail = { ...mockCart, customerEmail: undefined };

      const result = converter.convertRequest({ data: {}, cart: cartWithoutEmail, payment: mockPayment });

      expect(result.customer).toBeUndefined();
    });

    test('should handle optional metadata fields', () => {
      const cartWithoutCustomerId = { ...mockCart, customerId: undefined };
      mockGetFutureOrderNumberFromContext.mockReturnValue(undefined);

      const result = converter.convertRequest({ data: {}, cart: cartWithoutCustomerId, payment: mockPayment });

      expect(result.metadata).toEqual({
        correlation_id: 'corr-id-123',
        cart_id: 'cart-123',
        payment_id: 'payment-789',
      });
      expect(result.metadata).not.toHaveProperty('customer_id');
      expect(result.metadata).not.toHaveProperty('merchant_order_reference');
    });

    test('should respect 3DS configuration from config', () => {
      mockGetConfig.mockReturnValue({
        getChannelId: () => 'channel-id-123',
        getEnableThreeDS: () => false,
      } as unknown as ReturnType<typeof getConfig>);

      const result = converter.convertRequest({ data: {}, cart: mockCart, payment: mockPayment });

      expect(result['3ds']).toEqual({ enabled: false });
    });
  });

  describe('convertResponse', () => {
    test('should convert payment session response with all fields', () => {
      const responseData: PaymentSessionResponse = {
        id: 'session-789',
        session_secret: 'secret-def',
        amount: 15000,
        currency: 'EUR',
        status: 'pending',
        _links: {
          redirect: { href: 'https://redirect.example.com' },
          self: { href: 'https://api.checkout.com/sessions/session-789' },
        },
      } as unknown as PaymentSessionResponse;

      const result = converter.convertResponse({ responseData, payment: mockPayment });

      expect(result).toEqual({
        ...responseData,
        paymentReference: 'payment-789',
      });
    });
  });
});
