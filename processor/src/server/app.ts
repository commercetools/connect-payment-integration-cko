import { CkoConfigHook } from '@lib/fastify/hooks/cko-config.hook';
import { HmacAuthHook } from '@lib/fastify/hooks/hmac-auth.hook';
import { paymentSDK } from '@app/payment-sdk';
import { CkoPaymentIntentService } from '@app/services/cko-payment-intent.service';
import { CkoPaymentService } from '@app/services/cko-payment.service';
import { CkoStoredPaymentMethodService } from '@app/services/cko-stored-payment-method.service';
import { GetStoredPaymentMethodsConverter } from '@app/services/converters/get-stored-payment-methods.converter';
import { ProcessStoredPaymentConverter } from '@app/services/converters/process-stored-payment.converter';
import { VoidPaymentConverter } from '@app/services/converters/void-payment.converter';
import { ReversePaymentConverter } from '@app/services/converters/reverse-payment.converter';
import { CapturePaymentConverter } from '@app/services/converters/capture-payment.converter';
import { RefundPaymentConverter } from '@app/services/converters/refund-payment.converter';
import { PaymentComponentsConverter } from '@app/services/converters/payment-components.converter';
import { CreatePaymentSessionConverter } from '@app/services/converters/create-payment-session.converter';
import { SubmitPaymentSessionConverter } from '@app/services/converters/submit-payment-session.converter';
import { NotificationConverter } from '@app/services/converters/notification.converter';

const getStoredPaymentMethodsConverter = new GetStoredPaymentMethodsConverter();
const processStoredPaymentConverter = new ProcessStoredPaymentConverter();
const voidPaymentConverter = new VoidPaymentConverter();
const reversePaymentConverter = new ReversePaymentConverter();
const capturePaymentConverter = new CapturePaymentConverter();
const refundPaymentConverter = new RefundPaymentConverter();
const paymentComponentsConverter = new PaymentComponentsConverter();
const createPaymentSessionConverter = new CreatePaymentSessionConverter();
const submitPaymentSessionConverter = new SubmitPaymentSessionConverter();
const notificationConverter = new NotificationConverter();

const paymentService = new CkoPaymentService({
  ctCartService: paymentSDK.ctCartService,
  ctPaymentService: paymentSDK.ctPaymentService,
  ctPaymentMethodService: paymentSDK.ctPaymentMethodService,
  paymentComponentsConverter,
  createPaymentSessionConverter,
  submitPaymentSessionConverter,
  notificationConverter,
});

const paymentIntentService = new CkoPaymentIntentService({
  ctPaymentService: paymentSDK.ctPaymentService,
  voidPaymentConverter,
  reversePaymentConverter,
  capturePaymentConverter,
  refundPaymentConverter,
});

const storedPaymentMethodService = new CkoStoredPaymentMethodService({
  ctCartService: paymentSDK.ctCartService,
  ctPaymentService: paymentSDK.ctPaymentService,
  ctPaymentMethodService: paymentSDK.ctPaymentMethodService,
  getStoredPaymentMethodsConverter,
  processStoredPaymentConverter,
});

export const app = {
  services: {
    paymentService,
    paymentIntentService,
    storedPaymentMethodService,
  },
  hooks: {
    hmacAuthHook: new HmacAuthHook(),
    ckoConfigHook: new CkoConfigHook({
      cartService: paymentSDK.ctCartService,
      orderService: paymentSDK.ctOrderService,
    }),
  },
};
