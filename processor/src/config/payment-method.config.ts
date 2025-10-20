/**
 * Specific configuration for payment methods that require special handling.
 *
 */
export type PaymentMethodConfig = {
  [key: string]: {
    /**
     * Whether the payment method supports separate capture.
     */
    supportSeparateCapture: boolean;
  };
};

export const paymentMethodConfig: PaymentMethodConfig = {
  alma: {
    supportSeparateCapture: false,
  },
  bizum: {
    supportSeparateCapture: false,
  },
  eps: {
    supportSeparateCapture: false,
  },
  ideal: {
    supportSeparateCapture: false,
  },
  mbway: {
    supportSeparateCapture: false,
  },
  przelewy24: {
    supportSeparateCapture: false,
  },
  sepa: {
    supportSeparateCapture: false,
  },
};
