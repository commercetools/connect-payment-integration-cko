export enum CkoPaymentStatus {
  Pending = 'Pending',
  Authorized = 'Authorized',
  CardVerified = 'Card Verified',
  Voided = 'Voided',
  PartiallyCaptured = 'Partially Captured',
  Captured = 'Captured',
  PartiallyRefunded = 'Partially Refunded',
  Refunded = 'Refunded',
  Declined = 'Declined',
  Canceled = 'Canceled',
  Expired = 'Expired',
  Paid = 'Paid',
  RetryScheduled = 'Retry Scheduled',
}

export type CkoGetPaymentResponse = {
  id: string;
  requested_on: string;
  amount: number;
  currency: string;
  status: CkoPaymentStatus;
  approved: boolean;
  reference?: string;
  payment_type?: string;
  source?: {
    id?: string;
    type: string;
    expiry_month?: number;
    expiry_year?: number;
    scheme?: string;
    bin?: string;
    last_4?: string;
    card_wallet_type?: string;
    [key: string]: unknown;
  };
  links?: {
    payment: { href: string };
  };
  [key: string]: unknown;
};

export type CkoVoidPaymentRequest = {
  reference?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export type CkoVoidPaymentResponse = {
  action_id: string;
  reference?: string;
  links?: {
    payment: { href: string };
  };
  [key: string]: unknown;
};

export type CkoReversePaymentRequest = {
  reference?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export type CkoReversePaymentResponse = {
  action_id: string;
  reference?: string;
  links?: {
    payment: { href: string };
  };
  [key: string]: unknown;
};

export type CkoCapturePaymentRequest = {
  reference?: string;
  amount?: number;
  capture_type?: 'Final' | 'NonFinal';
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export type CkoCapturePaymentResponse = {
  action_id: string;
  reference?: string;
  links?: {
    payment: { href: string };
    redirect?: { href: string };
  };
  [key: string]: unknown;
};

export type CkoRefundPaymentRequest = {
  amount?: number;
  reference?: string;
  capture_action_id?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export type CkoRefundPaymentResponse = {
  action_id: string;
  reference?: string;
  links?: {
    payment: { href: string };
  };
  [key: string]: unknown;
};
