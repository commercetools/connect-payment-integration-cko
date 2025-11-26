import { config } from '@app/config/config';
import { CkoBaseApi } from './base-api';
import { CkoGetPaymentMethodsResponse } from '../types/payment-method.type';
import { ApiResources } from '../types/api.type';

export class PaymentMethodsApi extends CkoBaseApi {
  constructor() {
    super();
  }

  public async getPaymentMethods(): Promise<CkoGetPaymentMethodsResponse> {
    const url = this.buildResourceUrl(config.ckoEnvironment, ApiResources.PAYMENT_METHODS);

    return await this.executeCall<CkoGetPaymentMethodsResponse>({
      method: 'get',
      url,
    });
  }
}
