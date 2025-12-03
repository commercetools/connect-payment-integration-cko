import { Static, Type } from '@sinclair/typebox';

/**
 * Public shareable payment provider configuration. Do not include any sensitive data.
 */
export const ConfigResponseSchema = Type.Object({
  /** Public API key for client-side operations */
  publicKey: Type.String({ minLength: 1 }),

  /** Checkout.com environment (e.g., 'sandbox' or 'production') */
  environment: Type.String({ minLength: 1 }),

  /** Indicates if stored payment methods are enabled */
  storedPaymentMethodsEnabled: Type.Boolean(),
});

export type ConfigResponseSchemaDTO = Static<typeof ConfigResponseSchema>;
