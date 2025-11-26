import { FastifyInstance } from 'fastify';
import { paymentSDK } from '@app/payment-sdk';
import { notificationRoutes, paymentRoutes } from '@app/routes/cko-payment.route';
import { storedPaymentMethodRoutes } from '@app/routes/stored-payment-method.route';
import { app } from '../app';

export default async function (server: FastifyInstance) {
  await server.register(paymentRoutes, {
    paymentService: app.services.paymentService,
    sessionHeaderAuthHook: paymentSDK.sessionHeaderAuthHookFn,
    sessionQueryParamAuthHook: paymentSDK.sessionQueryParamAuthHookFn,
    ckoConfigHook: app.hooks.ckoConfigHook,
  });

  await server.register(storedPaymentMethodRoutes, {
    storedPaymentMethodService: app.services.storedPaymentMethodService,
    sessionHeaderAuthHook: paymentSDK.sessionHeaderAuthHookFn,
    sessionQueryParamAuthHook: paymentSDK.sessionQueryParamAuthHookFn,
    ckoConfigHook: app.hooks.ckoConfigHook,
  });

  await server.register(notificationRoutes, {
    paymentService: app.services.paymentService,
    hmacAuthHook: app.hooks.hmacAuthHook,
  });
}
