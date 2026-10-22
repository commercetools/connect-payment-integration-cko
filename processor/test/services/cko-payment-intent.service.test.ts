import { CommercetoolsPaymentService, Payment } from '@commercetools/connect-payments-sdk';
import { beforeEach, describe, expect, it, type Mocked, type MockedFunction, vi } from 'vitest';
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
  };
});

describe('CkoPaymentIntentService', () => {
  const mockPaymentService = {
    createPayment: vi.fn(),
    getPayment: vi.fn(),
    updatePayment: vi.fn(),
    hasTransactionInState: vi.fn(),
  } as unknown as Mocked<CommercetoolsPaymentService>;

  const mockVoidPaymentConverter = {
    convertRequest: vi.fn(),
    convertResponse: vi.fn(),
  } as unknown as VoidPaymentConverter;

  const mockReversePaymentConverter = {
    convertRequest: vi.fn(),
    convertResponse: vi.fn(),
  } as unknown as ReversePaymentConverter;

  const mockCapturePaymentConverter = {
    convertRequest: vi.fn(),
    convertResponse: vi.fn(),
  } as unknown as CapturePaymentConverter;

  const mockRefundPaymentConverter = {
    convertRequest: vi.fn(),
    convertResponse: vi.fn(),
  } as unknown as RefundPaymentConverter;

  const service = new CkoPaymentIntentService({
    ctPaymentService: mockPaymentService,
    voidPaymentConverter: mockVoidPaymentConverter,
    reversePaymentConverter: mockReversePaymentConverter,
    capturePaymentConverter: mockCapturePaymentConverter,
    refundPaymentConverter: mockRefundPaymentConverter,
  });

  const mockPaymentApi = new PaymentApi();
  const mockGetCkoApiClient = getCkoApiClient as MockedFunction<typeof getCkoApiClient>;
  const mockCkoClient = {
    payments: mockPaymentApi,
  } as unknown as CkoApi;

  mockGetCkoApiClient.mockReturnValue(mockCkoClient);

  beforeEach(() => {
    vi.clearAllMocks();
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

      vi.spyOn(mockCapturePaymentConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      vi.spyOn(mockPaymentApi, 'capturePayment').mockResolvedValue(mockCkoResponse);
      vi.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

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

      vi.spyOn(mockCapturePaymentConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      vi.spyOn(mockPaymentApi, 'capturePayment').mockRejectedValue(new Error('Capture failed'));
      vi.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

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

      vi.spyOn(mockVoidPaymentConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      vi.spyOn(mockPaymentApi, 'voidPayment').mockResolvedValue(mockCkoResponse);
      vi.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

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

      vi.spyOn(mockVoidPaymentConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      vi.spyOn(mockPaymentApi, 'voidPayment').mockRejectedValue(new Error('Void failed'));
      vi.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

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

      vi.spyOn(mockRefundPaymentConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      vi.spyOn(mockPaymentApi, 'refundPayment').mockResolvedValue(mockCkoResponse);
      vi.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

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

      vi.spyOn(mockRefundPaymentConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      vi.spyOn(mockPaymentApi, 'refundPayment').mockRejectedValue(new Error('Refund failed'));
      vi.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

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

      vi.spyOn(mockPaymentService, 'hasTransactionInState').mockReturnValue(false);
      vi.spyOn(mockReversePaymentConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      vi.spyOn(mockPaymentApi, 'reversePayment').mockResolvedValue(mockCkoResponse);
      vi.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

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

      vi.spyOn(mockPaymentService, 'hasTransactionInState').mockReturnValue(true);
      vi.spyOn(mockReversePaymentConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      vi.spyOn(mockPaymentApi, 'reversePayment').mockResolvedValue(mockCkoResponse);
      vi.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

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

      vi.spyOn(mockPaymentService, 'hasTransactionInState').mockReturnValue(false);
      vi.spyOn(mockReversePaymentConverter, 'convertRequest').mockReturnValue(mockCkoRequest);
      vi.spyOn(mockPaymentApi, 'reversePayment').mockRejectedValue(new Error('Reverse failed'));
      vi.spyOn(mockPaymentService, 'updatePayment').mockResolvedValue(mockUpdatedPayment);

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
