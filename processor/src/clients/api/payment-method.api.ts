import { getConfig } from '@app/config/config';
import { CkoBaseApi } from './base-api';
import { CkoGetPaymentMethodsResponse } from '../types/payment-method.type';
import { ApiResources } from '../types/api.type';

export class PaymentMethodsApi extends CkoBaseApi {
  constructor() {
    super();
  }

  public async getPaymentMethods(): Promise<CkoGetPaymentMethodsResponse> {
    const channelId = getConfig().getChannelId();
    const url = new URL(this.buildResourceUrl(getConfig().ckoEnvironment, ApiResources.PAYMENT_METHODS));
    url.searchParams.append('processing_channel_id', channelId);

    return await this.executeCall<CkoGetPaymentMethodsResponse>({
      method: 'get',
      url: url.toString(),
    });
  }
}
