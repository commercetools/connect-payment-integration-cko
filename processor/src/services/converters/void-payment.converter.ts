import { CkoVoidPaymentRequest } from '../../clients/types/payment.type';
import { CancelPaymentRequest } from '../types/operation.type';

export class VoidPaymentConverter {
  public convertRequest(opts: { requestData: CancelPaymentRequest }): CkoVoidPaymentRequest {
    return {
      ...(opts.requestData.merchantReference && { reference: opts.requestData.merchantReference }),
    };
  }
}
