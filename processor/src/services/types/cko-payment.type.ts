import { CommercetoolsCartService, CommercetoolsPaymentService, TransactionData } from "@commercetools/connect-payments-sdk";

export type CkoPaymentServiceOptions = {
  ctCartService: CommercetoolsCartService;
  ctPaymentService: CommercetoolsPaymentService;
};

export type NotificationUpdatePayment = {
  paymentId: string;
  pspReference?: string;
  transaction: TransactionData;
  paymentMethod?: string;
};


