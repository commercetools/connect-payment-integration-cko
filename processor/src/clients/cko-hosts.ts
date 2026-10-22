/**
 * Checkout.com base URL resolution (MSSD - Merchant-Specific Sub-Domains).
 *
 * Checkout.com clients created on or after 2026-10-01 must call their own host instead of the shared one:
 * - API:    https://{prefix}.api.checkout.com           (sandbox: https://{prefix}.api.sandbox.checkout.com)
 * - Access: https://{prefix}.access.checkout.com        (sandbox: https://{prefix}.access.sandbox.checkout.com)
 *
 * `{prefix}` is the first 8 characters of the Checkout.com client ID without the `cli_` prefix.
 * Production and sandbox client IDs differ, so a prefix is only valid in the environment it was issued for.
 *
 * Note: `/balances` has no MSSD enforcement and this connector does not call it.
 */

export type CkoEnvironment = 'sandbox' | 'production';

export type CkoHostOptions = {
  environment: CkoEnvironment;
  /** Checkout.com client ID (`cli_...`). When set, the MSSD prefix is derived from it. */
  clientId?: string;
  /** Explicit API base URL. Takes precedence over the derived one. */
  apiBaseUrl?: string;
  /** Explicit Access (OAuth) base URL. Takes precedence over the derived one. */
  accessBaseUrl?: string;
};

export type CkoBaseUrls = {
  /** Prefix derived from the client ID, undefined when the shared host is used */
  prefix?: string;
  apiBaseUrl: string;
  accessBaseUrl: string;
};

const CLIENT_ID_PREFIX = 'cli_';
const MSSD_PREFIX_LENGTH = 8;
const CLIENT_ID_PATTERN = /^cli_[a-z0-9]{8,}$/i;

const SHARED_HOSTS: Record<CkoEnvironment, { api: string; access: string }> = {
  sandbox: { api: 'api.sandbox.checkout.com', access: 'access.sandbox.checkout.com' },
  production: { api: 'api.checkout.com', access: 'access.checkout.com' },
};

/**
 * Derive the MSSD prefix: first 8 characters of the client ID without `cli_`, lowercased.
 *
 * @throws Error if the client ID does not look like `cli_` followed by at least 8 alphanumeric characters
 */
export function deriveMssdPrefix(clientId: string): string {
  const trimmed = clientId.trim();
  if (!CLIENT_ID_PATTERN.test(trimmed)) {
    throw new Error(
      `Invalid Checkout.com client ID: expected "${CLIENT_ID_PREFIX}" followed by at least ${MSSD_PREFIX_LENGTH} alphanumeric characters`,
    );
  }
  return trimmed.slice(CLIENT_ID_PREFIX.length, CLIENT_ID_PREFIX.length + MSSD_PREFIX_LENGTH).toLowerCase();
}

/**
 * Validate an explicit base URL override against the configured environment.
 * A sandbox host is never accepted for production and the other way around.
 */
function validateOverride(name: string, value: string, environment: CkoEnvironment): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid Checkout.com ${name}: "${value}" is not a valid URL`);
  }

  if (url.protocol !== 'https:') {
    throw new Error(`Invalid Checkout.com ${name}: "${value}" must use https`);
  }

  const host = url.hostname.toLowerCase();
  if (host !== 'checkout.com' && !host.endsWith('.checkout.com')) {
    throw new Error(`Invalid Checkout.com ${name}: host "${host}" must be a checkout.com host`);
  }

  const isSandboxHost = host.endsWith('.sandbox.checkout.com');
  if (environment === 'production' && isSandboxHost) {
    throw new Error(`Invalid Checkout.com ${name}: sandbox host "${host}" cannot be used in production`);
  }
  if (environment === 'sandbox' && !isSandboxHost) {
    throw new Error(`Invalid Checkout.com ${name}: production host "${host}" cannot be used in sandbox`);
  }

  return value.replace(/\/+$/, '');
}

/**
 * Resolve the API and Access base URLs for a merchant/channel.
 *
 * Precedence: explicit override > host derived from the client ID > shared host (pre MSSD merchants).
 */
export function resolveCkoBaseUrls(options: CkoHostOptions): CkoBaseUrls {
  const { environment } = options;
  const shared = SHARED_HOSTS[environment];
  if (!shared) {
    throw new Error(`Invalid Checkout.com environment: "${environment}". Expected "sandbox" or "production"`);
  }

  const prefix = options.clientId ? deriveMssdPrefix(options.clientId) : undefined;
  const hostFor = (sharedHost: string) => (prefix ? `https://${prefix}.${sharedHost}` : `https://${sharedHost}`);

  return {
    prefix,
    apiBaseUrl: options.apiBaseUrl
      ? validateOverride('apiBaseUrl', options.apiBaseUrl, environment)
      : hostFor(shared.api),
    accessBaseUrl: options.accessBaseUrl
      ? validateOverride('accessBaseUrl', options.accessBaseUrl, environment)
      : hostFor(shared.access),
  };
}
