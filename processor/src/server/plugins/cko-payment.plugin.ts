import { FastifyInstance } from 'fastify';
import { paymentSDK } from '../../payment-sdk';
import { notificationRoutes, paymentRoutes } from '../../routes/cko-payment.route';
import { app } from '../app';
import { storedPaymentMethodRoutes } from '../../routes/stored-payment-method.route';

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
