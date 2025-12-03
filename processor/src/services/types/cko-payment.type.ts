import {
  CommercetoolsCartService,
  CommercetoolsPaymentMethodService,
  CommercetoolsPaymentService,
  PaymentMethodInfoDraft,
  TransactionData,
} from '@commercetools/connect-payments-sdk';
import { ProcessStoredPaymentConverter } from '../converters/process-stored-payment.converter';
import { GetStoredPaymentMethodsConverter } from '../converters/get-stored-payment-methods.converter';
import { VoidPaymentConverter } from '../converters/void-payment.converter';
import { ReversePaymentConverter } from '../converters/reverse-payment.converter';
import { CapturePaymentConverter } from '../converters/capture-payment.converter';
import { RefundPaymentConverter } from '../converters/refund-payment.converter';
import { PaymentComponentsConverter } from '../converters/payment-components.converter';
import { CreatePaymentSessionConverter } from '../converters/create-payment-session.converter';
import { SubmitPaymentSessionConverter } from '../converters/submit-payment-session.converter';
import { NotificationConverter } from '../converters/notification.converter';

export type CkoPaymentServiceOptions = {
  ctCartService: CommercetoolsCartService;
  ctPaymentService: CommercetoolsPaymentService;
  ctPaymentMethodService: CommercetoolsPaymentMethodService;
  paymentComponentsConverter: PaymentComponentsConverter;
  createPaymentSessionConverter: CreatePaymentSessionConverter;
  submitPaymentSessionConverter: SubmitPaymentSessionConverter;
  notificationConverter: NotificationConverter;
};

export type CkoPaymentIntentServiceOptions = {
  ctPaymentService: CommercetoolsPaymentService;
  voidPaymentConverter: VoidPaymentConverter;
  reversePaymentConverter: ReversePaymentConverter;
  capturePaymentConverter: CapturePaymentConverter;
  refundPaymentConverter: RefundPaymentConverter;
};

export type CkoStoredPaymentMethodServiceOptions = {
  ctCartService: CommercetoolsCartService;
  ctPaymentService: CommercetoolsPaymentService;
  ctPaymentMethodService: CommercetoolsPaymentMethodService;
  getStoredPaymentMethodsConverter: GetStoredPaymentMethodsConverter;
  processStoredPaymentConverter: ProcessStoredPaymentConverter;
};

export type NotificationUpdatePayment = {
  paymentId: string;
  pspReference?: string;
  transaction: TransactionData;
  paymentMethodInfo: PaymentMethodInfoDraft;
};
