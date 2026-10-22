export type ApiRequestConfig = {
  url: string;
  method: string;
  data?: unknown;
};

export enum ApiResources {
  PAYMENT_SESSIONS = '/payment-sessions',
  SUBMIT_PAYMENT_SESSIONS = '/payment-sessions/{resourceId}/submit',
  CREATE_PAYMENT = '/payments',
  GET_PAYMENT = '/payments/{resourceId}',
  CAPTURE_PAYMENTS = '/payments/{resourceId}/captures',
  REFUND_PAYMENTS = '/payments/{resourceId}/refunds',
  VOID_PAYMENTS = '/payments/{resourceId}/voids',
  REVERSE_PAYMENTS = '/payments/{resourceId}/reversals',
  PAYMENT_METHODS = '/payment-methods',
  INSTRUMENTS = '/instruments/{resourceId}',
}
