import autoLoad from '@fastify/autoload';
import cors from '@fastify/cors';
import fastifyFormBody from '@fastify/formbody';
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { join } from 'path';
import { config } from '../config/config';
import { requestContextPlugin } from '../libs/fastify/context/context';
import { errorHandler } from '../libs/fastify/error-handler';

/**
 * Setup Fastify server instance
 * @returns
 */
export const setupFastify = async () => {
  // Create fastify server instance
  const server = Fastify({
    logger: {
      level: config.loggerLevel,
    },
    genReqId: () => randomUUID().toString(),
    requestIdLogLabel: 'requestId',
    requestIdHeader: 'x-request-id',
  });

  // Setup error handler
  server.setErrorHandler(errorHandler);

  // Enable CORS
  await server.register(cors, {
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID', 'X-Request-ID', 'X-Session-ID'],
    methods: ['GET', 'POST', 'DELETE', 'HEAD'],
    origin: '*',
  });

  // Customize JSON parser to allow empty bodies for DELETE requests
  const defaultJsonParser = server.getDefaultJsonParser('ignore', 'ignore');
  server.addContentTypeParser('application/json', { parseAs: 'string' }, (request, body, done) => {
    if (request.method === 'DELETE') {
      if (body === '' || body == null || (Buffer.isBuffer(body) && body.length === 0)) {
        return done(null, {});
      }
      return defaultJsonParser(request, typeof body === 'string' ? body : body.toString(), done);
    }
    return defaultJsonParser(request, body.toString(), done);
  });

  // Add content type parser for the content type application/x-www-form-urlencoded
  await server.register(fastifyFormBody);

  // Register context plugin
  await server.register(requestContextPlugin);

  await server.register(autoLoad, {
    dir: join(__dirname, 'plugins'),
  });

  return server;
};
