import {
  CommercetoolsCartService,
  CommercetoolsOrderService,
  CommercetoolsPaymentMethodService,
  CommercetoolsPaymentService,
  PaymentMethodInfoDraft,
  TransactionData,
} from '@commercetools/connect-payments-sdk';

export type CkoPaymentServiceOptions = {
  ctCartService: CommercetoolsCartService;
  ctPaymentService: CommercetoolsPaymentService;
  ctOrderService: CommercetoolsOrderService;
  ctPaymentMethodService: CommercetoolsPaymentMethodService;
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
