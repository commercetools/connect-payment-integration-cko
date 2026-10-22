import { CustomFieldsDraft, GenerateInterfaceInteractionCustomFieldsDraft } from '@commercetools/connect-payments-sdk';
import { getConfig } from '@app/config/config';
import { log } from '@lib/logger';
import { paymentSDK } from '@app/payment-sdk';
import { getMerchantReturnUrlFromContext } from '@lib/fastify/context/context';

/**
 * Builds the redirect URL to return the customer to the merchant site
 *
 * @param paymentReference - The payment ID to append as query parameter
 * @returns Complete URL with payment reference parameter
 */
export const buildRedirectMerchantUrl = (paymentReference: string): string => {
  const merchantReturnUrl = getMerchantReturnUrlFromContext() || getConfig().merchantReturnUrl;
  const redirectUrl = new URL(merchantReturnUrl);

  redirectUrl.searchParams.append('paymentReference', paymentReference);
  return redirectUrl.toString();
};

const MASKED_VALUE = '***';

/**
 * Keys masked at any depth of a request or response payload. They match the fields of the Checkout.com types in
 * `processor/src/clients/types`:
 * - `customer`, `billing`, `shipping`: shopper name, e-mail, phone, tax number and addresses.
 * - `session_data`: opaque payment session data submitted by the browser.
 * - `payment_session_token`, `payment_session_secret`: credentials of a payment session.
 */
const MASKED_KEYS = new Set([
  'customer',
  'billing',
  'shipping',
  'session_data',
  'payment_session_token',
  'payment_session_secret',
]);

/**
 * Keys masked only when they are a direct child of one of the parent keys. The `id` of a `source` is the
 * instrument ID, which works as the payment token of the shopper.
 */
const MASKED_KEYS_BY_PARENT: Record<string, ReadonlySet<string>> = {
  source: new Set(['id']),
};

const maskFields = (value: unknown, parentKey?: string): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => maskFields(item, parentKey));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => {
        const isMasked =
          MASKED_KEYS.has(key) || (parentKey !== undefined && MASKED_KEYS_BY_PARENT[parentKey]?.has(key) === true);
        return [key, isMasked ? MASKED_VALUE : maskFields(inner, key)];
      }),
    );
  }
  return value;
};

/**
 * Masks the sensitive fields (personal data and payment credentials) of a Checkout.com request, response or
 * webhook event before it is saved. The input is not modified.
 *
 * @param payload - The payload to mask
 * @returns A copy of the payload where the sensitive values are replaced by `***`
 */
export const maskPayload = <T>(payload: T): T => maskFields(payload) as T;

export type InterfaceInteractionData = {
  interactionId: string;
  type: string;
  createdAt: string;
  request?: unknown;
  response?: unknown;
};

const serializeMasked = (payload: unknown): string | undefined =>
  payload === undefined ? undefined : JSON.stringify(maskPayload(payload));

/**
 * Memoizes (per process) an idempotent creation of custom types. The SDK `createOrUpdate*` functions only add the
 * missing types and fields. A failed attempt is not memoized, so the next call retries. It never throws: a failure
 * is logged and reported as `false`, so it cannot block a payment or a webhook.
 */
const memoizeEnsure = (description: string, create: () => Promise<unknown>): (() => Promise<boolean>) => {
  let pending: Promise<boolean> | undefined;

  return () => {
    pending ??= create().then(
      () => true,
      (error) => {
        pending = undefined;
        log.warn(`Could not create the ${description} custom type on demand, the data will not be saved`, { error });
        return false;
      },
    );
    return pending;
  };
};

/**
 * Makes sure the predefined interface interaction custom type exists, with all its fields.
 * The post-deploy script is the main way to create it; this covers a failed post-deploy or a project deployed
 * before the type existed.
 *
 * @returns true if the type is available
 */
export const ensureInterfaceInteractionType = memoizeEnsure('interface interaction', () =>
  paymentSDK.ctCustomTypeService.createOrUpdatePredefinedInterfaceInteractionType(),
);

/**
 * Makes sure the predefined payment method custom types (card, SEPA) exist, with all their fields.
 * The post-deploy script is the main way to create them; this covers a failed post-deploy or a project deployed
 * before the types existed.
 *
 * @returns true if the types are available
 */
export const ensurePaymentMethodTypes = memoizeEnsure('payment method', () =>
  paymentSDK.ctCustomTypeService.createOrUpdatePredefinedPaymentMethodTypes(),
);

/**
 * Creates interface interaction custom fields for audit logging
 *
 * @remarks
 * Only creates interactions if configured to save them in settings. The request and the response are masked
 * (see {@link maskPayload}) before they are serialized. The custom type is created if missing; when that fails the
 * interaction is skipped, so the payment flow continues.
 *
 * @param data - Interaction data including type, request and response objects
 * @returns Custom fields array or undefined if not configured to save or the type is not available
 */
export const populateInterfaceInteraction = async (
  data: InterfaceInteractionData,
): Promise<CustomFieldsDraft[] | undefined> => {
  if (!getConfig().isSaveInterfaceInteractions()) {
    return undefined;
  }

  if (!(await ensureInterfaceInteractionType())) {
    return undefined;
  }

  return [
    GenerateInterfaceInteractionCustomFieldsDraft({
      interactionId: data.interactionId,
      type: data.type,
      createdAt: data.createdAt,
      request: serializeMasked(data.request),
      response: serializeMasked(data.response),
    }),
  ];
};
