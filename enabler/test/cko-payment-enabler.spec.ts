import { describe, test, expect, vi } from 'vitest';

vi.mock('@checkout.com/checkout-web-components', () => ({
  loadCheckoutWebComponents: vi.fn().mockResolvedValue({}),
}));

vi.mock('../src/api/api.client', () => ({
  PaymentApi: vi.fn().mockImplementation(function () {
    return {
      createPaymentSession: vi.fn().mockResolvedValue({ id: 'session-id', paymentReference: 'payment-reference' }),
      getPaymentConfig: vi.fn().mockResolvedValue({ publicKey: 'pk_test', environment: 'sandbox' }),
      getStoredPaymentMethods: vi.fn().mockResolvedValue({ storedPaymentMethods: [] }),
    };
  }),
}));

import { CkoPaymentEnabler } from '../src/payment-enabler/cko-payment-enabler';

describe('CkoPaymentEnabler', () => {
  const enabler = new CkoPaymentEnabler({
    processorUrl: 'http://localhost:8080',
    sessionId: 'session-id',
    onComplete: vi.fn(),
    onError: vi.fn(),
  });

  test('createExpressBuilder rejects because express checkout is not supported', async () => {
    await expect(enabler.createExpressBuilder('applepay')).rejects.toThrow(
      'Express checkout is not supported by the Checkout.com connector',
    );
  });
});
