import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const contextKey = vi.hoisted(() => ({ value: undefined as string | undefined }));

vi.mock('@lib/fastify/context/context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@lib/fastify/context/context')>()),
  getCkoConfigKeyFromContext: () => contextKey.value,
}));

const baseEnv = {
  CTP_PROJECT_KEY: 'project',
  CTP_CLIENT_ID: 'ctp-client',
  CTP_CLIENT_SECRET: 'ctp-secret',
  CTP_JWKS_URL: 'https://jwks.example.com',
  CTP_JWT_ISSUER: 'https://issuer.example.com',
  CTP_AUTH_URL: 'https://auth.example.com',
  CTP_API_URL: 'https://api.example.com',
  CTP_SESSION_URL: 'https://session.example.com',
  MERCHANT_RETURN_URL: 'https://return.example.com',
};

const channel = (key: string, extra: Record<string, unknown> = {}) => ({
  key,
  channelId: `ch_${key}`,
  publicKey: 'pk',
  secretKey: `sk_${key}`,
  hmacKey: 'hmac',
  ...extra,
});

async function loadWith(environment: string, ckoConfig: unknown) {
  vi.resetModules();
  Object.assign(process.env, baseEnv, {
    CKO_ENVIRONMENT: environment,
    CKO_CONFIG: JSON.stringify(ckoConfig),
  });
  const { getConfig } = await import('../../src/config/config');
  return getConfig;
}

describe('CKO_CONFIG MSSD support', () => {
  beforeEach(() => {
    contextKey.value = undefined;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('keeps the shared hosts when no client ID is configured', async () => {
    const getConfig = await loadWith('production', { default: channel('default') });

    expect(getConfig().getApiBaseUrl()).toBe('https://api.checkout.com');
    expect(getConfig().getAccessBaseUrl()).toBe('https://access.checkout.com');
  });

  it('derives the hosts of the default channel from its client ID', async () => {
    const getConfig = await loadWith('sandbox', {
      default: channel('default', { clientId: 'cli_vkuhvk4vjn2edkps7dfsq6emqm' }),
    });

    expect(getConfig().getApiBaseUrl()).toBe('https://vkuhvk4v.api.sandbox.checkout.com');
    expect(getConfig().getAccessBaseUrl()).toBe('https://vkuhvk4v.access.sandbox.checkout.com');
  });

  it('resolves per channel and falls back to the default channel', async () => {
    const getConfig = await loadWith('production', {
      default: channel('default', { clientId: 'cli_aaaaaaaa1111' }),
      channels: [channel('eu', { clientId: 'cli_bbbbbbbb2222' }), channel('legacy')],
    });

    contextKey.value = 'eu';
    expect(getConfig().getApiBaseUrl()).toBe('https://bbbbbbbb.api.checkout.com');

    contextKey.value = 'legacy';
    expect(getConfig().getApiBaseUrl()).toBe('https://api.checkout.com');

    contextKey.value = 'unknown';
    expect(getConfig().getApiBaseUrl()).toBe('https://aaaaaaaa.api.checkout.com');
  });

  it('honours explicit host overrides', async () => {
    const getConfig = await loadWith('production', {
      default: channel('default', {
        clientId: 'cli_aaaaaaaa1111',
        apiBaseUrl: 'https://other.api.checkout.com',
        accessBaseUrl: 'https://other.access.checkout.com',
      }),
    });

    expect(getConfig().getApiBaseUrl()).toBe('https://other.api.checkout.com');
    expect(getConfig().getAccessBaseUrl()).toBe('https://other.access.checkout.com');
  });

  it('fails at load time with a clear error for an invalid client ID', async () => {
    const getConfig = await loadWith('production', { default: channel('default', { clientId: 'cli_123' }) });

    expect(() => getConfig()).toThrow(/Invalid CKO_CONFIG for channel "default": Invalid Checkout\.com client ID/);
  });

  it('fails at load time when a sandbox host is configured for production in any channel', async () => {
    const getConfig = await loadWith('production', {
      default: channel('default'),
      channels: [channel('eu', { apiBaseUrl: 'https://aaaaaaaa.api.sandbox.checkout.com' })],
    });

    expect(() => getConfig()).toThrow(/channel "eu".*cannot be used in production/);
  });
});

describe('CKO API clients use the derived host', () => {
  const server = setupServer();

  beforeEach(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    server.resetHandlers();
    server.close();
    vi.resetModules();
  });

  it('calls payments, payment-methods and instruments on the merchant-specific host', async () => {
    await loadWith('production', {
      default: channel('default', { clientId: 'cli_vkuhvk4vjn2edkps7dfsq6emqm' }),
    });
    const { PaymentApi } = await import('../../src/clients/api/payment.api');
    const { PaymentMethodsApi } = await import('../../src/clients/api/payment-method.api');
    const { InstrumentApi } = await import('../../src/clients/api/instrument.api');
    const { PaymentSessionApi } = await import('../../src/clients/api/payment-session.api');

    const host = 'https://vkuhvk4v.api.checkout.com';
    server.use(
      http.get(`${host}/payments/pay_1`, () => HttpResponse.json({ id: 'pay_1' })),
      http.get(`${host}/payment-methods`, () => HttpResponse.json({ methods: [] })),
      http.get(`${host}/instruments/src_1`, () => HttpResponse.json({ id: 'src_1' })),
      http.post(`${host}/payment-sessions`, () => HttpResponse.json({ id: 'ps_1' })),
    );

    await expect(new PaymentApi().getPayment('pay_1')).resolves.toMatchObject({ id: 'pay_1' });
    await expect(new PaymentMethodsApi().getPaymentMethods()).resolves.toBeDefined();
    await expect(new InstrumentApi().getInstrument('src_1')).resolves.toMatchObject({ id: 'src_1' });
    await expect(
      new PaymentSessionApi().createPaymentSession({} as Parameters<PaymentSessionApi['createPaymentSession']>[0]),
    ).resolves.toMatchObject({ id: 'ps_1' });
  });
});
