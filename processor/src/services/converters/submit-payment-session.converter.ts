import { Payment } from '@commercetools/connect-payments-sdk';
import { SubmitPaymentSessionRequest, SubmitPaymentSessionResponse } from '@app/clients/types/payment-session.type';

import { SubmitPaymentSessionRequestDTO, SubmitPaymentSessionResponseDTO } from '@app/dtos/cko-payment.dto';
import { getConfig } from '@app/config/config';

export class SubmitPaymentSessionConverter {
  public convertRequest(opts: { requestData: SubmitPaymentSessionRequestDTO }): SubmitPaymentSessionRequest {
    return {
      session_data: opts.requestData.session_data,
      payment_type:
        getConfig().isStoredPaymentMethodsEnabled() && opts.requestData.storePaymentMethod ? 'Unscheduled' : 'Regular',
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
