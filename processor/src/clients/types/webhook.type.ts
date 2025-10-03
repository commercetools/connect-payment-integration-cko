export enum CkoEventType {
  PAYMENT_APPROVED = 'payment_approved',
  PAYMENT_CANCELED = 'payment_canceled',
  PAYMENT_DECLINED = 'payment_declined',
  PAYMENT_CAPTURED = 'payment_captured',
  PAYMENT_CAPTURE_DECLINED = 'payment_capture_declined',
  PAYMENT_CAPTURE_PENDING = 'payment_capture_pending',
  PAYMENT_PENDING = 'payment_pending',
  PAYMENT_REFUNDED = 'payment_refunded',
  PAYMENT_REFUND_DECLINED = 'payment_refund_declined',
  PAYMENT_REFUND_PENDING = 'payment_refund_pending',
  PAYMENT_VOIDED = 'payment_voided',
  PAYMENT_VOID_DECLINED = 'payment_void_declined',
  PAYMENT_EXPIRED = 'payment_expired',
  PAYMENT_PAID = 'payment_paid',
  PAYMENT_RETURNED = 'payment_returned',
  REVERSAL_APPROVED = 'reversal_approved',
  REVERSAL_DECLINED = 'reversal_declined',
}

export type CkoWebhookEvent = {
  id: string;
  type: CkoEventType | string;
  version?: string;
  created_on: string;
  data: {
    id: string;
    action_id: string;
    reference?: string;
    processing_channel_id?: string;
    amount?: number;
    currency?: string;
    payment_type?: string;
    response_code?: string;
    response_summary?: string;
    risk?: {
      flagged: boolean;
      [key: string]: unknown;
    };
    metadata: {
      payment_id?: string;
      [key: string]: unknown;
    };
    source?: {
      id?: string;
      type?: string;
      [key: string]: unknown;
    };
  };
  _links?: unknown;
  [key: string]: unknown;
};
