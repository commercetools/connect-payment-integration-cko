import { CkoApi } from './api/cko.api';

let apiClient: CkoApi;

export const getCkoApiClient = (): CkoApi => {
  if (!apiClient) {
    apiClient = new CkoApi();
  }
  return apiClient;
};
