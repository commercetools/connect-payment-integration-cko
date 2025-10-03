import { CkoRefundPaymentRequest } from '../../clients/types/payment.type';
import { RefundPaymentRequest } from '../types/operation.type';

export class RefundPaymentConverter {
  public convertRequest(opts: { requestData: RefundPaymentRequest }): CkoRefundPaymentRequest {
    return {
      amount: opts.requestData.amount.centAmount,
      ...(opts.requestData.merchantReference && { reference: opts.requestData.merchantReference }),
    };
  }
}
