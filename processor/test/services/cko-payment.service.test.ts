import {
  Cart,
  CommercetoolsCartService,
  CommercetoolsPaymentMethodService,
  CommercetoolsPaymentService,
  HealthCheckResult,
  Payment,
} from '@commercetools/connect-payments-sdk';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
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
import { CkoGetPaymentResponse } from '../../src/clients/types/payment.type';

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
    getCheckoutTransactionItemIdFromContext: jest.fn(),
  };
});

describe('CkoPaymentService', () => {
  const mockCartService = {
    getCart: jest.fn(),
    addPayment: jest.fn(),
    getPlannedPaymentAmount: jest.fn(),
  } as unknown as jest.Mocked<CommercetoolsCartService>;

  const mockPaymentService = {
    createPayment: jest.fn(),
    getPayment: jest.fn(),
    updatePayment: jest.fn(),
    hasTransactionInState: jest.fn(),
  } as unknown as jest.Mocked<CommercetoolsPaymentService>;

  const mockPaymentMethodService = {
    save: jest.fn(),
    find: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
    doesTokenBelongsToCustomer: jest.fn(),
  } as unknown as jest.Mocked<CommercetoolsPaymentMethodService>;

  const mockPaymentComponentsConverter = {
    convertResponse: jest.fn(),
  } as unknown as PaymentComponentsConverter;

  const mockCreatePaymentSessionConverter = {
    convertRequest: jest.fn(),
    convertResponse: jest.fn(),
  } as unknown as CreatePaymentSessionConverter;

  const mockSubmitPaymentSessionConverter = {
    convertRequest: jest.fn(),
    convertResponse: jest.fn(),
  } as unknown as SubmitPaymentSessionConverter;

  const mockNotificationConverter = {
    convert: jest.fn(),
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
  const mockGetCkoApiClient = getCkoApiClient as jest.MockedFunction<typeof getCkoApiClient>;
  const mockCkoClient = {
    paymentSessions: mockPaymentSessionApi,
    payments: mockPaymentApi,
    paymentMethods: mockPaymentMethodApi,
  } as unknown as CkoApi;

  mockGetCkoApiClient.mockReturnValue(mockCkoClient);

  beforeEach(() => {
    jest.clearAllMocks();
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

      jest.spyOn(mockPaymentComponentsConverter, 'convertResponse').mockReturnValue(mockComponents);

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

      jest.spyOn(mockCartService, 'getCart').mockResolvedValue(mockCart);
      jest.spyOn(mockCartService, 'getPlannedPaymentAmount').mockResolvedValue({
        centAmount: 1000,
        currencyCode: 'EUR',
      } as PaymentAmount);
      jest.spyOn(mockPaymentService, 'createPayment').mockResolvedValue(mockPayment);
      jest.spyOn(mockCartService, 'addPayment').mockResolvedValue(mockUpdatedCart);
      jest.spyOn(mockCreatePaymentSessionConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      jest.spyOn(mockPaymentSessionApi, 'createPaymentSession').mockResolvedValue(mockCkoResponse);
      jest.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockPayment);
      jest.spyOn(mockCreatePaymentSessionConverter, 'convertResponse').mockReturnValue(mockSessionResponse);

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

      jest.spyOn(mockCartService, 'getCart').mockResolvedValue(mockCart);
      jest.spyOn(mockCartService, 'getPlannedPaymentAmount').mockResolvedValue({
        centAmount: 1000,
        currencyCode: 'EUR',
      } as PaymentAmount);
      jest.spyOn(mockPaymentService, 'createPayment').mockResolvedValue(mockPayment);
      jest.spyOn(mockCartService, 'addPayment').mockResolvedValue(mockUpdatedCart);
      jest.spyOn(mockCreatePaymentSessionConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      jest.spyOn(mockPaymentSessionApi, 'createPaymentSession').mockRejectedValue(new Error('CKO API error'));

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

      jest.spyOn(mockPaymentService, 'getPayment').mockResolvedValue(mockPayment);
      jest.spyOn(mockSubmitPaymentSessionConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      jest.spyOn(mockPaymentSessionApi, 'submitPaymentSession').mockResolvedValue(mockCkoResponse);
      jest.spyOn(mockSubmitPaymentSessionConverter, 'convertResponse').mockReturnValue(mockSubmitResponse);
      jest.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

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

      jest.spyOn(mockPaymentService, 'getPayment').mockResolvedValue(mockPayment);
      jest.spyOn(mockSubmitPaymentSessionConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      jest.spyOn(mockPaymentSessionApi, 'submitPaymentSession').mockResolvedValue(mockCkoResponse);
      jest.spyOn(mockSubmitPaymentSessionConverter, 'convertResponse').mockReturnValue(mockSubmitResponse);
      jest.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

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

      jest.spyOn(mockPaymentService, 'getPayment').mockResolvedValue(mockPayment);
      jest.spyOn(mockSubmitPaymentSessionConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      jest.spyOn(mockPaymentSessionApi, 'submitPaymentSession').mockRejectedValue(new Error('Submit failed'));

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

      jest.spyOn(mockPaymentService, 'getPayment').mockResolvedValue(mockPayment);
      jest.spyOn(mockPaymentApi, 'getPayment').mockResolvedValue(mockCkoPayment);
      jest.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

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

      jest.spyOn(mockPaymentService, 'getPayment').mockResolvedValue(mockPayment);
      jest.spyOn(mockPaymentApi, 'getPayment').mockResolvedValue(mockCkoPayment);
      jest.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

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

      jest.spyOn(mockPaymentService, 'getPayment').mockResolvedValue(mockPayment);
      jest.spyOn(mockPaymentApi, 'getPayment').mockRejectedValue(new Error('CKO API error'));

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

      jest.spyOn(mockNotificationConverter, 'convert').mockResolvedValue(mockUpdateData);
      jest.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

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

      jest.spyOn(mockNotificationConverter, 'convert').mockResolvedValue(mockUpdateData);
      jest.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);
      jest.spyOn(mockPaymentMethodService, 'doesTokenBelongsToCustomer').mockResolvedValue(false);
      jest.spyOn(mockPaymentMethodService, 'save').mockResolvedValue(mockSavedPaymentMethod as unknown as any);

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

      jest.spyOn(mockNotificationConverter, 'convert').mockResolvedValue(mockUpdateData);
      jest.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);
      jest.spyOn(mockPaymentMethodService, 'doesTokenBelongsToCustomer').mockResolvedValue(true);
      jest.spyOn(mockPaymentMethodService, 'save').mockResolvedValue({} as unknown as any);

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

      jest.spyOn(mockNotificationConverter, 'convert').mockResolvedValue(mockUpdateData);
      jest.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);
      jest.spyOn(mockPaymentMethodService, 'save').mockResolvedValue({} as unknown as any);

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

      jest.spyOn(StatusHandler, 'healthCheckCommercetoolsPermissions').mockReturnValue(mockHealthCheckFunction);
      const mockPaymentMethods = {
        methods: ['card', 'klarna'],
      } as unknown as any;

      jest.spyOn(mockPaymentMethodApi, 'getPaymentMethods').mockResolvedValue(mockPaymentMethods);

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
