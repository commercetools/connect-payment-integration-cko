export type CkoVoidPaymentRequest = {
  reference?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

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
}

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
