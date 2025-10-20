import {
  PaymentSessionResponse,
  SubmitPaymentSessionRequest,
  SubmitPaymentSessionResponse,
} from '../clients/types/payment-session.type';

export enum PaymentOutcome {
  AUTHORIZED = 'Authorized',
  REJECTED = 'Rejected',
}

export enum PaymentMethodType {
  CARD = 'card',
  CUSTOM_TEST_METHOD = 'customtestmethod',
  INVOICE = 'invoice',
  PURCHASE_ORDER = 'purchaseorder',
}

export type PaymentSessionRequestDTO = {
  locale?: string;
};

export type PaymentSessionResponseDTO = PaymentSessionResponse & {
  paymentReference: string;
};

export type SubmitPaymentSessionRequestDTO = SubmitPaymentSessionRequest & {
  paymentReference: string;
};

export type SubmitPaymentSessionResponseDTO = SubmitPaymentSessionResponse & {
  paymentReference: string;
};

export type PaymentConfirmResponseDTO = {
  paymentReference: string;
  merchantReturnUrl: string;
};
