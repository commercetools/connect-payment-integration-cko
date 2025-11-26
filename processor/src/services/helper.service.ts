import {
  CustomFieldsDraft,
  GenerateInterfaceInteractionCustomFieldsDraft,
  InterfaceInteractionFields,
} from '@commercetools/connect-payments-sdk';
import { getConfig } from '@app/config/config';
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

/**
 * Creates interface interaction custom fields for audit logging
 *
 * @remarks
 * Only creates interactions if configured to save them in settings
 *
 * @param data - Interaction data including type, request and response
 * @returns Custom fields array or undefined if not configured to save
 */
export const populateInterfaceInteraction = (data: InterfaceInteractionFields): CustomFieldsDraft[] | undefined => {
  if (!getConfig().isSaveInterfaceInteractions()) {
    return undefined;
  }

  return [
    GenerateInterfaceInteractionCustomFieldsDraft({
      interactionId: data.interactionId,
      type: data.type,
      createdAt: data.createdAt,
      request: data.request,
      response: data.response,
    }),
  ];
};
