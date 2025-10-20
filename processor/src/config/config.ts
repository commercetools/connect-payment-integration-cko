import { Cart } from '@commercetools/connect-payments-sdk';
import { Static, Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import jsonata from 'jsonata';
import { getCkoConfigKeyFromContext } from '../libs/fastify/context/context';

const CkoChannelConfigSchema = Type.Object({
  key: Type.String(),
  channelId: Type.String(),
  publicKey: Type.String(),
  secretKey: Type.String(),
  hmacKey: Type.String(),
  captureDelayHours: Type.Optional(Type.Number({ default: 0 })), // 0 means capture immediately
  enableThreeDS: Type.Optional(Type.Boolean({ default: true })),
});

const CkoChannelsConfigSchema = Type.Array(CkoChannelConfigSchema);

const CkoConfigSchema = Type.Object({
  default: CkoChannelConfigSchema,
  channelPath: Type.Optional(Type.String({ default: 'store.key' })), // Path in cart where to use to discriminate channels
  channels: Type.Optional(CkoChannelsConfigSchema),
});

const AppConfigSchema = Type.Object({
  projectKey: Type.String(),
  clientId: Type.String(),
  clientSecret: Type.String(),
  jwksUrl: Type.String(),
  jwtIssuer: Type.String(),
  authUrl: Type.String(),
  apiUrl: Type.String(),
  sessionUrl: Type.String(),
  healthCheckTimeout: Type.Number(),
  loggerLevel: Type.String(),
  merchantReturnUrl: Type.String(),
  ckoEnvironment: Type.Union([Type.Literal('sandbox'), Type.Literal('production')]),
  ckoConfig: CkoConfigSchema,
});

export type CkoChannels = Static<typeof CkoChannelsConfigSchema>;
export type CkoChannelConfig = Static<typeof CkoChannelConfigSchema>;
export type CkoConfig = Static<typeof CkoConfigSchema>;
export type AppConfig = Static<typeof AppConfigSchema>;

function parseJsonEnv<T>(key: string): T {
  const raw = process.env[key];
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON format in ${key}`);
  }
}

const rawConfig = {
  // Required by Payment SDK
  projectKey: process.env.CTP_PROJECT_KEY || 'payment-integration',
  clientId: process.env.CTP_CLIENT_ID || 'xxx',
  clientSecret: process.env.CTP_CLIENT_SECRET || 'xxx',
  jwksUrl: process.env.CTP_JWKS_URL || 'https://mc-api.europe-west1.gcp.commercetools.com/.well-known/jwks.json',
  jwtIssuer: process.env.CTP_JWT_ISSUER || 'https://mc-api.europe-west1.gcp.commercetools.com',
  authUrl: process.env.CTP_AUTH_URL || 'https://auth.europe-west1.gcp.commercetools.com',
  apiUrl: process.env.CTP_API_URL || 'https://api.europe-west1.gcp.commercetools.com',
  sessionUrl: process.env.CTP_SESSION_URL || 'https://session.europe-west1.gcp.commercetools.com/',
  healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000'),

  // Required by logger
  loggerLevel: process.env.LOGGER_LEVEL || 'info',

  // Payment Providers config
  merchantReturnUrl: process.env.MERCHANT_RETURN_URL || 'http://localhost:3000/checkout',
  ckoEnvironment: process.env.CKO_ENVIRONMENT || 'sandbox',
  ckoConfig: parseJsonEnv<CkoConfig>('CKO_CONFIG'),
};

export const config: AppConfig = Value.Cast(AppConfigSchema, rawConfig);

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
  };
};

async function getChannelKey(cart?: Cart): Promise<string | undefined> {
  const path = config.ckoConfig.channelPath || 'store.key';

  const expression = jsonata(path);
  if (!isPathExpression(expression)) {
    throw new Error('Channel path must be a valid path expression');
  }

  const result = await expression.evaluate(cart || {});
  if (typeof result !== 'string') {
    throw new Error('Channel key must be a string');
  }
  return result;
}

function isPathExpression(expression: jsonata.Expression): boolean {
  const ast = expression.ast();
  return (ast.type as string) === 'path';
}

function getChannelId(): string {
  const key = getCkoConfigKeyFromContext();
  const cko = config.ckoConfig;

  if (!key) {
    return cko.default.channelId;
  }

  const channel = cko.channels?.find((c) => c.key === key);
  return channel?.channelId || cko.default.channelId;
}

function getPublicKey(): string {
  const key = getCkoConfigKeyFromContext();
  const cko = config.ckoConfig;

  if (!key) {
    return cko.default.publicKey;
  }

  const channel = cko.channels?.find((c) => c.key === key);
  return channel?.publicKey || cko.default.publicKey;
}

function getSecretKey(): string {
  const key = getCkoConfigKeyFromContext();
  const cko = config.ckoConfig;

  if (!key) {
    return cko.default.secretKey;
  }

  const channel = cko.channels?.find((c) => c.key === key);
  return channel?.secretKey || cko.default.secretKey;
}

function getHmacKey(): string {
  const key = getCkoConfigKeyFromContext();
  const cko = config.ckoConfig;

  if (!key) {
    return cko.default.hmacKey;
  }

  const channel = cko.channels?.find((c) => c.key === key);
  return channel?.hmacKey || cko.default.hmacKey;
}

function getCaptureDelayHours(): number | undefined {
  const key = getCkoConfigKeyFromContext();
  const cko = config.ckoConfig;

  if (!key) {
    return cko.default.captureDelayHours;
  }

  const channel = cko.channels?.find((c) => c.key === key);
  return channel?.captureDelayHours || cko.default.captureDelayHours;
}

function getEnableThreeDS(): boolean {
  const key = getCkoConfigKeyFromContext();
  const cko = config.ckoConfig;

  if (!key) {
    return cko.default.enableThreeDS ?? true;
  }

  const channel = cko.channels?.find((c) => c.key === key);
  return channel?.enableThreeDS ?? cko.default.enableThreeDS ?? true;
}
