import { config } from '../../config/config';
import { ApiBasePath, ApiRequestConfig, ApiResources } from '../types/api.type';

export abstract class CkoBaseApi {
  protected async executeCall<T>(options: ApiRequestConfig): Promise<T> {
    try {
      const res = await fetch(options.url, {
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${config.ckoSecretKey}`,
        },
        body: JSON.stringify(options.data),
      });

      const jsonResponse = await res.json();

      if (!res.ok) {
        console.error('API call failed:', jsonResponse, res.status);
        throw new Error(jsonResponse.message || 'API call failed');
      }

      return jsonResponse as T;
    } catch (e: unknown) {
      console.error('API call error:', e);

      if (e instanceof Error) {
        throw new Error(e.message);
      }
      throw new Error('API call failed');
    }
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
