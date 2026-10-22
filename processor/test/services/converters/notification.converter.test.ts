import { CkoEventType, CkoWebhookEvent } from '../../../src/clients/types/webhook.type';
import { UnsupportedNotificationError } from '../../../src/errors/cko-api.error';
import { getConfig } from '../../../src/config/config';
import { NotificationConverter } from '../../../src/services/converters/notification.converter';
import { beforeEach, describe, expect, type MockedFunction, test, vi } from 'vitest';

vi.mock('../../../src/config/config');
vi.mock('../../../src/helpers/method-name.helper', () => ({
  convertPaymentMethodFromCkoFormat: vi.fn((method: string) => `converted_${method}`),
}));

const mockGetConfig = getConfig as MockedFunction<typeof getConfig>;

describe('NotificationConverter', () => {
  let converter: NotificationConverter;

  beforeEach(() => {
    converter = new NotificationConverter();
    vi.clearAllMocks();
  });

  const createMockEvent = (type: CkoEventType, overrides: Partial<CkoWebhookEvent> = {}): CkoWebhookEvent =>
    ({
      type,
      data: {
        id: 'pay_123',
        amount: 10000,
        currency: 'USD',
        metadata: {
          payment_id: 'ct-payment-123',
        },
        ...overrides.data,
      },
      ...overrides,
    }) as CkoWebhookEvent;

  describe('convert', () => {
    beforeEach(() => {
      mockGetConfig.mockReturnValue({
        isSavePaymentMethodAdditionalDetails: () => false,
      } as any);
    });

    test('should throw UnsupportedNotificationError for unknown event type', async () => {
      const event = createMockEvent('unknown_event' as CkoEventType);

      await expect(converter.convert({ event })).rejects.toThrow(UnsupportedNotificationError);
    });

    test('should handle PAYMENT_APPROVED event', async () => {
      const event = createMockEvent(CkoEventType.PAYMENT_APPROVED);

      const result = await converter.convert({ event });

      expect(result).toEqual({
        paymentId: 'ct-payment-123',
        pspReference: 'pay_123',
        paymentMethodInfo: expect.any(Object),
        transaction: {
          type: 'Authorization',
          state: 'Success',
          amount: {
            centAmount: 10000,
            currencyCode: 'USD',
          },
          interfaceId: 'pay_123',
        },
      });
    });

    test('should handle PAYMENT_CANCELED event', async () => {
      const event = createMockEvent(CkoEventType.PAYMENT_CANCELED);

      const result = await converter.convert({ event });

      expect(result.transaction).toMatchObject({
        type: 'Authorization',
        state: 'Failure',
      });
    });

    test('should handle PAYMENT_DECLINED event', async () => {
      const event = createMockEvent(CkoEventType.PAYMENT_DECLINED);

      const result = await converter.convert({ event });

      expect(result.transaction).toMatchObject({
        type: 'Authorization',
        state: 'Failure',
      });
    });

    test('should handle PAYMENT_EXPIRED event', async () => {
      const event = createMockEvent(CkoEventType.PAYMENT_EXPIRED);

      const result = await converter.convert({ event });

      expect(result.transaction).toMatchObject({
        type: 'Authorization',
        state: 'Failure',
      });
    });

    test('should handle PAYMENT_CAPTURED event', async () => {
      const event = createMockEvent(CkoEventType.PAYMENT_CAPTURED, {
        data: {
          id: 'pay_123',
          action_id: 'act_capture_456',
          amount: 8000,
          currency: 'EUR',
          metadata: {
            payment_id: 'ct-payment-789',
          },
        },
      } as unknown as CkoWebhookEvent);

      const result = await converter.convert({ event });

      expect(result.transaction).toMatchObject({
        type: 'Charge',
        state: 'Success',
        interfaceId: 'act_capture_456',
      });
    });

    test('should handle PAYMENT_CAPTURE_DECLINED event', async () => {
      const event = createMockEvent(CkoEventType.PAYMENT_CAPTURE_DECLINED, {
        data: {
          id: 'pay_123',
          action_id: 'act_capture_fail_789',
          metadata: { payment_id: 'ct-payment-456' },
        },
      } as unknown as CkoWebhookEvent);

      const result = await converter.convert({ event });

      expect(result.transaction).toMatchObject({
        type: 'Charge',
        state: 'Failure',
        interfaceId: 'act_capture_fail_789',
      });
    });

    test('should handle PAYMENT_REFUNDED event', async () => {
      const event = createMockEvent(CkoEventType.PAYMENT_REFUNDED, {
        data: {
          id: 'pay_123',
          action_id: 'act_refund_321',
          metadata: { payment_id: 'ct-payment-ref-123' },
        },
      } as unknown as CkoWebhookEvent);

      const result = await converter.convert({ event });

      expect(result.transaction).toMatchObject({
        type: 'Refund',
        state: 'Success',
        interfaceId: 'act_refund_321',
      });
    });

    test('should handle PAYMENT_REFUND_DECLINED event', async () => {
      const event = createMockEvent(CkoEventType.PAYMENT_REFUND_DECLINED, {
        data: {
          id: 'pay_123',
          action_id: 'act_refund_fail_654',
          metadata: { payment_id: 'ct-payment-ref-fail' },
        },
      } as unknown as CkoWebhookEvent);

      const result = await converter.convert({ event });

      expect(result.transaction).toMatchObject({
        type: 'Refund',
        state: 'Failure',
        interfaceId: 'act_refund_fail_654',
      });
    });

    test('should handle PAYMENT_VOIDED event', async () => {
      const event = createMockEvent(CkoEventType.PAYMENT_VOIDED, {
        data: {
          id: 'pay_123',
          action_id: 'act_void_999',
          metadata: { payment_id: 'ct-payment-void' },
        },
      } as unknown as CkoWebhookEvent);

      const result = await converter.convert({ event });

      expect(result.transaction).toMatchObject({
        type: 'CancelAuthorization',
        state: 'Success',
        interfaceId: 'act_void_999',
      });
    });

    test('should handle PAYMENT_VOID_DECLINED event', async () => {
      const event = createMockEvent(CkoEventType.PAYMENT_VOID_DECLINED, {
        data: {
          id: 'pay_123',
          action_id: 'act_void_fail_888',
          metadata: { payment_id: 'ct-payment-void-fail' },
        },
      } as unknown as CkoWebhookEvent);

      const result = await converter.convert({ event });

      expect(result.transaction).toMatchObject({
        type: 'CancelAuthorization',
        state: 'Failure',
        interfaceId: 'act_void_fail_888',
      });
    });

    test('should use payment_id from metadata when available', async () => {
      const event = createMockEvent(CkoEventType.PAYMENT_APPROVED, {
        data: {
          id: 'pay_123',
          reference: 'ref_456',
          metadata: {
            payment_id: 'ct-payment-from-metadata',
          },
        },
      } as unknown as CkoWebhookEvent);

      const result = await converter.convert({ event });

      expect(result.paymentId).toBe('ct-payment-from-metadata');
    });

    test('should fallback to reference when metadata.payment_id is not available', async () => {
      const event = createMockEvent(CkoEventType.PAYMENT_APPROVED, {
        data: {
          id: 'pay_123',
          reference: 'ref_fallback',
          metadata: {},
        },
      } as unknown as CkoWebhookEvent);

      const result = await converter.convert({ event });

      expect(result.paymentId).toBe('ref_fallback');
    });

    test('should use unknown_payment_id when neither metadata nor reference available', async () => {
      const event = createMockEvent(CkoEventType.PAYMENT_APPROVED, {
        data: {
          id: 'pay_123',
        },
      } as unknown as CkoWebhookEvent);

      const result = await converter.convert({ event });

      expect(result.paymentId).toBe('unknown_payment_id');
    });

    test('should convert payment method from card_wallet_type', async () => {
      const event = createMockEvent(CkoEventType.PAYMENT_APPROVED, {
        data: {
          id: 'pay_123',
          amount: 10000,
          currency: 'USD',
          source: {
            type: 'applepay',
            card_wallet_type: 'applepay',
          },
          metadata: {
            payment_id: 'ct-123',
          },
        },
      } as unknown as CkoWebhookEvent);

      const result = await converter.convert({ event });

      expect(result.paymentMethodInfo).toEqual({
        method: 'converted_applepay',
      });
    });

    test('should convert card payment method with token', async () => {
      const event = createMockEvent(CkoEventType.PAYMENT_APPROVED, {
        data: {
          id: 'pay_123',
          amount: 10000,
          currency: 'USD',
          source: {
            type: 'card',
            id: 'src_card_token_123',
          },
          metadata: {
            payment_id: 'ct-123',
          },
        },
      } as unknown as CkoWebhookEvent);

      const result = await converter.convert({ event });

      expect(result.paymentMethodInfo).toEqual({
        method: 'converted_card',
        token: {
          value: 'src_card_token_123',
        },
      });
    });

    test('should include custom card details when enabled', async () => {
      mockGetConfig.mockReturnValue({
        isSavePaymentMethodAdditionalDetails: () => true,
      } as any);

      const event = createMockEvent(CkoEventType.PAYMENT_APPROVED, {
        data: {
          id: 'pay_123',
          amount: 10000,
          currency: 'USD',
          source: {
            type: 'card',
            id: 'src_card_123',
            scheme: 'VISA',
            last_4: '4242',
            bin: '424242',
            expiry_month: 12,
            expiry_year: 2025,
          },
          metadata: {
            payment_id: 'ct-123',
          },
        },
      } as unknown as CkoWebhookEvent);

      const result = await converter.convert({ event });

      expect(result.paymentMethodInfo).toHaveProperty('custom');
      expect(result.paymentMethodInfo.custom).toBeDefined();
    });

    test('should handle non-card payment methods', async () => {
      const event = createMockEvent(CkoEventType.PAYMENT_APPROVED, {
        data: {
          id: 'pay_123',
          amount: 10000,
          currency: 'USD',
          source: {
            type: 'paypal',
          },
          metadata: {
            payment_id: 'ct-123',
          },
        },
      } as unknown as CkoWebhookEvent);

      const result = await converter.convert({ event });

      expect(result.paymentMethodInfo).toEqual({
        method: 'converted_paypal',
      });
    });

    test('should not include method when source type is not available', async () => {
      const event = createMockEvent(CkoEventType.PAYMENT_APPROVED, {
        data: {
          id: 'pay_123',
          amount: 10000,
          currency: 'USD',
          source: {},
          metadata: {
            payment_id: 'ct-123',
          },
        },
      } as unknown as CkoWebhookEvent);

      const result = await converter.convert({ event });

      expect(result.paymentMethodInfo).toEqual({});
    });
  });
});
