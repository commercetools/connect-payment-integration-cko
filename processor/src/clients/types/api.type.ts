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
  CREATE_PAYMENT = '/payments',
  GET_PAYMENT = '/payments/{resourceId}',
  CAPTURE_PAYMENTS = '/payments/{resourceId}/captures',
  REFUND_PAYMENTS = '/payments/{resourceId}/refunds',
  VOID_PAYMENTS = '/payments/{resourceId}/voids',
  REVERSE_PAYMENTS = '/payments/{resourceId}/reversals',
  PAYMENT_METHODS = '/payment-methods',
  GET_INSTRUMENT = '/instruments/{resourceId}',
  DELETE_INSTRUMENT = '/instruments/{resourceId}',
}
