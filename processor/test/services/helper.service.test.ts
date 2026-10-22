import { beforeEach, describe, expect, test, vi } from 'vitest';
import { paymentSDK } from '../../src/payment-sdk';
import { maskPayload } from '../../src/services/helper.service';
import { getConfig } from '../../src/config/config';

vi.mock('@app/config/config', () => ({ getConfig: vi.fn() }));
vi.mock('@lib/fastify/context/context', () => ({ getMerchantReturnUrlFromContext: vi.fn() }));
vi.mock('@lib/logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@app/payment-sdk', () => ({
  paymentSDK: {
    ctCustomTypeService: {
      createOrUpdatePredefinedInterfaceInteractionType: vi.fn(),
      createOrUpdatePredefinedPaymentMethodTypes: vi.fn(),
    },
  },
}));

const interactionTypeMock = vi.mocked(paymentSDK.ctCustomTypeService.createOrUpdatePredefinedInterfaceInteractionType);
const paymentMethodTypesMock = vi.mocked(paymentSDK.ctCustomTypeService.createOrUpdatePredefinedPaymentMethodTypes);

describe('maskPayload', () => {
  test('masks customer, billing and shipping completely', () => {
    const input = {
      amount: 1000,
      currency: 'EUR',
      customer: {
        id: 'cus_1',
        email: 'jane@example.com',
        name: 'Jane Doe',
        phone: { country_code: '+34', number: '600000000' },
        tax_number: 'X123',
      },
      billing: { address: { country: 'ES', address_line1: 'Main St 1', city: 'Madrid', zip: '28001' } },
      shipping: { address: { country: 'ES', address_line1: 'Other St 2' }, phone: { number: '611111111' } },
    };

    expect(maskPayload(input)).toEqual({
      amount: 1000,
      currency: 'EUR',
      customer: '***',
      billing: '***',
      shipping: '***',
    });
  });

  test('masks the payment session data, token and secret', () => {
    expect(
      maskPayload({ session_data: 'abc', payment_session_token: 'tok', payment_session_secret: 'sec', id: 'ps_1' }),
    ).toEqual({ session_data: '***', payment_session_token: '***', payment_session_secret: '***', id: 'ps_1' });
  });

  test('masks the instrument id of the source but keeps the rest of the source', () => {
    const input = {
      id: 'pay_1',
      source: { id: 'src_1', type: 'card', scheme: 'Visa', bin: '424242', last_4: '4242', expiry_month: 12 },
    };

    expect(maskPayload(input)).toEqual({
      id: 'pay_1',
      source: { id: '***', type: 'card', scheme: 'Visa', bin: '424242', last_4: '4242', expiry_month: 12 },
    });
  });

  test('masks the nested fields of a webhook event', () => {
    const input = {
      event: {
        id: 'evt_1',
        type: 'payment_approved',
        data: {
          id: 'pay_1',
          source: { id: 'src_1', type: 'card' },
          metadata: { payment_id: 'ct-1' },
          customer: { email: 'jane@example.com' },
        },
      },
    };

    expect(maskPayload(input)).toEqual({
      event: {
        id: 'evt_1',
        type: 'payment_approved',
        data: {
          id: 'pay_1',
          source: { id: '***', type: 'card' },
          metadata: { payment_id: 'ct-1' },
          customer: '***',
        },
      },
    });
  });

  test('does not mask the id when it is not a direct child of source', () => {
    expect(maskPayload({ id: 'pay_1', metadata: { id: 'm1' }, source: { nested: { id: 'keep' } } })).toEqual({
      id: 'pay_1',
      metadata: { id: 'm1' },
      source: { nested: { id: 'keep' } },
    });
  });

  test('masks sensitive keys inside arrays', () => {
    expect(maskPayload({ items: [{ name: 'a', customer: 'x' }], source: [{ id: 's1' }] })).toEqual({
      items: [{ name: 'a', customer: '***' }],
      source: [{ id: '***' }],
    });
  });

  test('keeps non sensitive fields, nulls and primitives untouched', () => {
    const input = { reference: 'ref', capture: true, capture_on: null, '3ds': { enabled: true }, amount: 0 };

    expect(maskPayload(input)).toEqual(input);
    expect(maskPayload('text')).toBe('text');
    expect(maskPayload(null)).toBeNull();
  });

  test('does not modify the input', () => {
    const input = { customer: { email: 'jane@example.com' }, source: { id: 'src_1' } };

    maskPayload(input);

    expect(input).toEqual({ customer: { email: 'jane@example.com' }, source: { id: 'src_1' } });
  });

  test('masks the own fields of an error object', () => {
    const error = Object.assign(new Error('failed'), { customer: { email: 'jane@example.com' }, status: 422 });

    expect(JSON.parse(JSON.stringify(maskPayload(error)))).toEqual({ customer: '***', status: 422 });
  });
});

// The ensure functions memoize per module instance, so the module is loaded again for each test
type HelperService = typeof import('../../src/services/helper.service');
let helper: HelperService;

describe('populateInterfaceInteraction', () => {
  const data = {
    interactionId: 'int-1',
    type: 'CreatePayment',
    createdAt: '2026-01-01T00:00:00.000Z',
    request: { amount: 10, customer: { email: 'jane@example.com' } },
    response: { id: 'pay_1', source: { id: 'src_1', type: 'card' } },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    helper = await import('../../src/services/helper.service');
    vi.mocked(getConfig).mockReturnValue({ isSaveInterfaceInteractions: () => true } as ReturnType<typeof getConfig>);
    interactionTypeMock.mockResolvedValue({} as Awaited<ReturnType<typeof interactionTypeMock>>);
  });

  test('returns undefined and does not touch commercetools when the setting is off', async () => {
    vi.mocked(getConfig).mockReturnValue({ isSaveInterfaceInteractions: () => false } as ReturnType<typeof getConfig>);

    expect(await helper.populateInterfaceInteraction(data)).toBeUndefined();
    expect(interactionTypeMock).not.toHaveBeenCalled();
  });

  test('serializes the masked request and response', async () => {
    const result = await helper.populateInterfaceInteraction(data);

    expect(result).toHaveLength(1);
    expect(result![0].type).toEqual({ key: 'commercetools-checkout-payment-interface-interaction', typeId: 'type' });
    expect(result![0].fields).toEqual({
      interactionId: 'int-1',
      type: 'CreatePayment',
      createdAt: '2026-01-01T00:00:00.000Z',
      request: JSON.stringify({ amount: 10, customer: '***' }),
      response: JSON.stringify({ id: 'pay_1', source: { id: '***', type: 'card' } }),
    });
  });

  test('leaves request and response undefined when they are not given', async () => {
    const result = await helper.populateInterfaceInteraction({ ...data, request: undefined, response: undefined });

    expect(result![0].fields).toEqual(
      expect.objectContaining({ request: undefined, response: undefined, interactionId: 'int-1' }),
    );
  });

  test('skips the interaction without throwing when the type cannot be created', async () => {
    interactionTypeMock.mockRejectedValue(new Error('boom'));

    expect(await helper.populateInterfaceInteraction(data)).toBeUndefined();
  });
});

describe('ensure custom types', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    helper = await import('../../src/services/helper.service');
  });

  test('creates the interface interaction type once and then reuses the result', async () => {
    interactionTypeMock.mockResolvedValue({} as Awaited<ReturnType<typeof interactionTypeMock>>);

    expect(await helper.ensureInterfaceInteractionType()).toBe(true);
    expect(await helper.ensureInterfaceInteractionType()).toBe(true);
    expect(interactionTypeMock).toHaveBeenCalledTimes(1);
  });

  test('retries after a failure and never throws', async () => {
    paymentMethodTypesMock.mockRejectedValueOnce(new Error('boom'));
    paymentMethodTypesMock.mockResolvedValueOnce([]);

    expect(await helper.ensurePaymentMethodTypes()).toBe(false);
    expect(await helper.ensurePaymentMethodTypes()).toBe(true);
    expect(await helper.ensurePaymentMethodTypes()).toBe(true);
    expect(paymentMethodTypesMock).toHaveBeenCalledTimes(2);
  });
});
