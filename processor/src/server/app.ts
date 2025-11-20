import { CkoConfigHook } from '../libs/fastify/hooks/cko-config.hook';
import { HmacAuthHook } from '../libs/fastify/hooks/hmac-auth.hook';
import { paymentSDK } from '../payment-sdk';
import { CkoPaymentService } from '../services/cko-payment.service';
import { CkoStoredPaymentMethodService } from '../services/cko-stored-payment-method.service';

const paymentService = new CkoPaymentService({
  ctCartService: paymentSDK.ctCartService,
  ctPaymentService: paymentSDK.ctPaymentService,
  ctOrderService: paymentSDK.ctOrderService,
  ctPaymentMethodService: paymentSDK.ctPaymentMethodService,
});

const storedPaymentMethodService = new CkoStoredPaymentMethodService({
  ctCartService: paymentSDK.ctCartService,
  ctPaymentService: paymentSDK.ctPaymentService,
  ctPaymentMethodService: paymentSDK.ctPaymentMethodService,
});

export const app = {
  services: {
    paymentService,
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
