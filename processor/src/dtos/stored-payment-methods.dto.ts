import { Static, Type } from '@sinclair/typebox';

export const StoredPaymentMethodDisplayOptionsSchema = Type.Object({
  endDigits: Type.Optional(Type.String()),
  brand: Type.Optional(
    Type.Object({
      key: Type.String(),
    }),
  ),
  expiryMonth: Type.Optional(Type.Number()),
  expiryYear: Type.Optional(Type.Number()),
  logoUrl: Type.Optional(Type.String()),
});

export const StoredPaymentMethodSchema = Type.Object({
  id: Type.String(),
  type: Type.String(),
  isDefault: Type.Boolean(),
  createdAt: Type.String({ format: 'date-time' }),
  displayOptions: StoredPaymentMethodDisplayOptionsSchema,
});

export const StoredPaymentMethodsResponseSchema = Type.Object({
  storedPaymentMethods: Type.Array(StoredPaymentMethodSchema),
});

export const ProcessStoredPaymentRequestSchema = Type.Object({
  paymentReference: Type.String(),
});

export const ProcessStoredPaymentResponseSchema = Type.Object({
  id: Type.String(),
  status: Type.String(),
  type: Type.Optional(Type.String()),
  paymentReference: Type.String(),
  action: Type.Optional(
    Type.Object({
      type: Type.Optional(Type.String()),
      url: Type.String(),
    }),
  ),
});

export type ConfirmStoredPaymentResponseDTO = {
  paymentReference: string;
  merchantReturnUrl: string;
};

export type StoredPaymentMethodDisplayOptions = Static<typeof StoredPaymentMethodDisplayOptionsSchema>;
export type StoredPaymentMethod = Static<typeof StoredPaymentMethodSchema>;
export type StoredPaymentMethodsResponseDTO = Static<typeof StoredPaymentMethodsResponseSchema>;
export type ProcessStoredPaymentRequestDTO = Static<typeof ProcessStoredPaymentRequestSchema>;
export type ProcessStoredPaymentResponseDTO = Static<typeof ProcessStoredPaymentResponseSchema>;
