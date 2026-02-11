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
} from '@app/dtos/cko-payment.dto';
import { CkoPaymentService } from '@app/services/cko-payment.service';
import { HmacAuthHook } from '@lib/fastify/hooks/hmac-auth.hook';
import { rawBodyPlugin } from '@lib/fastify/hooks/raw-body.hook';
import { CkoWebhookEvent } from '@app/clients/types/webhook.type';
import { CkoConfigHook } from '@lib/fastify/hooks/cko-config.hook';
import { log } from '@lib/logger';

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
      const resp = await opts.paymentService.createPaymentSession({ data: request.body });

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
      success: string | boolean;
      'cko-payment-id': string;
      [key: string]: unknown;
    };
  }>(
    '/payment-sessions/confirm',
    {
      preHandler: [opts.sessionQueryParamAuthHook.authenticate(), opts.ckoConfigHook.setConfigKey()],
    },
    async (request, reply) => {
      // Log the incoming query parameters
      log.info('Payment confirmation request received', {
        paymentReference: request.query.paymentReference,
        ckoPaymentId: request.query['cko-payment-id'],
        successParam: request.query.success,
        successParamType: typeof request.query.success,
        allQueryParams: request.query,
      });

      // Convert success param to boolean (it might come as string "true"/"false" or boolean)
      let isSuccess = false;
      const successParam = request.query.success;
      if (successParam === true || successParam === 'true' || String(successParam).toLowerCase() === 'true') {
        isSuccess = true;
      } else if (successParam === false || successParam === 'false' || String(successParam).toLowerCase() === 'false') {
        isSuccess = false;
      }

      log.info('Processed success parameter', {
        originalValue: request.query.success,
        convertedValue: isSuccess,
      });

      const res = await opts.paymentService.confirmPayment({
        paymentReference: request.query.paymentReference,
        ckoPaymentId: request.query['cko-payment-id'],
        isSuccess: isSuccess,
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

      await opts.paymentService.processNotification({
        event,
      });

      return reply.status(200).send('[accepted]');
    },
  );
};
