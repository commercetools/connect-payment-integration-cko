import { config } from '../../config/config';
import { ApiResources } from '../types/api.type';
import { PaymentSessionRequest, PaymentSessionResponse, SubmitPaymentSessionRequest, SubmitPaymentSessionResponse } from '../types/payment-session.type';
import { CkoBaseApi } from './base-api';

export class PaymentSessionApi extends CkoBaseApi {
  constructor() {
    super();
  }

  public async createPaymentSession(request: PaymentSessionRequest): Promise<PaymentSessionResponse> {
    const url = this.buildResourceUrl(config.ckoEnvironment, ApiResources.PAYMENT_SESSIONS);

    return await this.executeCall<PaymentSessionResponse>({
      method: 'post',
      url,
      data: request,
    });
  }

  public async submitPaymentSession(id: string, request: SubmitPaymentSessionRequest): Promise<SubmitPaymentSessionResponse> {
    const url = this.buildResourceUrl(config.ckoEnvironment, ApiResources.SUBMIT_PAYMENT_SESSIONS, id);

    return await this.executeCall<SubmitPaymentSessionResponse>({
      method: 'post',
      url,
      data: request,
    });
  }
}
