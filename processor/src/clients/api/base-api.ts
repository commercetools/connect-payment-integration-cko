import { getConfig } from '@app/config/config';
import { CkoApiError } from '@app/errors/cko-api.error';
import { log } from '@lib/logger';
import { ApiRequestConfig, ApiResources } from '../types/api.type';

export abstract class CkoBaseApi {
  protected async executeCall<T>(options: ApiRequestConfig): Promise<T> {
    let res: Response, jsonResponse: T | undefined;
    try {
      res = await fetch(options.url, {
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${getConfig().getSecretKey()}`,
        },
        ...(options.data ? { body: JSON.stringify(options.data) } : {}),
      });

      log.info(`Called cko API ${options.method} ${options.url} - Status: ${res.status}`);
    } catch (e: unknown) {
      // Error objects serialize as {}, so log the message and the cause (for example ENOTFOUND) explicitly.
      log.error('Error calling CKO API', {
        err: e,
        errMessage: e instanceof Error ? e.message : String(e),
        errCause: e instanceof Error && e.cause ? String(e.cause) : undefined,
        options: JSON.stringify(options),
      });

      throw new CkoApiError(500);
    }

    try {
      if (res.status !== 204 && res.headers.get('content-length') !== '0') {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          jsonResponse = await res.json();
        }
      }
    } catch (e: unknown) {
      log.error('Error parsing CKO API response', {
        err: e,
        status: res.status,
        options: JSON.stringify(options),
      });
    }

    if (!res.ok) {
      throw new CkoApiError(res.status, jsonResponse || undefined);
    }

    return jsonResponse as T;
  }

  protected buildResourceUrl(resource: ApiResources, resourceId?: string): string {
    let url = getConfig().getApiBaseUrl().concat(resource);

    if (resourceId) {
      url = url.replace(/{resourceId}/g, resourceId);
    }

    return url;
  }
}
