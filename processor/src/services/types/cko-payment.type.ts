import {
  CommercetoolsCartService,
  CommercetoolsPaymentMethodService,
  CommercetoolsPaymentService,
  PaymentMethodInfoDraft,
  TransactionData,
} from '@commercetools/connect-payments-sdk';

export type CkoPaymentServiceOptions = {
  ctCartService: CommercetoolsCartService;
  ctPaymentService: CommercetoolsPaymentService;
  ctPaymentMethodService: CommercetoolsPaymentMethodService;
};

export type CkoPaymentIntentServiceOptions = {
  ctPaymentService: CommercetoolsPaymentService;
};


export type CkoStoredPaymentMethodServiceOptions = {
  ctCartService: CommercetoolsCartService;
  ctPaymentService: CommercetoolsPaymentService;
  ctPaymentMethodService: CommercetoolsPaymentMethodService;
};

export type NotificationUpdatePayment = {
  paymentId: string;
  pspReference?: string;
  transaction: TransactionData;
  paymentMethodInfo: PaymentMethodInfoDraft;
};
