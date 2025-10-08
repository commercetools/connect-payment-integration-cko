import { config, getConfig } from '../../../config/config';
import { FastifyRequest } from 'fastify';
import { ErrorAuthErrorResponse } from '@commercetools/connect-payments-sdk';
import crypto from 'crypto';
import { log } from '../../logger';

export class HmacAuthHook {
  public authenticate() {
    return async (request: FastifyRequest) => {
      const signature = request.headers['cko-signature'] as string;
      const rawBody = request.rawBody || '';
      if (!this.verifyHmacSignature(rawBody, signature)) {
        throw new ErrorAuthErrorResponse('HMAC is not valid');
      }else{
        log.info('HMAC is valid');
      }
    };
  }

  private calculateHmacSignature(data: string, key: string): string {
    return crypto.createHmac('sha256', key).update(data, 'utf8').digest('hex');
  }

  private verifyHmacSignature(rawBody: string, merchantSignature: string): boolean {
    const expectedSignature = this.calculateHmacSignature(rawBody, getConfig().getHmacKey());

    if (expectedSignature?.length !== merchantSignature?.length) {
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(expectedSignature, 'hex'), Buffer.from(merchantSignature, 'hex'));
  }
}
