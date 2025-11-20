import { Static, Type } from '@sinclair/typebox';

/**
 * Checkout.com Channel Configuration
 *
 * Represents a single payment channel configuration for Checkout.com.
 * Multiple channels can be configured to support multi-store or multi-region setups.
 */
export const CkoChannelConfigSchema = Type.Object({
  /** Unique identifier for this channel (e.g., 'us-store', 'eu-store') */
  key: Type.String({ minLength: 1 }),

  /** Checkout.com channel ID from merchant portal */
  channelId: Type.String({ minLength: 1 }),

  /** Public API key for client-side operations */
  publicKey: Type.String({ minLength: 1 }),

  /** Secret API key for server-side operations */
  secretKey: Type.String({ minLength: 1 }),

  /** HMAC secret key for webhook signature validation */
  hmacKey: Type.String({ minLength: 1 }),

  /** Hours to delay automatic capture after authorization (0 = immediate capture) */
  captureDelayHours: Type.Optional(
    Type.Number({
      minimum: 0,
    }),
  ),

  /** Enable 3D Secure authentication for card payments */
  enableThreeDS: Type.Optional(Type.Boolean({ default: true })),

  /** Enable stored payment methods support */
  storedPaymentMethodsEnabled: Type.Optional(Type.Boolean({ default: true })),

  /** Payment interface for stored payment methods  */
  storedPaymentMethodsPaymentInterface: Type.Optional(
    Type.String({default: 'checkout-cko'}),
  ),

  /** Interface account for stored payment methods ie. US-store. If not provided, the channel ID will be used */
  storedPaymentMethodsInterfaceAccount: Type.Optional(
    Type.String(),
  ),
});

export const CkoChannelsConfigSchema = Type.Array(CkoChannelConfigSchema);

/**
 * Multi-channel Checkout.com Configuration
 *
 * Supports multiple payment channels with dynamic selection based on cart context.
 */
export const CkoConfigSchema = Type.Object({
  /** Default channel configuration (used when no specific channel matches) */
  default: CkoChannelConfigSchema,

  /**
   * JSONata path expression to extract channel key from cart
   * Examples:
   * - 'store.key' → cart.store.key
   * - 'custom.fields.channelKey' → cart.custom.fields.channelKey
   */
  channelPath: Type.Optional(
    Type.String({
      minLength: 1,
      default: 'store.key',
    }),
  ),

  /** Additional channel configurations (optional) */
  channels: Type.Optional(CkoChannelsConfigSchema),
});

/**
 * URL string validation helper
 */
const UrlString = () =>
  Type.String({
    minLength: 1,
    pattern: '^https?://',
  });

/**
 * Application Configuration Schema
 *
 * Complete configuration for the Checkout.com payment connector.
 */
export const AppConfigSchema = Type.Object({
  // CommerceTools Configuration
  /** CommerceTools project key */
  projectKey: Type.String({ minLength: 1 }),

  /** CommerceTools API client ID */
  clientId: Type.String({ minLength: 1 }),

  /** CommerceTools API client secret */
  clientSecret: Type.String({ minLength: 1 }),

  /** JWKS URL for JWT token validation */
  jwksUrl: UrlString(),

  /** JWT issuer for token validation */
  jwtIssuer: UrlString(),

  /** CommerceTools OAuth authorization URL */
  authUrl: UrlString(),

  /** CommerceTools API base URL */
  apiUrl: UrlString(),

  /** CommerceTools session service URL */
  sessionUrl: UrlString(),

  // Application Configuration
  /** Timeout for health check endpoints (milliseconds) */
  healthCheckTimeout: Type.Number({ minimum: 1000, maximum: 30000 }),

  /** Logger level (error, warn, info, debug) */
  loggerLevel: Type.Union([Type.Literal('error'), Type.Literal('warn'), Type.Literal('info'), Type.Literal('debug')]),

  // Payment Configuration
  /** URL to redirect customer after payment completion */
  merchantReturnUrl: UrlString(),

  /** Checkout.com environment */
  ckoEnvironment: Type.Union([Type.Literal('sandbox'), Type.Literal('production')]),

  /** Checkout.com multi-channel configuration */
  ckoConfig: CkoConfigSchema,
});

export type CkoChannels = Static<typeof CkoChannelsConfigSchema>;
export type CkoChannelConfig = Static<typeof CkoChannelConfigSchema>;
export type CkoConfig = Static<typeof CkoConfigSchema>;
export type AppConfig = Static<typeof AppConfigSchema>;
