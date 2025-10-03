import { CkoReversePaymentRequest } from '../../clients/types/payment.type';
import { ReversePaymentRequest } from '../types/operation.type';

export class ReversePaymentConverter {
  public convertRequest(opts: { requestData: ReversePaymentRequest }): CkoReversePaymentRequest {
    return {
      ...(opts.requestData.merchantReference && { reference: opts.requestData.merchantReference }),
    };
  }
}
