import { FastifyInstance } from 'fastify';
import { paymentSDK } from '../../payment-sdk';
import { notificationRoutes, paymentRoutes } from '../../routes/cko-payment.route';
import { app } from '../app';
import { CkoPaymentService } from '../../services/cko-payment.service';

export default async function (server: FastifyInstance) {
  const mockPaymentService = new CkoPaymentService({
    ctCartService: paymentSDK.ctCartService,
    ctPaymentService: paymentSDK.ctPaymentService,
  });

  await server.register(paymentRoutes, {
    paymentService: mockPaymentService,
    sessionHeaderAuthHook: paymentSDK.sessionHeaderAuthHookFn,
    sessionQueryParamAuthHook: paymentSDK.sessionQueryParamAuthHookFn,
  });

  await server.register(notificationRoutes, {
    paymentService: mockPaymentService,
    hmacAuthHook: app.hooks.hmacAuthHook,
  });
}
