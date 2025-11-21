import { HandleSubmitResponse, SubmitData } from "@checkout.com/checkout-web-components";
import { CocoStoredPaymentMethod } from "../payment-enabler/payment-enabler";

export type PaymentConfigResponse = {
  publicKey: string;
  environment: "sandbox" | "production";
  storedPaymentMethodsEnabled: boolean;
  [key: string]: unknown;
};

export type StoredPaymentMethodsResponse = {
  storedPaymentMethods: CocoStoredPaymentMethod[];
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
  storePaymentMethod?: boolean;
};

export type SubmitPaymentSessionResponse = HandleSubmitResponse & {
  paymentReference: string;
  [key: string]: unknown;
};

export type PayWithStoredMethodRequest = {
  paymentReference: string;
};

export type PayWithStoredMethodResponse = {
  id: string;
  status: string;
  paymentReference: string;
  [key: string]: unknown;
};
