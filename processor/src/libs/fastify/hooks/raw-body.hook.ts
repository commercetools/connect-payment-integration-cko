import fp from 'fastify-plugin';
import { FastifyRequest } from 'fastify';
import { Readable } from 'stream';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
  }
}

export const rawBodyPlugin = fp(async (fastify) => {
  fastify.addHook('preParsing', async (request: FastifyRequest, reply, payload) => {
    const chunks: Buffer[] = [];
    for await (const chunk of payload as AsyncIterable<Buffer>) {
      chunks.push(chunk as Buffer);
    }
    const buffer = Buffer.concat(chunks);
    request.rawBody = buffer.toString('utf8');

    return Readable.from([buffer]);
  });
});
