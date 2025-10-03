import { Payment } from '@commercetools/connect-payments-sdk';
import { SubmitPaymentSessionRequest, SubmitPaymentSessionResponse } from '../../clients/types/payment-session.type';

import { SubmitPaymentSessionRequestDTO, SubmitPaymentSessionResponseDTO } from '../../dtos/cko-payment.dto';

export class SubmitPaymentSessionConverter {
  public convertRequest(opts: { requestData: SubmitPaymentSessionRequestDTO }): SubmitPaymentSessionRequest {
    return {
      session_data: opts.requestData.session_data,
    };
  }

  public convertResponse(opts: {
    responseData: SubmitPaymentSessionResponse;
    payment: Payment;
  }): SubmitPaymentSessionResponseDTO {
    return {
      ...opts.responseData,
      paymentReference: opts.payment.id,
    };
  }
}
