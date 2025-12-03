import { CommercetoolsPaymentService, Payment } from '@commercetools/connect-payments-sdk';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { CkoPaymentIntentService } from '../../src/services/cko-payment-intent.service';
import { getCkoApiClient } from '../../src/clients/cko.client';
import { CkoApi } from '../../src/clients/api/cko.api';
import { PaymentApi } from '../../src/clients/api/payment.api';
import { VoidPaymentConverter } from '../../src/services/converters/void-payment.converter';
import { ReversePaymentConverter } from '../../src/services/converters/reverse-payment.converter';
import { CapturePaymentConverter } from '../../src/services/converters/capture-payment.converter';
import { RefundPaymentConverter } from '../../src/services/converters/refund-payment.converter';
import { PaymentModificationStatus } from '../../src/dtos/operations/payment-intents.dto';
import { CkoRefundPaymentRequest } from '../../src/clients/types/payment.type';

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

describe('CkoPaymentIntentService', () => {
  const mockPaymentService = {
    createPayment: jest.fn(),
    getPayment: jest.fn(),
    updatePayment: jest.fn(),
    hasTransactionInState: jest.fn(),
  } as unknown as jest.Mocked<CommercetoolsPaymentService>;

  const mockVoidPaymentConverter = {
    convertRequest: jest.fn(),
    convertResponse: jest.fn(),
  } as unknown as VoidPaymentConverter;

  const mockReversePaymentConverter = {
    convertRequest: jest.fn(),
    convertResponse: jest.fn(),
  } as unknown as ReversePaymentConverter;

  const mockCapturePaymentConverter = {
    convertRequest: jest.fn(),
    convertResponse: jest.fn(),
  } as unknown as CapturePaymentConverter;

  const mockRefundPaymentConverter = {
    convertRequest: jest.fn(),
    convertResponse: jest.fn(),
  } as unknown as RefundPaymentConverter;

  const service = new CkoPaymentIntentService({
    ctPaymentService: mockPaymentService,
    voidPaymentConverter: mockVoidPaymentConverter,
    reversePaymentConverter: mockReversePaymentConverter,
    capturePaymentConverter: mockCapturePaymentConverter,
    refundPaymentConverter: mockRefundPaymentConverter,
  });

  const mockPaymentApi = new PaymentApi();
  const mockGetCkoApiClient = getCkoApiClient as jest.MockedFunction<typeof getCkoApiClient>;
  const mockCkoClient = {
    payments: mockPaymentApi,
  } as unknown as CkoApi;

  mockGetCkoApiClient.mockReturnValue(mockCkoClient);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('capturePayment', () => {
    it('should capture payment successfully', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-id',
        version: 1,
        interfaceId: 'cko-payment-id',
        amountPlanned: {
          centAmount: 1000,
          currencyCode: 'EUR',
        },
      } as Payment;

      const mockCkoRequest = {
        amount: 1000,
        reference: 'merchant-ref',
      };

      const mockCkoResponse = {
        action_id: 'action-id-123',
        reference: 'merchant-ref',
      };

      const mockUpdatedPayment = {
        id: 'payment-id',
        version: 2,
      } as Payment;

      jest.spyOn(mockCapturePaymentConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      jest.spyOn(mockPaymentApi, 'capturePayment').mockResolvedValue(mockCkoResponse);
      jest.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

      // Act
      const result = await service.capturePayment({
        payment: mockPayment,
        merchantReference: 'merchant-ref',
        amount: {
          centAmount: 1000,
          currencyCode: 'EUR',
        },
      });

      // Assert
      expect(result).toMatchObject({
        outcome: PaymentModificationStatus.APPROVED,
        pspReference: 'cko-payment-id',
      });
      expect(mockPaymentApi.capturePayment).toHaveBeenCalledWith('cko-payment-id', mockCkoRequest);
      expect(mockPaymentService.updatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'payment-id',
          transaction: expect.objectContaining({
            type: 'Charge',
            interfaceId: 'action-id-123',
            state: 'Success',
          }),
        }),
      );
    });

    it('should handle capture payment failure', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-id',
        version: 1,
        interfaceId: 'cko-payment-id',
        amountPlanned: {
          centAmount: 1000,
          currencyCode: 'EUR',
        },
      } as Payment;

      const mockCkoRequest = {
        amount: 1000,
        reference: 'merchant-ref',
      };

      const mockUpdatedPayment = {
        id: 'payment-id',
        version: 2,
      } as Payment;

      jest.spyOn(mockCapturePaymentConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      jest.spyOn(mockPaymentApi, 'capturePayment').mockRejectedValue(new Error('Capture failed'));
      jest.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

      // Act
      const result = await service.capturePayment({
        payment: mockPayment,
        merchantReference: 'merchant-ref',
        amount: {
          centAmount: 1000,
          currencyCode: 'EUR',
        },
      });

      // Assert
      expect(result).toMatchObject({
        outcome: PaymentModificationStatus.REJECTED,
        pspReference: 'cko-payment-id',
      });
      expect(mockPaymentService.updatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction: expect.objectContaining({
            state: 'Failure',
          }),
        }),
      );
    });
  });

  describe('cancelPayment', () => {
    it('should cancel payment successfully', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-id',
        version: 1,
        interfaceId: 'cko-payment-id',
        amountPlanned: {
          centAmount: 1000,
          currencyCode: 'EUR',
        },
      } as Payment;

      const mockCkoRequest = {
        reference: 'merchant-ref',
      };

      const mockCkoResponse = {
        action_id: 'action-id-123',
        reference: 'merchant-ref',
      };

      const mockUpdatedPayment = {
        id: 'payment-id',
        version: 2,
      } as Payment;

      jest.spyOn(mockVoidPaymentConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      jest.spyOn(mockPaymentApi, 'voidPayment').mockResolvedValue(mockCkoResponse);
      jest.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

      // Act
      const result = await service.cancelPayment({
        payment: mockPayment,
        merchantReference: 'merchant-ref',
      });

      // Assert
      expect(result).toMatchObject({
        outcome: PaymentModificationStatus.APPROVED,
        pspReference: 'cko-payment-id',
      });
      expect(mockPaymentApi.voidPayment).toHaveBeenCalledWith('cko-payment-id', mockCkoRequest);
      expect(mockPaymentService.updatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'payment-id',
          transaction: expect.objectContaining({
            type: 'CancelAuthorization',
            interfaceId: 'action-id-123',
            state: 'Success',
          }),
        }),
      );
    });

    it('should handle cancel payment failure', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-id',
        version: 1,
        interfaceId: 'cko-payment-id',
        amountPlanned: {
          centAmount: 1000,
          currencyCode: 'EUR',
        },
      } as Payment;

      const mockCkoRequest = {
        reference: 'merchant-ref',
      };

      const mockUpdatedPayment = {
        id: 'payment-id',
        version: 2,
      } as Payment;

      jest.spyOn(mockVoidPaymentConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      jest.spyOn(mockPaymentApi, 'voidPayment').mockRejectedValue(new Error('Void failed'));
      jest.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

      // Act
      const result = await service.cancelPayment({
        payment: mockPayment,
        merchantReference: 'merchant-ref',
      });

      // Assert
      expect(result).toMatchObject({
        outcome: PaymentModificationStatus.REJECTED,
        pspReference: 'cko-payment-id',
      });
      expect(mockPaymentService.updatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction: expect.objectContaining({
            state: 'Failure',
          }),
        }),
      );
    });
  });

  describe('refundPayment', () => {
    it('should refund payment successfully', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-id',
        version: 1,
        interfaceId: 'cko-payment-id',
        amountPlanned: {
          centAmount: 1000,
          currencyCode: 'EUR',
        },
      } as Payment;

      const mockCkoRequest = {
        amount: 1000,
        reference: 'merchant-ref',
      };

      const mockCkoResponse = {
        action_id: 'action-id-123',
        reference: 'merchant-ref',
      };

      const mockUpdatedPayment = {
        id: 'payment-id',
        version: 2,
      } as Payment;

      jest.spyOn(mockRefundPaymentConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      jest.spyOn(mockPaymentApi, 'refundPayment').mockResolvedValue(mockCkoResponse);
      jest.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

      // Act
      const result = await service.refundPayment({
        payment: mockPayment,
        merchantReference: 'merchant-ref',
        amount: {
          centAmount: 1000,
          currencyCode: 'EUR',
        },
        transactionId: 'transaction-id',
      });

      // Assert
      expect(result).toMatchObject({
        outcome: PaymentModificationStatus.APPROVED,
        pspReference: 'cko-payment-id',
      });
      expect(mockPaymentApi.refundPayment).toHaveBeenCalledWith('cko-payment-id', mockCkoRequest);
      expect(mockPaymentService.updatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'payment-id',
          transaction: expect.objectContaining({
            type: 'Refund',
            interfaceId: 'action-id-123',
            state: 'Success',
          }),
        }),
      );
    });

    it('should handle refund payment failure', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-id',
        version: 1,
        interfaceId: 'cko-payment-id',
        amountPlanned: {
          centAmount: 1000,
          currencyCode: 'EUR',
        },
      } as Payment;

      const mockCkoRequest = {
        amount: 1000,
        reference: 'merchant-ref',
      } as CkoRefundPaymentRequest;

      const mockUpdatedPayment = {
        id: 'payment-id',
        version: 2,
      } as Payment;

      jest.spyOn(mockRefundPaymentConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      jest.spyOn(mockPaymentApi, 'refundPayment').mockRejectedValue(new Error('Refund failed'));
      jest.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

      // Act
      const result = await service.refundPayment({
        payment: mockPayment,
        merchantReference: 'merchant-ref',
        amount: {
          centAmount: 1000,
          currencyCode: 'EUR',
        },
        transactionId: 'transaction-id',
      });

      // Assert
      expect(result).toMatchObject({
        outcome: PaymentModificationStatus.REJECTED,
        pspReference: 'cko-payment-id',
      });
      expect(mockPaymentService.updatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction: expect.objectContaining({
            state: 'Failure',
          }),
        }),
      );
    });
  });

  describe('reversePayment', () => {
    it('should reverse payment with CancelAuthorization when no charge exists', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-id',
        version: 1,
        interfaceId: 'cko-payment-id',
        amountPlanned: {
          centAmount: 1000,
          currencyCode: 'EUR',
        },
      } as Payment;

      const mockCkoRequest = {
        reference: 'merchant-ref',
      };

      const mockCkoResponse = {
        action_id: 'action-id-123',
        reference: 'merchant-ref',
      };

      const mockUpdatedPayment = {
        id: 'payment-id',
        version: 2,
      } as Payment;

      jest.spyOn(mockPaymentService, 'hasTransactionInState').mockReturnValue(false);
      jest.spyOn(mockReversePaymentConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      jest.spyOn(mockPaymentApi, 'reversePayment').mockResolvedValue(mockCkoResponse);
      jest.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

      // Act
      const result = await service.reversePayment({
        payment: mockPayment,
        merchantReference: 'merchant-ref',
      });

      // Assert
      expect(result).toMatchObject({
        outcome: PaymentModificationStatus.APPROVED,
        pspReference: 'cko-payment-id',
      });
      expect(mockPaymentApi.reversePayment).toHaveBeenCalledWith('cko-payment-id', mockCkoRequest);
      expect(mockPaymentService.updatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'payment-id',
          transaction: expect.objectContaining({
            type: 'CancelAuthorization',
            interfaceId: 'action-id-123',
            state: 'Success',
          }),
        }),
      );
    });

    it('should reverse payment with Refund when charge exists', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-id',
        version: 1,
        interfaceId: 'cko-payment-id',
        amountPlanned: {
          centAmount: 1000,
          currencyCode: 'EUR',
        },
      } as Payment;

      const mockCkoRequest = {
        reference: 'merchant-ref',
      };

      const mockCkoResponse = {
        action_id: 'action-id-123',
        reference: 'merchant-ref',
      };

      const mockUpdatedPayment = {
        id: 'payment-id',
        version: 2,
      } as Payment;

      jest.spyOn(mockPaymentService, 'hasTransactionInState').mockReturnValue(true);
      jest.spyOn(mockReversePaymentConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      jest.spyOn(mockPaymentApi, 'reversePayment').mockResolvedValue(mockCkoResponse);
      jest.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

      // Act
      const result = await service.reversePayment({
        payment: mockPayment,
        merchantReference: 'merchant-ref',
      });

      // Assert
      expect(result).toMatchObject({
        outcome: PaymentModificationStatus.APPROVED,
        pspReference: 'cko-payment-id',
      });
      expect(mockPaymentApi.reversePayment).toHaveBeenCalledWith('cko-payment-id', mockCkoRequest);
      expect(mockPaymentService.updatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'payment-id',
          transaction: expect.objectContaining({
            type: 'Refund',
            interfaceId: 'action-id-123',
            state: 'Success',
          }),
        }),
      );
    });

    it('should handle reverse payment failure', async () => {
      // Arrange
      const mockPayment = {
        id: 'payment-id',
        version: 1,
        interfaceId: 'cko-payment-id',
        amountPlanned: {
          centAmount: 1000,
          currencyCode: 'EUR',
        },
      } as Payment;

      const mockCkoRequest = {
        reference: 'merchant-ref',
      };

      const mockUpdatedPayment = {
        id: 'payment-id',
        version: 2,
      } as Payment;

      jest.spyOn(mockPaymentService, 'hasTransactionInState').mockReturnValue(false);
      jest.spyOn(mockReversePaymentConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      jest.spyOn(mockPaymentApi, 'reversePayment').mockRejectedValue(new Error('Reverse failed'));
      jest.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

      // Act
      const result = await service.reversePayment({
        payment: mockPayment,
        merchantReference: 'merchant-ref',
      });

      // Assert
      expect(result).toMatchObject({
        outcome: PaymentModificationStatus.REJECTED,
        pspReference: 'cko-payment-id',
      });
      expect(mockPaymentService.updatePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction: expect.objectContaining({
            state: 'Failure',
          }),
        }),
      );
    });
  });
});
