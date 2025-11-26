import { CkoConfigHook } from '@lib/fastify/hooks/cko-config.hook';
import { HmacAuthHook } from '@lib/fastify/hooks/hmac-auth.hook';
import { paymentSDK } from '@app/payment-sdk';
import { CkoPaymentIntentService } from '@app/services/cko-payment-intent.service';
import { CkoPaymentService } from '@app/services/cko-payment.service';
import { CkoStoredPaymentMethodService } from '@app/services/cko-stored-payment-method.service';

const paymentService = new CkoPaymentService({
  ctCartService: paymentSDK.ctCartService,
  ctPaymentService: paymentSDK.ctPaymentService,
  ctPaymentMethodService: paymentSDK.ctPaymentMethodService,
});

const paymentIntentService = new CkoPaymentIntentService({
  ctPaymentService: paymentSDK.ctPaymentService,
});

const storedPaymentMethodService = new CkoStoredPaymentMethodService({
  ctCartService: paymentSDK.ctCartService,
  ctPaymentService: paymentSDK.ctPaymentService,
  ctPaymentMethodService: paymentSDK.ctPaymentMethodService,
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
