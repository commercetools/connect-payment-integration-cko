import {
  CustomFieldsDraft,
  GenerateCardDetailsCustomFieldsDraft,
  Money,
  PaymentMethodInfoDraft,
} from '@commercetools/connect-payments-sdk';
import { CkoEventType, CkoWebhookEvent } from '@app/clients/types/webhook.type';
import { NotificationUpdatePayment } from '../types/cko-payment.type';
import { UnsupportedNotificationError } from '@app/errors/cko-api.error';
import { convertPaymentMethodFromCkoFormat } from '@app/helpers/method-name.helper';
import { getConfig } from '@app/config/config';
import { convertCardBrand } from './helper.converter';

export class NotificationConverter {
  private eventMapper: Partial<Record<CkoEventType | string, (event: CkoWebhookEvent) => NotificationUpdatePayment>>;

  constructor() {
    this.eventMapper = {
      [CkoEventType.PAYMENT_APPROVED]: this.handlePaymentApproved,
      [CkoEventType.PAYMENT_CANCELED]: this.handlePaymentCanceled,
      [CkoEventType.PAYMENT_DECLINED]: this.handlePaymentDeclined,
      [CkoEventType.PAYMENT_EXPIRED]: this.handlePaymentExpired,
      [CkoEventType.PAYMENT_CAPTURED]: this.handlePaymentCaptured,
      [CkoEventType.PAYMENT_CAPTURE_DECLINED]: this.handlePaymentCaptureDeclined,
      [CkoEventType.PAYMENT_REFUNDED]: this.handlePaymentRefunded,
      [CkoEventType.PAYMENT_REFUND_DECLINED]: this.handlePaymentRefundDeclined,
      [CkoEventType.PAYMENT_VOIDED]: this.handlePaymentVoided,
      [CkoEventType.PAYMENT_VOID_DECLINED]: this.handlePaymentVoidDeclined,
    };
  }

  public async convert(opts: { event: CkoWebhookEvent }): Promise<NotificationUpdatePayment> {
    const handler = this.eventMapper[opts.event.type];
    if (!handler) {
      throw new UnsupportedNotificationError({ notificationEvent: opts.event.type });
    }
    return {
      ...handler(opts.event),
      storePaymentMethod: this.shouldStorePaymentMethod(opts.event),
    };
  }

  /**
   * Whether the shopper asked to save the card used in the payment. It does not depend on the channel setting
   * `savePaymentMethodAdditionalDetails`, which only controls the extra card details.
   */
  private shouldStorePaymentMethod(event: CkoWebhookEvent): boolean {
    return Boolean(
      event.data.source?.type === 'card' && event.data.source?.id && !event.data.metadata?.payment_method_id,
    );
  }

  private handlePaymentApproved = (event: CkoWebhookEvent): NotificationUpdatePayment => {
    return {
      paymentId: this.getPaymentId(event),
      pspReference: event.data.id,
      paymentMethodInfo: this.convertPaymentMethodInfo(event),
      transaction: {
        type: 'Authorization',
        state: 'Success',
        amount: this.convertAmount(event),
        interfaceId: event.data.id,
      },
    };
  };

  private handlePaymentCanceled = (event: CkoWebhookEvent): NotificationUpdatePayment => {
    return {
      paymentId: this.getPaymentId(event),
      pspReference: event.data.id,
      paymentMethodInfo: this.convertPaymentMethodInfo(event),
      transaction: {
        type: 'Authorization',
        state: 'Failure',
        amount: this.convertAmount(event),
        interfaceId: event.data.id,
      },
    };
  };

  private handlePaymentDeclined = (event: CkoWebhookEvent): NotificationUpdatePayment => {
    return {
      paymentId: this.getPaymentId(event),
      pspReference: event.data.id,
      paymentMethodInfo: this.convertPaymentMethodInfo(event),
      transaction: {
        type: 'Authorization',
        state: 'Failure',
        amount: this.convertAmount(event),
        interfaceId: event.data.id,
      },
    };
  };

  private handlePaymentExpired = (event: CkoWebhookEvent): NotificationUpdatePayment => {
    return {
      paymentId: this.getPaymentId(event),
      pspReference: event.data.id,
      paymentMethodInfo: this.convertPaymentMethodInfo(event),
      transaction: {
        type: 'Authorization',
        state: 'Failure',
        amount: this.convertAmount(event),
        interfaceId: event.data.id,
      },
    };
  };

  private handlePaymentCaptured = (event: CkoWebhookEvent): NotificationUpdatePayment => {
    return {
      paymentId: this.getPaymentId(event),
      pspReference: event.data.id,
      paymentMethodInfo: this.convertPaymentMethodInfo(event),
      transaction: {
        type: 'Charge',
        state: 'Success',
        amount: this.convertAmount(event),
        interfaceId: event.data.action_id,
      },
    };
  };

  private handlePaymentCaptureDeclined = (event: CkoWebhookEvent): NotificationUpdatePayment => {
    return {
      paymentId: this.getPaymentId(event),
      pspReference: event.data.id,
      paymentMethodInfo: this.convertPaymentMethodInfo(event),
      transaction: {
        type: 'Charge',
        state: 'Failure',
        amount: this.convertAmount(event),
        interfaceId: event.data.action_id,
      },
    };
  };

  private handlePaymentRefunded = (event: CkoWebhookEvent): NotificationUpdatePayment => {
    return {
      paymentId: this.getPaymentId(event),
      pspReference: event.data.id,
      paymentMethodInfo: this.convertPaymentMethodInfo(event),
      transaction: {
        type: 'Refund',
        state: 'Success',
        amount: this.convertAmount(event),
        interfaceId: event.data.action_id,
      },
    };
  };

  private handlePaymentRefundDeclined = (event: CkoWebhookEvent): NotificationUpdatePayment => {
    return {
      paymentId: this.getPaymentId(event),
      pspReference: event.data.id,
      paymentMethodInfo: this.convertPaymentMethodInfo(event),
      transaction: {
        type: 'Refund',
        state: 'Failure',
        amount: this.convertAmount(event),
        interfaceId: event.data.action_id,
      },
    };
  };

  private handlePaymentVoided = (event: CkoWebhookEvent): NotificationUpdatePayment => {
    return {
      paymentId: this.getPaymentId(event),
      pspReference: event.data.id,
      paymentMethodInfo: this.convertPaymentMethodInfo(event),
      transaction: {
        type: 'CancelAuthorization',
        state: 'Success',
        amount: this.convertAmount(event),
        interfaceId: event.data.action_id,
      },
    };
  };

  private handlePaymentVoidDeclined = (event: CkoWebhookEvent): NotificationUpdatePayment => {
    return {
      paymentId: this.getPaymentId(event),
      pspReference: event.data.id,
      paymentMethodInfo: this.convertPaymentMethodInfo(event),
      transaction: {
        type: 'CancelAuthorization',
        state: 'Failure',
        amount: this.convertAmount(event),
        interfaceId: event.data.action_id,
      },
    };
  };

  private getPaymentId(event: CkoWebhookEvent): string {
    return event.data.metadata?.payment_id || event.data.reference || 'unknown_payment_id';
  }

  private convertAmount(event: CkoWebhookEvent): Money {
    return {
      centAmount: event.data.amount as number,
      currencyCode: event.data.currency as string,
    };
  }

  private convertPaymentMethodInfo(event: CkoWebhookEvent): PaymentMethodInfoDraft {
    const method = event.data.source?.card_wallet_type || event.data.source?.type;

    return {
      ...(method ? { method: convertPaymentMethodFromCkoFormat(method) } : {}),
      ...(event.data.source?.type === 'card'
        ? {
            ...(event.data.source?.id && {
              token: {
                value: event.data.source.id,
              },
            }),
            custom: this.convertCardPaymentMethod(event),
          }
        : {}),
    };
  }

  private convertCardPaymentMethod(event: CkoWebhookEvent): CustomFieldsDraft | undefined {
    if (!getConfig().isSavePaymentMethodAdditionalDetails()) {
      return undefined;
    }

    return GenerateCardDetailsCustomFieldsDraft({
      brand: convertCardBrand(event.data.source?.scheme),
      lastFour: event.data.source?.last_4,
      bin: event.data.source?.bin,
      expiryMonth: event.data.source?.expiry_month,
      expiryYear: event.data.source?.expiry_year,
      storePaymentMethod: this.shouldStorePaymentMethod(event),
    });
  }
}
