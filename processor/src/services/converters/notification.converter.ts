import { CustomFieldsDraft, Money, PaymentMethodInfoDraft, TransactionData } from '@commercetools/connect-payments-sdk';
import { CkoEventType, CkoWebhookEvent } from '../../clients/types/webhook.type';
import { NotificationUpdatePayment } from '../types/cko-payment.type';
import { UnsupportedNotificationError } from '../../errors/cko-api.error';
import { convertPaymentMethodFromCkoFormat } from '../../helpers/method-name.helper';

export class NotificationConverter {
  private eventMapper: Partial<Record<CkoEventType | string, (event: CkoWebhookEvent) => NotificationUpdatePayment>>;

  constructor() {
    this.eventMapper = {
      [CkoEventType.PAYMENT_APPROVED]: this.handlePaymentApproved,
      [CkoEventType.PAYMENT_CANCELED]: this.handlePaymentCanceled,
      [CkoEventType.PAYMENT_DECLINED]: this.handlePaymentDeclined,
      [CkoEventType.PAYMENT_EXPIRED]: this.handlePaymentExpired,
      // [CkoEventType.PAYMENT_PENDING]: this.handlePaymentPending, //TODO: review if this makes sense
      [CkoEventType.PAYMENT_CAPTURED]: this.handlePaymentCaptured,
      [CkoEventType.PAYMENT_CAPTURE_PENDING]: this.handlePaymentCaptured,
      [CkoEventType.PAYMENT_CAPTURE_DECLINED]: this.handlePaymentCaptureDeclined,
      [CkoEventType.PAYMENT_REFUNDED]: this.handlePaymentRefunded,
      [CkoEventType.PAYMENT_REFUND_DECLINED]: this.handlePaymentRefundDeclined,
      [CkoEventType.PAYMENT_REFUND_PENDING]: this.handlePaymentRefundPending,
      [CkoEventType.PAYMENT_VOIDED]: this.handlePaymentVoided,
      [CkoEventType.PAYMENT_VOID_DECLINED]: this.handlePaymentVoidDeclined,
      [CkoEventType.REVERSAL_APPROVED]: this.handleReversalApproved,
      [CkoEventType.REVERSAL_DECLINED]: this.handleReversalDeclined,
    };
  }

  public async convert(opts: { event: CkoWebhookEvent }): Promise<NotificationUpdatePayment> {
    const handler = this.eventMapper[opts.event.type];
    if (!handler) {
      throw new UnsupportedNotificationError({ notificationEvent: opts.event.type });
    }
    return handler(opts.event);
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

  private handlePaymentPending = (event: CkoWebhookEvent): NotificationUpdatePayment => {
    return {
      paymentId: this.getPaymentId(event),
      pspReference: event.data.id,
      paymentMethodInfo: this.convertPaymentMethodInfo(event),
      transaction: {
        type: 'Authorization',
        state: 'Pending',
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

  private handlePaymentCapturePending = (event: CkoWebhookEvent): NotificationUpdatePayment => {
    return {
      paymentId: this.getPaymentId(event),
      pspReference: event.data.id,
      paymentMethodInfo: this.convertPaymentMethodInfo(event),
      transaction: {
        type: 'Charge',
        state: 'Pending',
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

  private handleCapturePending = (event: CkoWebhookEvent): NotificationUpdatePayment => {
    return {
      paymentId: this.getPaymentId(event),
      pspReference: event.data.id,
      paymentMethodInfo: this.convertPaymentMethodInfo(event),
      transaction: {
        type: 'Charge',
        state: 'Pending',
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

  private handlePaymentRefundPending = (event: CkoWebhookEvent): NotificationUpdatePayment => {
    return {
      paymentId: this.getPaymentId(event),
      pspReference: event.data.id,
      paymentMethodInfo: this.convertPaymentMethodInfo(event),
      transaction: {
        type: 'Refund',
        state: 'Pending',
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

  //TODO: review reversal
  private handleReversalApproved = (event: CkoWebhookEvent): NotificationUpdatePayment => {
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

  private handleReversalDeclined = (event: CkoWebhookEvent): NotificationUpdatePayment => {
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
      ...(event.data.source?.type === 'card' ? { custom: this.convertCardPaymentMethod(event) } : {}),
    };
  }

  private convertCardPaymentMethod(event: CkoWebhookEvent): CustomFieldsDraft {
    return {
      type: {
        typeId: 'type',
        key: 'ctcheckout-card-details-type',
      },
      fields: {
        brand: CKO_CARD_MAPPING.get(event.data.source?.scheme || 'Unknown') || 'Unknown',
        expiryMonth: event.data.source?.expiry_month,
        expiryYear: event.data.source?.expiry_year,
        lastFour: event.data.source?.last_4,
        bin: event.data.source?.bin,
        storePaymentMethod: false,
      },
    };
  }
}

//TODO: complete the mapping
const CKO_CARD_MAPPING = new Map<string, string>([
  ['Amex', 'American Express'],
  ['Bancontact', 'Bancontact'],
  ['CartesBancaires', 'Cartes Bancaires'],
  ['Diners', 'Diners Club'],
  ['Discover', 'Discover'],
  ['EftposAu', 'Eftpos AU'],
  ['Jcb', 'JCB'],
  ['Link', 'Link'],
  ['Maestro', 'Maestro'],
  ['Mastercard', 'Mastercard'],
  ['UnionPay', 'UnionPay'],
  ['VISA', 'Visa'],
  ['Unknown', 'Unknown'],
]);
