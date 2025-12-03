import {
  Cart,
  CommercetoolsCartService,
  CommercetoolsPaymentMethodService,
  CommercetoolsPaymentService,
  Payment,
  PaymentMethod,
  PaymentMethodPagedQueryResponse,
} from '@commercetools/connect-payments-sdk';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { CkoStoredPaymentMethodService } from '../../src/services/cko-stored-payment-method.service';
import { getCkoApiClient } from '../../src/clients/cko.client';
import { CkoApi } from '../../src/clients/api/cko.api';
import { InstrumentApi } from '../../src/clients/api/instrument.api';
import { CkoInstrument } from '../../src/clients/types/instrument.type';
import { CkoPaymentRequest, CkoPaymentResponse } from '../../src/clients/types/payment.type';
import { PaymentApi } from '../../src/clients/api/payment.api';
import { ProcessStoredPaymentConverter } from '../../src/services/converters/process-stored-payment.converter';
import { GetStoredPaymentMethodsConverter } from '../../src/services/converters/get-stored-payment-methods.converter';
import { ProcessStoredPaymentResponseDTO } from '../../src/dtos/stored-payment-methods.dto';

jest.mock('@app/config/config', () => {
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

jest.mock('@app/clients/cko.client');
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
    getCartIdFromContext: jest.fn(() => 'cart-id'),
    getMerchantReturnUrlFromContext: jest.fn(),
  };
});

describe('CkoStoredPaymentMethodService', () => {
  const mockCartService = {
    getCart: jest.fn(),
  } as unknown as jest.Mocked<CommercetoolsCartService>;

  const mockPaymentService = {
    createPayment: jest.fn(),
    getPayment: jest.fn(),
    updatePayment: jest.fn(),
  } as unknown as jest.Mocked<CommercetoolsPaymentService>;

  const mockPaymentMethodService = {
    find: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<CommercetoolsPaymentMethodService>;

  const mockProcessStoredPaymentConverter = {
    convertRequest: jest.fn(),
    convertResponse: jest.fn(),
  } as unknown as ProcessStoredPaymentConverter;

  const service = new CkoStoredPaymentMethodService({
    ctCartService: mockCartService,
    ctPaymentService: mockPaymentService,
    ctPaymentMethodService: mockPaymentMethodService,
    getStoredPaymentMethodsConverter: new GetStoredPaymentMethodsConverter(),
    processStoredPaymentConverter: mockProcessStoredPaymentConverter,
  });

  const mockInstrumentApi = new InstrumentApi();
  const mockPaymentApi = new PaymentApi();
  const mockGetCkoApiClient = getCkoApiClient as jest.MockedFunction<typeof getCkoApiClient>;
  const mockCkoClient = {
    instruments: mockInstrumentApi,
    payments: mockPaymentApi,
  } as unknown as CkoApi;

  mockGetCkoApiClient.mockReturnValue(mockCkoClient);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getStoredPaymentMethods', () => {
    it('should return all stored payment methods for a customer', async () => {
      // Arrange
      const mockCart = {
        id: 'cart-id',
        customerId: 'customer-id',
      } as Cart;

      const mockStoredPaymentMethods = [
        {
          id: 'spm-1',
          method: 'card',
          token: {
            value: 'token-1',
          },
        } as unknown as PaymentMethod,
      ];

      const mockInstrument = {
        id: 'token-1',
        type: 'card',
        scheme: 'Visa',
        last4: '4242',
        expiry_month: 12,
        expiry_year: 2025,
      } as CkoInstrument;

      jest.spyOn(mockCartService, 'getCart').mockResolvedValue(mockCart);
      jest
        .spyOn(mockPaymentMethodService, 'find')
        .mockResolvedValue({ results: mockStoredPaymentMethods } as PaymentMethodPagedQueryResponse);
      jest.spyOn(mockInstrumentApi, 'getInstrument').mockResolvedValue(mockInstrument);

      // Act
      const result = await service.getStoredPaymentMethods();

      // Assert
      expect(result.storedPaymentMethods).toHaveLength(1);

      expect(result.storedPaymentMethods[0]).toMatchObject({
        id: 'spm-1',
        type: 'card',
        displayOptions: {
          brand: {
            key: 'Visa',
          },
          endDigits: '4242',
          expiryMonth: 12,
          expiryYear: 2025,
        },
      });
    });

    it('should return empty array when no payment methods found', async () => {
      // Arrange
      const mockCart = {
        id: 'cart-id',
        customerId: 'customer-id',
      } as Cart;

      jest.spyOn(mockCartService, 'getCart').mockResolvedValue(mockCart);
      jest.spyOn(mockPaymentMethodService, 'find').mockResolvedValue({
        results: [],
        limit: 20,
        offset: 0,
        count: 0,
      } as unknown as PaymentMethodPagedQueryResponse);

      // Act
      const result = await service.getStoredPaymentMethods();

      // Assert
      expect(result.storedPaymentMethods).toHaveLength(0);
    });

    it('should filter out payment methods without CKO instruments', async () => {
      // Arrange
      const mockCart = {
        id: 'cart-id',
        customerId: 'customer-id',
      } as Cart;

      const mockStoredPaymentMethods = [
        {
          id: 'spm-1',
          method: 'card',
          token: {
            value: 'token-1',
          },
        } as unknown as PaymentMethod,
        {
          id: 'spm-2',
          method: 'card',
          token: {
            value: 'token-2',
          },
        } as unknown as PaymentMethod,
      ];

      const mockInstrument = {
        id: 'token-1',
        type: 'card',
        scheme: 'Visa',
        last4: '4242',
        expiry_month: 12,
        expiry_year: 2025,
      } as CkoInstrument;

      jest.spyOn(mockCartService, 'getCart').mockResolvedValue(mockCart);
      jest
        .spyOn(mockPaymentMethodService, 'find')
        .mockResolvedValue({ results: mockStoredPaymentMethods } as PaymentMethodPagedQueryResponse);
      jest
        .spyOn(mockInstrumentApi, 'getInstrument')
        .mockResolvedValueOnce(mockInstrument)
        .mockRejectedValueOnce(new Error('Instrument not found'));

      // Act
      const result = await service.getStoredPaymentMethods();

      // Assert
      expect(result.storedPaymentMethods).toHaveLength(1);
      expect(result.storedPaymentMethods[0].id).toBe('spm-1');
    });
  });

  describe('processStoredPayment', () => {
    it('should process stored payment with Authorized status', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-id',
        version: 1,
        amountPlanned: {
          centAmount: 1000,
          currencyCode: 'EUR',
        },
      } as Payment;

      const mockCart: Cart = {
        id: 'cart-id',

        customerId: 'customer-id',
      } as Cart;

      const mockPaymentMethod = {
        id: 'spm-1',
        version: 1,
        method: 'card',
        token: {
          value: 'token-1',
        },
      } as unknown as PaymentMethod;

      const mockCkoResponse = {
        id: 'cko-payment-id',
        status: 'Authorized',
        amount: 1000,
        currency: 'EUR',
      } as unknown as CkoPaymentResponse;

      const mockUpdatedPayment = {
        id: 'payment-id',
        version: 2,
      } as Payment;

      jest.spyOn(mockPaymentService, 'getPayment').mockResolvedValue(mockPayment);
      jest.spyOn(mockCartService, 'getCart').mockResolvedValue(mockCart);
      jest.spyOn(mockPaymentMethodService, 'get').mockResolvedValue(mockPaymentMethod);
      jest.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);
      jest.spyOn(mockPaymentApi, 'createPayment').mockResolvedValue(mockCkoResponse);
      jest.spyOn(mockProcessStoredPaymentConverter, 'convertRequest').mockReturnValue({
        amount: 1000,
        currency: 'EUR',
        source: {
          type: 'id',
          id: 'token-1',
        },
      } as CkoPaymentRequest);
      jest.spyOn(mockProcessStoredPaymentConverter, 'convertResponse').mockReturnValue({
        status: 'Authorized',
      } as ProcessStoredPaymentResponseDTO);

      // Act
      const result = await service.processStoredPayment('spm-1', {
        data: { paymentReference: 'payment-id' },
      });

      // Assert
      expect(result).toMatchObject({
        status: 'Authorized',
      });
      expect(mockCkoClient.payments.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          source: expect.objectContaining({
            type: 'id',
            id: 'token-1',
          }),
        }),
      );
      expect(mockPaymentService.updatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'payment-id',
          pspReference: 'cko-payment-id',
          transaction: expect.objectContaining({
            type: 'Authorization',
            interfaceId: 'cko-payment-id',
            state: 'Success',
          }),
        }),
      );
    });

    it('should process stored payment with Declined status', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-id',
        version: 1,
        amountPlanned: {
          centAmount: 1000,
          currencyCode: 'EUR',
        },
      } as Payment;

      const mockCart = {
        id: 'cart-id',
        customerId: 'customer-id',
      } as Cart;

      const mockPaymentMethod = {
        id: 'spm-1',
        version: 1,
        method: 'card',
        token: {
          value: 'token-1',
        },
      } as unknown as PaymentMethod;

      const mockCkoResponse = {
        id: 'cko-payment-id',
        status: 'Declined',
        amount: 1000,
        currency: 'EUR',
      } as unknown as CkoPaymentResponse;

      const mockUpdatedPayment = {
        id: 'payment-id',
        version: 2,
      } as Payment;

      jest.spyOn(mockPaymentService, 'getPayment').mockResolvedValue(mockPayment);
      jest.spyOn(mockCartService, 'getCart').mockResolvedValue(mockCart);
      jest.spyOn(mockPaymentMethodService, 'get').mockResolvedValue(mockPaymentMethod);
      jest.spyOn(mockPaymentApi, 'createPayment').mockResolvedValue(mockCkoResponse);
      jest.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);
      jest.spyOn(mockProcessStoredPaymentConverter, 'convertRequest').mockReturnValue({
        amount: 1000,
        currency: 'EUR',
        source: {
          type: 'id',
          id: 'token-1',
        },
      } as CkoPaymentRequest);
      jest.spyOn(mockProcessStoredPaymentConverter, 'convertResponse').mockReturnValue({
        status: 'Declined',
      } as ProcessStoredPaymentResponseDTO);

      // Act
      const result = await service.processStoredPayment('spm-1', {
        data: { paymentReference: 'payment-id' },
      });

      // Assert
      expect(result).toMatchObject({
        status: 'Declined',
      });
      expect(mockPaymentService.updatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction: expect.objectContaining({
            state: 'Failure',
          }),
        }),
      );
    });

    it('should throw error when CKO payment creation fails', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-id',
        version: 1,
        amountPlanned: {
          centAmount: 1000,
          currencyCode: 'EUR',
        },
      } as Payment;

      const mockCart = {
        id: 'cart-id',
        customerId: 'customer-id',
      } as Cart;

      const mockPaymentMethod = {
        id: 'spm-1',
        version: 1,
        method: 'card',
        token: {
          value: 'token-1',
        },
      } as unknown as PaymentMethod;

      jest.spyOn(mockPaymentService, 'getPayment').mockResolvedValue(mockPayment);
      jest.spyOn(mockCartService, 'getCart').mockResolvedValue(mockCart);
      jest.spyOn(mockPaymentMethodService, 'get').mockResolvedValue(mockPaymentMethod);
      jest.spyOn(mockPaymentApi, 'createPayment').mockRejectedValue(new Error('CKO payment failed'));
      jest.spyOn(mockProcessStoredPaymentConverter, 'convertRequest').mockReturnValue({
        amount: 1000,
        currency: 'EUR',
        source: {
          type: 'id',
          id: 'token-1',
        },
      } as CkoPaymentRequest);

      // Act & Assert
      await expect(
        service.processStoredPayment('spm-1', {
          data: { paymentReference: 'payment-id' },
        }),
      ).rejects.toThrow('CKO payment failed');
    });
  });

  describe('confirmStoredPayment', () => {
    it('should confirm successful payment', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-id',
        version: 1,
      } as Payment;

      jest.spyOn(mockPaymentService, 'getPayment').mockResolvedValue(mockPayment);

      // Act
      const result = await service.confirmStoredPayment({
        paymentReference: 'payment-id',
        isSuccess: true,
      });

      // Assert
      expect(result).toMatchObject({
        paymentReference: 'payment-id',
        merchantReturnUrl: expect.stringContaining('paymentReference=payment-id'),
      });
      expect(result.merchantReturnUrl).toContain('success=true');
    });

    it('should confirm failed payment', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-id',
        version: 1,
      } as Payment;

      jest.spyOn(mockPaymentService, 'getPayment').mockResolvedValue(mockPayment);

      // Act
      const result = await service.confirmStoredPayment({
        paymentReference: 'payment-id',
        isSuccess: false,
      });

      // Assert
      expect(result).toMatchObject({
        paymentReference: 'payment-id',
      });
      expect(result.merchantReturnUrl).toContain('success=false');
    });
  });

  describe('deleteStoredPaymentMethod', () => {
    it('should delete payment method from CT and CKO', async () => {
      // Arrange
      const mockCart = {
        id: 'cart-id',
        customerId: 'customer-id',
      } as Cart;

      const mockPaymentMethod = {
        id: 'spm-1',
        version: 1,
        method: 'card',
        token: {
          value: 'token-1',
        },
      } as unknown as PaymentMethod;

      const mockInstrument = {
        id: 'token-1',
        type: 'card',
      } as CkoInstrument;

      jest.spyOn(mockCartService, 'getCart').mockResolvedValue(mockCart);
      jest.spyOn(mockPaymentMethodService, 'get').mockResolvedValue(mockPaymentMethod);
      jest.spyOn(mockPaymentMethodService, 'delete').mockResolvedValue(undefined as unknown as PaymentMethod);
      jest.spyOn(mockInstrumentApi, 'getInstrument').mockResolvedValue(mockInstrument);
      jest.spyOn(mockInstrumentApi, 'deleteInstrument').mockResolvedValue(undefined as unknown as void);

      // Act
      await service.deleteStoredPaymentMethod('spm-1');

      // Assert
      expect(mockPaymentMethodService.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'spm-1',
          version: 1,
          customerId: 'customer-id',
        }),
      );
      expect(mockInstrumentApi.deleteInstrument).toHaveBeenCalledWith('token-1');
    });

    it('should skip CKO deletion when no token present', async () => {
      // Arrange
      const mockCart = {
        id: 'cart-id',
        customerId: 'customer-id',
      } as Cart;

      const mockPaymentMethod = {
        id: 'spm-1',
        version: 1,
        method: 'card',
        token: undefined,
      } as unknown as PaymentMethod;

      jest.spyOn(mockCartService, 'getCart').mockResolvedValue(mockCart);
      jest.spyOn(mockPaymentMethodService, 'get').mockResolvedValue(mockPaymentMethod);
      jest.spyOn(mockPaymentMethodService, 'delete').mockResolvedValue(undefined as unknown as PaymentMethod);
      jest.spyOn(mockInstrumentApi, 'deleteInstrument').mockResolvedValue(undefined as unknown as void);

      // Act
      await service.deleteStoredPaymentMethod('spm-1');

      // Assert
      expect(mockPaymentMethodService.delete).toHaveBeenCalled();
      expect(mockInstrumentApi.deleteInstrument).not.toHaveBeenCalled();
    });

    it('should continue when CKO instrument not found', async () => {
      // Arrange
      const mockCart = {
        id: 'cart-id',
        customerId: 'customer-id',
      } as Cart;

      const mockPaymentMethod = {
        id: 'spm-1',
        version: 1,
        method: 'card',
        token: {
          value: 'token-1',
        },
      } as unknown as PaymentMethod;

      jest.spyOn(mockCartService, 'getCart').mockResolvedValue(mockCart);
      jest.spyOn(mockPaymentMethodService, 'get').mockResolvedValue(mockPaymentMethod);
      jest.spyOn(mockPaymentMethodService, 'delete').mockResolvedValue(undefined as unknown as PaymentMethod);
      jest.spyOn(mockInstrumentApi, 'getInstrument').mockRejectedValue(new Error('Instrument not found'));

      // Act
      await service.deleteStoredPaymentMethod('spm-1');

      // Assert
      expect(mockPaymentMethodService.delete).toHaveBeenCalled();
    });

    it('should throw error when CT deletion fails', async () => {
      // Arrange
      const mockCart = {
        id: 'cart-id',
        customerId: 'customer-id',
      } as Cart;

      const mockPaymentMethod = {
        id: 'spm-1',
        version: 1,
        method: 'card',
        token: {
          value: 'token-1',
        },
      } as unknown as PaymentMethod;

      jest.spyOn(mockCartService, 'getCart').mockResolvedValue(mockCart);
      jest.spyOn(mockPaymentMethodService, 'get').mockResolvedValue(mockPaymentMethod);
      jest.spyOn(mockPaymentMethodService, 'delete').mockRejectedValue(new Error('CT deletion failed'));

      // Act & Assert
      await expect(service.deleteStoredPaymentMethod('spm-1')).rejects.toThrow('CT deletion failed');
    });
  });
});
