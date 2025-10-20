import { getConfig } from '../../config/config';
import { CkoApiError, CkoApiErrorData } from '../../errors/cko-api.error';
import { log } from '../../libs/logger';
import { ApiBasePath, ApiRequestConfig, ApiResources } from '../types/api.type';

export abstract class CkoBaseApi {
  protected async executeCall<T>(options: ApiRequestConfig): Promise<T> {
    let res: Response, jsonResponse: CkoApiErrorData;
    try {
      res = await fetch(options.url, {
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${getConfig().getSecretKey()}`,
        },
        body: JSON.stringify(options.data),
      });

      jsonResponse = await res.json();
    } catch (e: unknown) {
      log.error('Error calling CKO API', {
        err: e,
        options: JSON.stringify(options),
      });

      throw new CkoApiError(500);
    }

    if (!res.ok) {
      throw new CkoApiError(res.status, jsonResponse);
    }

    return jsonResponse as T;
  }

  protected buildResourceUrl(environment: string, resource: ApiResources, resourceId?: string): string {
    let url = ApiBasePath.SANDBOX.toString().concat(resource);
    if (environment.toLowerCase() === 'production') {
      url = ApiBasePath.PRODUCTION.toString().concat(resource);
    }

    if (resourceId) {
      url = url.replace(/{resourceId}/g, resourceId);
    }

    return url;
  }
}
