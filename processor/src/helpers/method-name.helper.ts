import { getAllowedPaymentMethodsFromContext } from '../libs/fastify/context/context';

export const convertAllowedPaymentMethodsToCkoFormat = (): string[] => {
  const allowedPaymentMethods: string[] = getAllowedPaymentMethodsFromContext();
  const ckoAllowedPaymentMethods: string[] = [];
  allowedPaymentMethods.forEach((paymentMethod) => {
    ckoAllowedPaymentMethods.push(convertPaymentMethodToCkoFormat(paymentMethod));
  });

  return ckoAllowedPaymentMethods;
};

const PAYMENT_METHOD_TO_CKO_MAPPING: Record<string, string> = {
  ach: 'plaid',
  przelewy24: 'p24',
};

const CKO_TO_PAYMENT_METHOD_MAPPING: Record<string, string> = Object.entries(PAYMENT_METHOD_TO_CKO_MAPPING).reduce(
  (acc, [key, value]) => {
    acc[value] = key;
    return acc;
  },
  {} as Record<string, string>,
);

export const convertPaymentMethodToCkoFormat = (paymentMethod: string): string => {
  return PAYMENT_METHOD_TO_CKO_MAPPING[paymentMethod] ?? paymentMethod;
};

export const convertPaymentMethodFromCkoFormat = (paymentMethod: string): string => {
  return CKO_TO_PAYMENT_METHOD_MAPPING[paymentMethod] ?? paymentMethod;
};
