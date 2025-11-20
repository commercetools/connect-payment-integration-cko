import {
  SessionHeaderAuthenticationHook,
  SessionQueryParamAuthenticationHook,
} from '@commercetools/connect-payments-sdk';
import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
  PaymentSessionRequestDTO,
  PaymentSessionResponseDTO,
  SubmitPaymentSessionRequestDTO,
  SubmitPaymentSessionResponseDTO,
} from '../dtos/cko-payment.dto';
import { CkoPaymentService } from '../services/cko-payment.service';
import { HmacAuthHook } from '../libs/fastify/hooks/hmac-auth.hook';
import { rawBodyPlugin } from '../libs/fastify/hooks/raw-body.hook';
import { CkoWebhookEvent } from '../clients/types/webhook.type';
import { CkoConfigHook } from '../libs/fastify/hooks/cko-config.hook';

type PaymentRoutesOptions = {
  paymentService: CkoPaymentService;
  sessionHeaderAuthHook: SessionHeaderAuthenticationHook;
  sessionQueryParamAuthHook: SessionQueryParamAuthenticationHook;
  ckoConfigHook: CkoConfigHook;
};

type NotificationRoutesOptions = {
  paymentService: CkoPaymentService;
  hmacAuthHook: HmacAuthHook;
};

export const paymentRoutes = async (fastify: FastifyInstance, opts: FastifyPluginOptions & PaymentRoutesOptions) => {
  fastify.post<{ Body: PaymentSessionRequestDTO; Reply: PaymentSessionResponseDTO }>(
    '/payment-sessions',
    {
      preHandler: [opts.sessionHeaderAuthHook.authenticate(), opts.ckoConfigHook.setConfigKey()],
    },
    async (request, reply) => {
      const resp = await opts.paymentService.createSession({ data: request.body });

      return reply.status(200).send(resp);
    },
  );

  fastify.post<{
    Body: SubmitPaymentSessionRequestDTO;
    Reply: SubmitPaymentSessionResponseDTO;
    Params: { id: string };
  }>(
    '/payment-sessions/:id',
    {
      preHandler: [opts.sessionHeaderAuthHook.authenticate(), opts.ckoConfigHook.setConfigKey()],
    },
    async (request, reply) => {
      const resp = await opts.paymentService.submitPaymentSession(request.params.id, {
        data: request.body,
      });

      return reply.status(200).send(resp);
    },
  );

  fastify.get<{
    Querystring: {
      paymentReference: string;
      success: boolean;
      'cko-payment-id': string;
      [key: string]: unknown;
    };
  }>(
    '/payment-sessions/confirm',
    {
      preHandler: [opts.sessionQueryParamAuthHook.authenticate(), opts.ckoConfigHook.setConfigKey()],
    },
    async (request, reply) => {
      const res = await opts.paymentService.confirmPayment({
        paymentReference: request.query.paymentReference,
        ckoPaymentId: request.query['cko-payment-id'],
        isSuccess: request.query.success,
      });

      return reply.redirect(res.merchantReturnUrl);
    },
  );
};

export const notificationRoutes = async (
  fastify: FastifyInstance,
  opts: FastifyPluginOptions & NotificationRoutesOptions,
) => {
  await fastify.register(rawBodyPlugin);

  fastify.post<{ Body: CkoWebhookEvent }>(
    '/notifications',
    {
      preHandler: [opts.hmacAuthHook.authenticate()],
    },
    async (request, reply) => {
      const event = request.body;

      console.log('Received webhook event:', JSON.stringify(event, null, 2));

      await opts.paymentService.processNotification({
        event,
      });

      return reply.status(200).send('[accepted]');
    },
  );
};
