export const config = {
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
  ckoPublicKey: process.env.CKO_PUBLIC_KEY || 'ckoPublicKey',
  ckoSecretKey: process.env.CKO_SECRET_KEY || 'ckoSecretKey',
  ckoChannelId: process.env.CKO_CHANNEL_ID || 'ckoChannelId',
  ckoHmacKey: process.env.CKO_HMAC_KEY || 'ckoHmacKey',
};

export const getConfig = () => {
  return config;
};
