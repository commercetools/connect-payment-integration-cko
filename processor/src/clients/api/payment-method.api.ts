import { config } from '../../config/config';
import { ApiResources } from '../types/api.type';
import { CkoGetPaymentMethodsResponse } from '../types/payment-method.type';
import { CkoBaseApi } from './base-api';

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
