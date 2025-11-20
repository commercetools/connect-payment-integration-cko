import { Cart, Order } from '@commercetools/connect-payments-sdk';

import { Value } from '@sinclair/typebox/value';
import jsonata from 'jsonata';
import { getCkoConfigKeyFromContext } from '../libs/fastify/context/context';
import { AppConfig, AppConfigSchema, CkoConfig } from './types/config.type';

/**
 * Parse and validate JSON from environment variable
 *
 * @param key - Environment variable name
 * @returns Parsed JSON object
 * @throws Error if JSON is invalid or missing
 */
function parseJsonEnv<T>(key: string): T {
  const raw = process.env[key];

  if (!raw) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON format in environment variable ${key}: ${error}`);
  }
}

/**
 * Load and validate configuration from environment variables
 *
 * Environment Variables:
 * - CTP_PROJECT_KEY: CommerceTools project key
 * - CTP_CLIENT_ID: CommerceTools API client ID
 * - CTP_CLIENT_SECRET: CommerceTools API client secret
 * - CTP_JWKS_URL: JWKS URL for JWT validation
 * - CTP_JWT_ISSUER: JWT issuer URL
 * - CTP_AUTH_URL: CommerceTools OAuth URL
 * - CTP_API_URL: CommerceTools API URL
 * - CTP_SESSION_URL: CommerceTools session service URL
 * - HEALTH_CHECK_TIMEOUT: Health check timeout in ms (default: 5000)
 * - LOGGER_LEVEL: Log level (default: 'info')
 * - MERCHANT_RETURN_URL: Post-payment redirect URL
 * - CKO_ENVIRONMENT: 'sandbox' or 'production'
 * - CKO_CONFIG: JSON configuration for Checkout.com channels
 *
 * @throws Error if configuration is invalid or missing required fields
 */
function loadConfig(): AppConfig {
  const rawConfig = {
    // CommerceTools Configuration
    projectKey: process.env.CTP_PROJECT_KEY,
    clientId: process.env.CTP_CLIENT_ID,
    clientSecret: process.env.CTP_CLIENT_SECRET,
    jwksUrl: process.env.CTP_JWKS_URL,
    jwtIssuer: process.env.CTP_JWT_ISSUER,
    authUrl: process.env.CTP_AUTH_URL,
    apiUrl: process.env.CTP_API_URL,
    sessionUrl: process.env.CTP_SESSION_URL,

    // Application Configuration
    healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000'),
    loggerLevel: process.env.LOGGER_LEVEL || 'info',

    // Payment Configuration
    merchantReturnUrl: process.env.MERCHANT_RETURN_URL,
    ckoEnvironment: process.env.CKO_ENVIRONMENT,
    ckoConfig: parseJsonEnv<CkoConfig>('CKO_CONFIG'),
  };

  // Validate against schema (throws on validation errors)
  const errors = [...Value.Errors(AppConfigSchema, rawConfig)];

  if (errors.length > 0) {
    const errorMessages = errors.map((error) => `${error.path}: ${error.message}`).join('\n  ');

    throw new Error(
      `Configuration validation failed:\n  ${errorMessages}\n\n` + `Please check your environment variables.`,
    );
  }

  // Decode with defaults applied
  return Value.Decode(AppConfigSchema, rawConfig);
}

/**
 * Validated application configuration
 *
 * Throws on startup if configuration is invalid.
 */
export const config: AppConfig = loadConfig();

/**
 * Get configuration object
 *
 * @returns Configuration object with channel resolution methods
 */
export const getConfig = () => {
  return {
    ...config,
    getChannelId,
    getPublicKey,
    getSecretKey,
    getHmacKey,
    getCaptureDelayHours,
    getEnableThreeDS,
    getChannelKey,
    isStoredPaymentMethodsEnabled,
    getStoredPaymentMethodsPaymentInterface,
    getStoredPaymentMethodsInterfaceAccount,
    hasMultiChannelConfig,
  };
};

/**
 * Extract channel key from cart using configured JSONata path
 *
 * @param cart - CommerceTools cart object
 * @returns Channel key extracted from cart, or undefined if not found
 * @throws Error if channel path is invalid or result is not a string
 *
 * @example
 * // With channelPath = 'store.key'
 * await getChannelKey({ store: { key: 'us-store' } }) // → 'us-store'
 */
async function getChannelKey(cart?: Cart | Order): Promise<string | undefined> {
  if (!cart) {
    return undefined;
  }

  const path = config.ckoConfig.channelPath || 'store.key';

  const expression = jsonata(path);
  if (!isPathExpression(expression)) {
    throw new Error(`Channel path must be a valid JSONata path expression, got: ${path}`);
  }

  const result = await expression.evaluate(cart);

  if (result === undefined) {
    return undefined;
  }

  if (typeof result !== 'string') {
    throw new Error(`Channel key must be a string, got ${typeof result} from path: ${path}`);
  }

  return result;
}

/**
 * Validate that JSONata expression is a simple path (not a complex query)
 *
 * @param expression - JSONata expression to validate
 * @returns true if expression is a path
 */
function isPathExpression(expression: jsonata.Expression): boolean {
  const ast = expression.ast();
  return (ast.type as string) === 'path';
}

/**
 * Get Checkout.com channel ID for current context
 *
 * Uses channel key from request context to select appropriate channel.
 * Falls back to default channel if no context or channel not found.
 *
 * @returns Channel ID
 */
function getChannelId(): string {
  const key = getCkoConfigKeyFromContext();
  const cko = config.ckoConfig;

  if (!key) {
    return cko.default.channelId;
  }

  const channel = cko.channels?.find((c) => c.key === key);
  return channel?.channelId || cko.default.channelId;
}

/**
 * Get public API key for current channel
 *
 * @returns Public key for client-side operations
 */
function getPublicKey(): string {
  const key = getCkoConfigKeyFromContext();
  const cko = config.ckoConfig;

  if (!key) {
    return cko.default.publicKey;
  }

  const channel = cko.channels?.find((c) => c.key === key);
  return channel?.publicKey || cko.default.publicKey;
}

/**
 * Get secret API key for current channel
 *
 * @returns Secret key for server-side operations
 */
function getSecretKey(): string {
  const key = getCkoConfigKeyFromContext();
  const cko = config.ckoConfig;

  if (!key) {
    return cko.default.secretKey;
  }

  const channel = cko.channels?.find((c) => c.key === key);
  return channel?.secretKey || cko.default.secretKey;
}

/**
 * Get HMAC secret key for webhook validation
 *
 * @returns HMAC key for validating Checkout.com webhook signatures
 */
function getHmacKey(): string {
  const key = getCkoConfigKeyFromContext();
  const cko = config.ckoConfig;

  if (!key) {
    return cko.default.hmacKey;
  }

  const channel = cko.channels?.find((c) => c.key === key);
  return channel?.hmacKey || cko.default.hmacKey;
}

/**
 * Get capture delay hours for current channel
 *
 * @returns Hours to delay capture after authorization (0 = immediate)
 */
function getCaptureDelayHours(): number | undefined {
  const key = getCkoConfigKeyFromContext();
  const cko = config.ckoConfig;

  if (!key) {
    return cko.default.captureDelayHours;
  }

  const channel = cko.channels?.find((c) => c.key === key);
  return channel?.captureDelayHours;
}

/**
 * Check if 3D Secure is enabled for current channel
 *
 * @returns true if 3DS should be enabled for card payments
 */
function getEnableThreeDS(): boolean {
  const key = getCkoConfigKeyFromContext();
  const cko = config.ckoConfig;

  if (!key) {
    return cko.default.enableThreeDS ?? true;
  }

  const channel = cko.channels?.find((c) => c.key === key);
  return channel?.enableThreeDS ?? cko.default.enableThreeDS ?? true;
}

/**
 * Check if stored payment methods are enabled for current channel
 * @returns true if stored payment methods are enabled
 */
function isStoredPaymentMethodsEnabled(): boolean {
  const key = getCkoConfigKeyFromContext();
  const cko = config.ckoConfig;

  if (!key) {
    return cko.default.storedPaymentMethodsEnabled ?? true;
  }

  const channel = cko.channels?.find((c) => c.key === key);
  return channel?.storedPaymentMethodsEnabled ?? true;
}

/**
 * Get stored payment methods payment interface for current channel
 * @returns Payment interface for stored payment methods
 */
function getStoredPaymentMethodsPaymentInterface(): string {
  const key = getCkoConfigKeyFromContext();
  const cko = config.ckoConfig;

  if (!key) {
    return cko.default.storedPaymentMethodsPaymentInterface || 'checkout-cko';
  }

  const channel = cko.channels?.find((c) => c.key === key);
  return channel?.storedPaymentMethodsPaymentInterface || 'checkout-cko';
}

/**
 * Get stored payment methods interface account for current channel
 * @returns Interface account for stored payment methods, or undefined if not set
 */
function getStoredPaymentMethodsInterfaceAccount(): string | undefined {
  const key = getCkoConfigKeyFromContext();
  const cko = config.ckoConfig;

  if (!key) {
    return cko.default.storedPaymentMethodsInterfaceAccount;
  }

  const channel = cko.channels?.find((c) => c.key === key);
  return channel?.storedPaymentMethodsInterfaceAccount || getChannelId();
}

/**
 * Check if multi-channel configuration is enabled
 *
 * @returns true if there are specific channel configurations beyond the default
 *
 * @example
 * // With only default channel
 * hasMultiChannelConfig() // → false
 *
 * // With additional channels
 * hasMultiChannelConfig() // → true
 */
export function hasMultiChannelConfig(): boolean {
  const cko = config.ckoConfig;
  return !!(cko.channels && cko.channels.length > 0);
}
