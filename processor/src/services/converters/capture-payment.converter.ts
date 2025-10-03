import { CkoCapturePaymentRequest } from '../../clients/types/payment.type';
import { CapturePaymentRequest } from '../types/operation.type';

export class CapturePaymentConverter {
  public convertRequest(opts: { requestData: CapturePaymentRequest }): CkoCapturePaymentRequest {
    return {
      amount: opts.requestData.amount.centAmount,
      ...(opts.requestData.merchantReference && { reference: opts.requestData.merchantReference }),
    };
  }
}
