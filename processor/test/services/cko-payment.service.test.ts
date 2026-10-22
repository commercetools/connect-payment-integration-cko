import {
  Cart,
  CommercetoolsCartService,
  CommercetoolsPaymentMethodService,
  CommercetoolsPaymentService,
  HealthCheckResult,
  Payment,
} from '@commercetools/connect-payments-sdk';
import { beforeEach, describe, expect, it, type Mocked, type MockedFunction, vi } from 'vitest';
import * as StatusHandler from '@commercetools/connect-payments-sdk/dist/api/handlers/status.handler';
import { CkoPaymentService } from '../../src/services/cko-payment.service';
import { getCkoApiClient } from '../../src/clients/cko.client';
import { CkoApi } from '../../src/clients/api/cko.api';
import { PaymentSessionApi } from '../../src/clients/api/payment-session.api';
import { PaymentApi } from '../../src/clients/api/payment.api';
import { CreatePaymentSessionConverter } from '../../src/services/converters/create-payment-session.converter';
import { PaymentComponentsConverter } from '../../src/services/converters/payment-components.converter';
import { SubmitPaymentSessionConverter } from '../../src/services/converters/submit-payment-session.converter';
import { NotificationConverter } from '../../src/services/converters/notification.converter';
import {
  CkoPaymentSessionStatus,
  PaymentSessionRequest,
  PaymentSessionResponse,
  SubmitPaymentSessionResponse,
} from '../../src/clients/types/payment-session.type';
import { PaymentMethodsApi } from '../../src/clients/api/payment-method.api';
import { PaymentAmount } from '@commercetools/connect-payments-sdk/dist/commercetools/types/payment.type';
import { SupportedPaymentComponentsSchemaDTO } from '../../src/dtos/operations/payment-componets.dto';
import {
  PaymentSessionRequestDTO,
  PaymentSessionResponseDTO,
  SubmitPaymentSessionRequestDTO,
  SubmitPaymentSessionResponseDTO,
} from '../../src/dtos/cko-payment.dto';
import { CkoWebhookEvent } from '../../src/clients/types/webhook.type';
import { NotificationUpdatePayment } from '../../src/services/types/cko-payment.type';
import { SubmitPaymentSessionRequest } from '../../src/clients/types/payment-session.type';
import { NotImplementedError } from '../../src/errors/cko-api.error';
import { TransactionDraftDTO } from '../../src/dtos/operations/transaction.dto';
import { paymentSDK } from '../../src/payment-sdk';
import { CkoGetPaymentResponse } from '../../src/clients/types/payment.type';

vi.mock('@app/payment-sdk', () => ({
  appLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  paymentSDK: {
    ctCustomTypeService: {
      createOrUpdatePredefinedInterfaceInteractionType: vi.fn().mockResolvedValue({}),
      createOrUpdatePredefinedPaymentMethodTypes: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock('@app/config/config', () => {
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

vi.mock('@app/clients/cko.client');
vi.mock('@lib/fastify/context/context', () => {
  const mockRequestContextData = {
    correlationId: 'test-correlation-id',
    pathTemplate: '/test-path',
    path: '/test-path',
  };

  return {
    getRequestContext: vi.fn(() => mockRequestContextData),
    getCtSessionIdFromContext: vi.fn(),
    getFutureOrderNumberFromContext: vi.fn(),
    getProcessorUrlFromContext: vi.fn(),
    getCkoConfigKeyFromContext: vi.fn(),
    getCartIdFromContext: vi.fn(() => 'cart-id'),
    getMerchantReturnUrlFromContext: vi.fn(),
    getCheckoutTransactionItemIdFromContext: vi.fn(),
  };
});

describe('CkoPaymentService', () => {
  const mockCartService = {
    getCart: vi.fn(),
    addPayment: vi.fn(),
    getPlannedPaymentAmount: vi.fn(),
  } as unknown as Mocked<CommercetoolsCartService>;

  const mockPaymentService = {
    createPayment: vi.fn(),
    getPayment: vi.fn(),
    updatePayment: vi.fn(),
    hasTransactionInState: vi.fn(),
  } as unknown as Mocked<CommercetoolsPaymentService>;

  const mockPaymentMethodService = {
    save: vi.fn(),
    find: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    doesTokenBelongsToCustomer: vi.fn(),
  } as unknown as Mocked<CommercetoolsPaymentMethodService>;

  const mockPaymentComponentsConverter = {
    convertResponse: vi.fn(),
  } as unknown as PaymentComponentsConverter;

  const mockCreatePaymentSessionConverter = {
    convertRequest: vi.fn(),
    convertResponse: vi.fn(),
  } as unknown as CreatePaymentSessionConverter;

  const mockSubmitPaymentSessionConverter = {
    convertRequest: vi.fn(),
    convertResponse: vi.fn(),
  } as unknown as SubmitPaymentSessionConverter;

  const mockNotificationConverter = {
    convert: vi.fn(),
  } as unknown as NotificationConverter;

  const service = new CkoPaymentService({
    ctCartService: mockCartService,
    ctPaymentService: mockPaymentService,
    ctPaymentMethodService: mockPaymentMethodService,
    paymentComponentsConverter: mockPaymentComponentsConverter,
    createPaymentSessionConverter: mockCreatePaymentSessionConverter,
    submitPaymentSessionConverter: mockSubmitPaymentSessionConverter,
    notificationConverter: mockNotificationConverter,
  });

  const mockPaymentSessionApi = new PaymentSessionApi();
  const mockPaymentApi = new PaymentApi();
  const mockPaymentMethodApi = new PaymentMethodsApi();
  const mockGetCkoApiClient = getCkoApiClient as MockedFunction<typeof getCkoApiClient>;
  const mockCkoClient = {
    paymentSessions: mockPaymentSessionApi,
    payments: mockPaymentApi,
    paymentMethods: mockPaymentMethodApi,
  } as unknown as CkoApi;

  mockGetCkoApiClient.mockReturnValue(mockCkoClient);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleTransaction', () => {
    it('should throw a NotImplementedError', async () => {
      // Arrange
      const draft: TransactionDraftDTO = {
        cartId: '3f2b8a52-7f0a-4d7e-9f0e-0b8f5f4f6a11',
        checkoutTransactionItemId: '8a1c1f9e-2b4d-4c53-8a67-1f6a9c3d2e10',
        type: 'Recurring',
      };

      // Act & Assert
      const promise = service.handleTransaction(draft);
      await expect(promise).rejects.toBeInstanceOf(NotImplementedError);
      await expect(promise).rejects.toMatchObject({
        httpErrorStatus: 501,
        message: 'Recurring transactions are not implemented by the Checkout.com connector yet',
      });
    });
  });

  describe('config', () => {
    it('should return configuration', async () => {
      // Act
      const result = await service.config();

      // Assert
      expect(result).toMatchObject({
        publicKey: 'test-public-key',
        environment: 'sandbox',
        storedPaymentMethodsEnabled: true,
      });
    });
  });

  describe('getSupportedPaymentComponents', () => {
    it('should return supported payment components', async () => {
      // Arrange
      const mockComponents = {
        components: [
          {
            type: 'card',
          },
        ],
      } as SupportedPaymentComponentsSchemaDTO;

      vi.spyOn(mockPaymentComponentsConverter, 'convertResponse').mockReturnValue(mockComponents);

      // Act
      const result = await service.getSupportedPaymentComponents();

      // Assert
      expect(result).toMatchObject(mockComponents);
      expect(mockPaymentComponentsConverter.convertResponse).toHaveBeenCalled();
    });
  });

  describe('createPaymentSession', () => {
    it('should create payment session successfully with customer', async () => {
      // Arrange
      const mockCart = {
        id: 'cart-id',
        version: 1,
        customerId: 'customer-id',
      } as Cart;

      const mockPayment = {
        id: 'payment-id',
        version: 1,
        amountPlanned: {
          centAmount: 1000,
          currencyCode: 'EUR',
        },
      } as Payment;

      const mockUpdatedCart = {
        id: 'cart-id',
        version: 2,
      } as Cart;

      const mockCkoRequest = {
        amount: 1000,
        currency: 'EUR',
        reference: 'cart-id',
      } as PaymentSessionRequest;

      const mockCkoResponse = {
        id: 'session-id',
        payment_id: 'cko-payment-id',
      } as unknown as PaymentSessionResponse;

      const mockSessionResponse = {
        sessionId: 'session-id',
        paymentReference: 'payment-id',
      } as unknown as PaymentSessionResponseDTO;

      vi.spyOn(mockCartService, 'getCart').mockResolvedValue(mockCart);
      vi.spyOn(mockCartService, 'getPlannedPaymentAmount').mockResolvedValue({
        centAmount: 1000,
        currencyCode: 'EUR',
      } as PaymentAmount);
      vi.spyOn(mockPaymentService, 'createPayment').mockResolvedValue(mockPayment);
      vi.spyOn(mockCartService, 'addPayment').mockResolvedValue(mockUpdatedCart);
      vi.spyOn(mockCreatePaymentSessionConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      vi.spyOn(mockPaymentSessionApi, 'createPaymentSession').mockResolvedValue(mockCkoResponse);
      vi.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockPayment);
      vi.spyOn(mockCreatePaymentSessionConverter, 'convertResponse').mockReturnValue(mockSessionResponse);

      // Act
      const result = await service.createPaymentSession({
        data: {
          currency: 'EUR',
        } as PaymentSessionRequestDTO,
      });

      // Assert
      expect(result).toMatchObject(mockSessionResponse);
      expect(mockPaymentSessionApi.createPaymentSession).toHaveBeenCalledWith(mockCkoRequest);
      expect(mockCartService.addPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: { id: 'cart-id', version: 1 },
          paymentId: 'payment-id',
        }),
      );
      expect(mockPaymentService.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: { typeId: 'customer', id: 'customer-id' },
        }),
      );
    });

    it('should throw error when CKO payment session creation fails', async () => {
      // Arrange
      const mockCart = {
        id: 'cart-id',
        version: 1,
      } as Cart;

      const mockPayment = {
        id: 'payment-id',
        version: 1,
      } as Payment;

      const mockUpdatedCart = {
        id: 'cart-id',
        version: 2,
      } as Cart;

      const mockCkoRequest = {
        amount: 1000,
        currency: 'EUR',
      } as PaymentSessionRequest;

      vi.spyOn(mockCartService, 'getCart').mockResolvedValue(mockCart);
      vi.spyOn(mockCartService, 'getPlannedPaymentAmount').mockResolvedValue({
        centAmount: 1000,
        currencyCode: 'EUR',
      } as PaymentAmount);
      vi.spyOn(mockPaymentService, 'createPayment').mockResolvedValue(mockPayment);
      vi.spyOn(mockCartService, 'addPayment').mockResolvedValue(mockUpdatedCart);
      vi.spyOn(mockCreatePaymentSessionConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      vi.spyOn(mockPaymentSessionApi, 'createPaymentSession').mockRejectedValue(new Error('CKO API error'));

      // Act & Assert
      await expect(
        service.createPaymentSession({
          data: {} as PaymentSessionRequestDTO,
        }),
      ).rejects.toThrow('CKO API error');
    });
  });

  describe('submitPaymentSession', () => {
    it('should submit payment session successfully with Authorized status', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-id',
        version: 1,
        amountPlanned: {
          centAmount: 1000,
          currencyCode: 'EUR',
        },
      } as Payment;

      const mockCkoRequest = {
        payment_method_data: {},
        session_data: {},
      } as unknown as SubmitPaymentSessionRequest;

      const mockCkoResponse = {
        id: 'cko-payment-id',
        status: CkoPaymentSessionStatus.APPROVED,
        type: 'card',
      } as unknown as SubmitPaymentSessionResponse;

      const mockSubmitResponse = {
        id: 'cko-payment-id',
        status: CkoPaymentSessionStatus.APPROVED,
        paymentReference: 'payment-id',
      } as SubmitPaymentSessionResponseDTO;

      const mockUpdatedPayment = {
        id: 'payment-id',
        version: 2,
      } as Payment;

      vi.spyOn(mockPaymentService, 'getPayment').mockResolvedValue(mockPayment);
      vi.spyOn(mockSubmitPaymentSessionConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      vi.spyOn(mockPaymentSessionApi, 'submitPaymentSession').mockResolvedValue(mockCkoResponse);
      vi.spyOn(mockSubmitPaymentSessionConverter, 'convertResponse').mockReturnValue(mockSubmitResponse);
      vi.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

      // Act
      const result = await service.submitPaymentSession('session-id', {
        data: {
          paymentReference: 'payment-id',
        } as SubmitPaymentSessionRequestDTO,
      });

      // Assert
      expect(result.id).toBe(mockSubmitResponse.id);
      expect(result.status).toBe(mockSubmitResponse.status);
      expect(result.paymentReference).toBe(mockSubmitResponse.paymentReference);
      expect(mockPaymentSessionApi.submitPaymentSession).toHaveBeenCalledWith('session-id', mockCkoRequest);
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

    it('should submit payment session with Declined status', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-id',
        version: 1,
        amountPlanned: {
          centAmount: 1000,
          currencyCode: 'EUR',
        },
      } as Payment;

      const mockCkoRequest = {
        payment_method_data: {},
        session_data: {},
      } as unknown as SubmitPaymentSessionRequest;

      const mockCkoResponse = {
        id: 'cko-payment-id',
        status: CkoPaymentSessionStatus.DECLINED,
        type: 'card',
      } as unknown as SubmitPaymentSessionResponse;

      const mockSubmitResponse = {
        id: 'cko-payment-id',
        status: CkoPaymentSessionStatus.DECLINED,
      } as SubmitPaymentSessionResponseDTO;

      const mockUpdatedPayment = {
        id: 'payment-id',
        version: 2,
      } as Payment;

      vi.spyOn(mockPaymentService, 'getPayment').mockResolvedValue(mockPayment);
      vi.spyOn(mockSubmitPaymentSessionConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      vi.spyOn(mockPaymentSessionApi, 'submitPaymentSession').mockResolvedValue(mockCkoResponse);
      vi.spyOn(mockSubmitPaymentSessionConverter, 'convertResponse').mockReturnValue(mockSubmitResponse);
      vi.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

      // Act
      const result = await service.submitPaymentSession('session-id', {
        data: {
          paymentReference: 'payment-id',
        } as SubmitPaymentSessionRequestDTO,
      });

      // Assert
      expect(result.id).toBe(mockSubmitResponse.id);
      expect(result.status).toBe(mockSubmitResponse.status);
      expect(mockPaymentService.updatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction: expect.objectContaining({
            state: 'Failure',
          }),
        }),
      );
    });

    it('should throw error when submit fails', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-id',
        version: 1,
      } as Payment;

      const mockCkoRequest = {
        payment_method_data: {},
        session_data: {},
      } as unknown as SubmitPaymentSessionRequest;

      vi.spyOn(mockPaymentService, 'getPayment').mockResolvedValue(mockPayment);
      vi.spyOn(mockSubmitPaymentSessionConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      vi.spyOn(mockPaymentSessionApi, 'submitPaymentSession').mockRejectedValue(new Error('Submit failed'));

      // Act & Assert
      await expect(
        service.submitPaymentSession('session-id', {
          data: {
            paymentReference: 'payment-id',
          } as SubmitPaymentSessionRequestDTO,
        }),
      ).rejects.toThrow('Submit failed');
    });
  });

  describe('confirmPayment', () => {
    it('should confirm successful payment', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-id',
        version: 1,
        amountPlanned: {
          centAmount: 1000,
          currencyCode: 'EUR',
        },
      } as Payment;

      const mockCkoPayment = {
        id: 'cko-payment-id',
        source: {
          type: 'card',
        },
      } as unknown as CkoGetPaymentResponse;

      const mockUpdatedPayment = {
        id: 'payment-id',
        version: 2,
      } as Payment;

      vi.spyOn(mockPaymentService, 'getPayment').mockResolvedValue(mockPayment);
      vi.spyOn(mockPaymentApi, 'getPayment').mockResolvedValue(mockCkoPayment);
      vi.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

      // Act
      const result = await service.confirmPayment({
        paymentReference: 'payment-id',
        ckoPaymentId: 'cko-payment-id',
        isSuccess: true,
      });

      // Assert
      expect(result).toMatchObject({
        paymentReference: 'payment-id',
        merchantReturnUrl: expect.stringContaining('payment-id'),
      });
      expect(mockPaymentApi.getPayment).toHaveBeenCalledWith('cko-payment-id');
      expect(mockPaymentService.updatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'payment-id',
          transaction: expect.objectContaining({
            type: 'Authorization',
            interfaceId: 'cko-payment-id',
            state: 'Success',
          }),
        }),
      );
    });

    it('should confirm failed payment', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-id',
        version: 1,
        amountPlanned: {
          centAmount: 1000,
          currencyCode: 'EUR',
        },
      } as Payment;

      const mockCkoPayment = {
        id: 'cko-payment-id',
        source: {
          type: 'card',
        },
      } as unknown as CkoGetPaymentResponse;

      const mockUpdatedPayment = {
        id: 'payment-id',
        version: 2,
      } as Payment;

      vi.spyOn(mockPaymentService, 'getPayment').mockResolvedValue(mockPayment);
      vi.spyOn(mockPaymentApi, 'getPayment').mockResolvedValue(mockCkoPayment);
      vi.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

      // Act
      const result = await service.confirmPayment({
        paymentReference: 'payment-id',
        ckoPaymentId: 'cko-payment-id',
        isSuccess: false,
      });

      // Assert
      expect(result).toMatchObject({
        paymentReference: 'payment-id',
      });
      expect(mockPaymentService.updatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction: expect.objectContaining({
            state: 'Failure',
          }),
        }),
      );
    });

    it('should throw error when confirm fails', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-id',
        version: 1,
      } as Payment;

      vi.spyOn(mockPaymentService, 'getPayment').mockResolvedValue(mockPayment);
      vi.spyOn(mockPaymentApi, 'getPayment').mockRejectedValue(new Error('CKO API error'));

      // Act & Assert
      await expect(
        service.confirmPayment({
          paymentReference: 'payment-id',
          ckoPaymentId: 'cko-payment-id',
          isSuccess: true,
        }),
      ).rejects.toThrow('CKO API error');
    });
  });

  describe('processNotification', () => {
    it('should process notification and update payment', async () => {
      // Arrange
      const mockEvent = {
        type: 'payment_approved',
        data: {
          id: 'cko-payment-id',
        },
      } as CkoWebhookEvent;

      const mockUpdateData = {
        paymentId: 'payment-id',
        pspReference: 'cko-payment-id',
        transaction: {
          type: 'Authorization',
          state: 'Success',
          amount: {
            centAmount: 1000,
            currencyCode: 'EUR',
          },
          interfaceId: 'cko-payment-id',
        },
        paymentMethodInfo: {
          method: 'card',
        },
      } as NotificationUpdatePayment;

      const mockUpdatedPayment = {
        id: 'payment-id',
        version: 2,
      } as Payment;

      vi.spyOn(mockNotificationConverter, 'convert').mockResolvedValue(mockUpdateData);
      vi.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

      // Act
      await service.processNotification({ event: mockEvent });

      // Assert
      expect(mockNotificationConverter.convert).toHaveBeenCalledWith({ event: mockEvent });
      expect(mockPaymentService.updatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'payment-id',
          pspReference: 'cko-payment-id',
          paymentMethodInfo: mockUpdateData.paymentMethodInfo,
          transaction: mockUpdateData.transaction,
        }),
      );
    });

    it('should process the notification without the card details when the payment method types cannot be created', async () => {
      // Arrange
      const mockEvent = { type: 'payment_approved', data: { id: 'cko-payment-id' } } as CkoWebhookEvent;
      const mockUpdateData = {
        paymentId: 'payment-id',
        pspReference: 'cko-payment-id',
        transaction: { type: 'Authorization', state: 'Success', amount: { centAmount: 1000, currencyCode: 'EUR' } },
        paymentMethodInfo: {
          method: 'card',
          custom: { type: { typeId: 'type', key: 'commercetools-checkout-card-details' }, fields: { brand: 'visa' } },
        },
      } as unknown as NotificationUpdatePayment;
      vi.mocked(paymentSDK.ctCustomTypeService.createOrUpdatePredefinedPaymentMethodTypes).mockRejectedValueOnce(
        new Error('boom'),
      );
      vi.spyOn(mockNotificationConverter, 'convert').mockResolvedValue(mockUpdateData);
      vi.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue({ id: 'payment-id', version: 2 } as Payment);

      // Act
      await service.processNotification({ event: mockEvent });

      // Assert
      expect(mockPaymentService.updatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentMethodInfo: { method: 'card', custom: undefined },
        }),
      );
    });

    it('should save payment method when requested', async () => {
      // Arrange
      const mockEvent = {
        type: 'payment_approved',
        data: {
          id: 'cko-payment-id',
        },
      } as CkoWebhookEvent;

      const mockUpdateData = {
        paymentId: 'payment-id',
        pspReference: 'cko-payment-id',
        transaction: {
          type: 'Authorization',
          state: 'Success',
          amount: {
            centAmount: 1000,
            currencyCode: 'EUR',
          },
        },
        storePaymentMethod: true,
        paymentMethodInfo: {
          method: 'card',
          custom: {
            type: {
              typeId: 'type',
              id: 'payment-method-type-id',
            },
            fields: {
              storePaymentMethod: true,
            },
          },
        },
      } as unknown as NotificationUpdatePayment;

      const mockUpdatedPayment = {
        id: 'payment-id',
        version: 2,
        customer: {
          id: 'customer-id',
        },
        paymentMethodInfo: {
          method: 'card',
          paymentInterface: 'checkout-cko',
          interfaceAccount: 'test-channel-id',
          token: {
            value: 'token-123',
          },
          custom: {
            fields: {
              storePaymentMethod: true,
            },
          },
        },
      } as unknown as Payment;

      const mockSavedPaymentMethod = {
        id: 'spm-id',
        version: 1,
      };

      vi.spyOn(mockNotificationConverter, 'convert').mockResolvedValue(mockUpdateData);
      vi.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);
      vi.spyOn(mockPaymentMethodService, 'doesTokenBelongsToCustomer').mockResolvedValue(false);
      vi.spyOn(mockPaymentMethodService, 'save').mockResolvedValue(mockSavedPaymentMethod as unknown as any);

      // Act
      await service.processNotification({ event: mockEvent });

      // Assert
      expect(mockPaymentMethodService.save).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'customer-id',
          method: 'card',
          token: 'token-123',
        }),
      );
    });

    it('should not save payment method when token already exists', async () => {
      // Arrange
      const mockEvent = {
        type: 'payment_approved',
        data: {
          id: 'cko-payment-id',
        },
      } as CkoWebhookEvent;

      const mockUpdateData = {
        paymentId: 'payment-id',
        pspReference: 'cko-payment-id',
        transaction: {
          type: 'Authorization',
          state: 'Success',
          amount: {
            centAmount: 1000,
            currencyCode: 'EUR',
          },
        },
        paymentMethodInfo: {
          method: 'card',
          custom: {
            type: {
              typeId: 'type',
              id: 'payment-method-type-id',
            },
            fields: {
              storePaymentMethod: true,
            },
          },
        },
      } as unknown as NotificationUpdatePayment;

      const mockUpdatedPayment = {
        id: 'payment-id',
        version: 2,
        customer: {
          id: 'customer-id',
        },
        paymentMethodInfo: {
          method: 'card',
          paymentInterface: 'checkout-cko',
          token: {
            value: 'token-123',
          },
          custom: {
            fields: {
              storePaymentMethod: true,
            },
          },
        },
      } as unknown as Payment;

      vi.spyOn(mockNotificationConverter, 'convert').mockResolvedValue(mockUpdateData);
      vi.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);
      vi.spyOn(mockPaymentMethodService, 'doesTokenBelongsToCustomer').mockResolvedValue(true);
      vi.spyOn(mockPaymentMethodService, 'save').mockResolvedValue({} as unknown as any);

      // Act
      await service.processNotification({ event: mockEvent });

      // Assert
      expect(mockPaymentMethodService.save).not.toHaveBeenCalled();
    });

    it('should not save payment method when not requested', async () => {
      // Arrange
      const mockEvent = {
        type: 'payment_approved',
        data: {
          id: 'cko-payment-id',
        },
      } as CkoWebhookEvent;

      const mockUpdateData = {
        paymentId: 'payment-id',
        pspReference: 'cko-payment-id',
        transaction: {
          type: 'Authorization',
          state: 'Success',
        },
        paymentMethodInfo: {
          method: 'card',
        },
      } as NotificationUpdatePayment;

      const mockUpdatedPayment = {
        id: 'payment-id',
        version: 2,
      } as Payment;

      vi.spyOn(mockNotificationConverter, 'convert').mockResolvedValue(mockUpdateData);
      vi.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);
      vi.spyOn(mockPaymentMethodService, 'save').mockResolvedValue({} as unknown as any);

      // Act
      await service.processNotification({ event: mockEvent });

      // Assert
      expect(mockPaymentMethodService.save).not.toHaveBeenCalled();
    });
  });

  describe('status', () => {
    it('should return UP status when all checks pass', async () => {
      // Arrange
      const mockHealthCheckFunction: () => Promise<HealthCheckResult> = async () => {
        const result: HealthCheckResult = {
          name: 'CoCo Permissions',
          status: 'UP',
          details: {},
          message: '',
        };
        return result;
      };

      vi.spyOn(StatusHandler, 'healthCheckCommercetoolsPermissions').mockReturnValue(mockHealthCheckFunction);
      const mockPaymentMethods = {
        methods: ['card', 'klarna'],
      } as unknown as any;

      vi.spyOn(mockPaymentMethodApi, 'getPaymentMethods').mockResolvedValue(mockPaymentMethods);

      // Act
      const result = await service.status();

      // Assert
      expect(result).toMatchObject({
        status: 'OK',
      });
      expect(mockPaymentMethodApi.getPaymentMethods).toHaveBeenCalled();
    });
  });
});
