import { paymentMethodConfig } from '../config/payment-method.config';
import { convertPaymentMethodFromCkoFormat } from './method-name.helper';

export const isMethodAutoCaptured = (paymentMethod: string): boolean => {
  const normalizedPaymentMethod = convertPaymentMethodFromCkoFormat(paymentMethod);

  if (paymentMethodConfig[normalizedPaymentMethod]) {
    return !paymentMethodConfig[normalizedPaymentMethod].supportSeparateCapture;
  }

  return false;
};
