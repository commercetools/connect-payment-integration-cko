export type ApiRequestConfig = {
  url: string;
  method: string;
  data?: unknown;
};

export enum ApiBasePath {
  SANDBOX = 'https://api.sandbox.checkout.com',
  PRODUCTION = 'https://api.checkout.com',
}

export enum ApiResources {
  PAYMENT_SESSIONS = '/payment-sessions',
  SUBMIT_PAYMENT_SESSIONS = '/payment-sessions/{resourceId}/submit',
  CAPTURE_PAYMENTS = '/payments/{resourceId}/captures',
  REFUND_PAYMENTS = '/payments/{resourceId}/refunds',
  VOID_PAYMENTS = '/payments/{resourceId}/voids',
  REVERSE_PAYMENTS = '/payments/{resourceId}/reversals',
}
