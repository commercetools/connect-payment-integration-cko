import {
  SessionHeaderAuthenticationHook,
  SessionQueryParamAuthenticationHook,
} from '@commercetools/connect-payments-sdk';
import { FastifyInstance, FastifyPluginOptions } from 'fastify';

import { CkoConfigHook } from '../libs/fastify/hooks/cko-config.hook';
import {
  ProcessStoredPaymentRequestDTO,
  ProcessStoredPaymentResponseDTO,
  ProcessStoredPaymentResponseSchema,
  StoredPaymentMethodsResponseDTO,
  StoredPaymentMethodsResponseSchema,
} from '../dtos/stored-payment-methods.dto';
import { Type } from '@sinclair/typebox';
import { CkoStoredPaymentMethodService } from '../services/cko-stored-payment-method.service';

type StoredPaymentMethodRoutesOptions = {
  storedPaymentMethodService: CkoStoredPaymentMethodService;
  sessionHeaderAuthHook: SessionHeaderAuthenticationHook;
  sessionQueryParamAuthHook: SessionQueryParamAuthenticationHook;
  ckoConfigHook: CkoConfigHook;
};

export const storedPaymentMethodRoutes = async (
  fastify: FastifyInstance,
  opts: FastifyPluginOptions & StoredPaymentMethodRoutesOptions,
) => {
  fastify.get<{ Reply: StoredPaymentMethodsResponseDTO }>(
    '/stored-payment-methods',
    {
      preHandler: [opts.sessionHeaderAuthHook.authenticate(), opts.ckoConfigHook.setConfigKey()],
      schema: {
        response: {
          200: StoredPaymentMethodsResponseSchema,
        },
      },
    },
    async (_, reply) => {
      const res = await opts.storedPaymentMethodService.getStoredPaymentMethods();
      reply.code(200).send(res);
    },
  );

  fastify.post<{
    Body: ProcessStoredPaymentRequestDTO;
    Reply: ProcessStoredPaymentResponseDTO;
    Params: { id: string };
  }>(
    '/stored-payment-methods/:id/payments',
    {
      preHandler: [opts.sessionHeaderAuthHook.authenticate(), opts.ckoConfigHook.setConfigKey()],
      schema: {
        params: {
          $id: 'paramsSchema',
          type: 'object',
          properties: {
            id: Type.String(),
          },
          required: ['id'],
        },
        response: {
          200: ProcessStoredPaymentResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const data = request.body as ProcessStoredPaymentRequestDTO;

      const res = await opts.storedPaymentMethodService.processStoredPayment(id, { data });
      return reply.status(200).send(res);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/stored-payment-methods/:id',
    {
      preHandler: [opts.sessionHeaderAuthHook.authenticate(), opts.ckoConfigHook.setConfigKey()],
      schema: {
        params: {
          $id: 'paramsSchema',
          type: 'object',
          properties: {
            id: Type.String(),
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      await opts.storedPaymentMethodService.deleteStoredPaymentMethod(id);

      return reply.status(200).send();
    },
  );
};
