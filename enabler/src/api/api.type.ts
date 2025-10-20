import { HandleSubmitResponse, SubmitData } from "@checkout.com/checkout-web-components";

export type PaymentConfigResponse = {
  publicKey: string;
  environment: "sandbox" | "production";
  [key: string]: unknown;
};

export type CreatePaymentSessionRequest = {
  locale?: string;
};

export type CreatePaymentSessionResponse = {
  id: string;
  paymentReference: string;
  payment_session_secret: string;
  payment_session_token: string;
  [key: string]: unknown;
};

export type SubmitPaymentSessionRequest = SubmitData & {
  paymentReference: string;
};

export type SubmitPaymentSessionResponse = HandleSubmitResponse & {
  paymentReference: string;
  [key: string]: unknown;
};
