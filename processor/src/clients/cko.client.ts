import { CkoApi } from './api/cko.api';

let apiClient: CkoApi;

export const getCheckoutApiClient = (): CkoApi => {
  if (!apiClient) {
    apiClient = new CkoApi();
  }
  return apiClient;
};
