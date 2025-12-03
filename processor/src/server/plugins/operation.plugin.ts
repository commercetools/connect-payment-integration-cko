import { FastifyInstance } from 'fastify';
import { paymentSDK } from '@app/payment-sdk';
import { operationsRoute } from '@app/routes/operation.route';
import { app } from '../app';

export default async function (server: FastifyInstance) {
  await server.register(operationsRoute, {
    prefix: '/operations',
    jwtAuthHook: paymentSDK.jwtAuthHookFn,
    oauth2AuthHook: paymentSDK.oauth2AuthHookFn,
    sessionHeaderAuthHook: paymentSDK.sessionHeaderAuthHookFn,
    authorizationHook: paymentSDK.authorityAuthorizationHookFn,
    ckoConfigHook: app.hooks.ckoConfigHook,
    paymentService: app.services.paymentService,
    paymentIntentService: app.services.paymentIntentService,
  });
}
