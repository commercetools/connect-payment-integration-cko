import { PaymentMethod } from '@commercetools/connect-payments-sdk';
import { CkoInstrument } from '../../clients/types/instrument.type';
import {
  StoredPaymentMethod,
  StoredPaymentMethodDisplayOptions,
  StoredPaymentMethodsResponse,
} from '../../dtos/operations/stored-payment-methods.dto';
import { log } from '../../libs/logger';

export class StoredPaymentMethodsConverter {
  public convert(opts: {
    ctPaymentMethods: PaymentMethod[];
    ckoInstruments: CkoInstrument[];
  }): StoredPaymentMethodsResponse {
    const ckoInstrumentsMap = this.createInstrumentsMap(opts.ckoInstruments);

    const storedPaymentMethods = opts.ctPaymentMethods
      .map((ctPaymentMethod) => this.convertPaymentMethod(ctPaymentMethod, ckoInstrumentsMap))
      .filter((pm): pm is StoredPaymentMethod => pm !== null);

    return { storedPaymentMethods };
  }

  private createInstrumentsMap(ckoInstruments: CkoInstrument[]): Map<string, CkoInstrument> {
    return new Map(ckoInstruments.map((instrument) => [instrument.id, instrument]));
  }

  /**
   * Convert a CT payment method to a stored payment method.
   * Returns null if no matching CKO instrument is found.
   */
  private convertPaymentMethod(
    ctPaymentMethod: PaymentMethod,
    ckoInstrumentsMap: Map<string, CkoInstrument>,
  ): StoredPaymentMethod | null {
    const tokenValue = ctPaymentMethod.token?.value;

    if (!tokenValue) {
      log.warn('CT payment method has no token', { ctPaymentMethodId: ctPaymentMethod.id });
      return null;
    }

    const ckoInstrument = ckoInstrumentsMap.get(tokenValue);

    if (!ckoInstrument) {
      log.warn('No matching CKO instrument found for CT payment method', {
        ctPaymentMethodId: ctPaymentMethod.id,
        token: tokenValue,
      });
      return null;
    }

    return {
      id: ctPaymentMethod.id,
      createdAt: ctPaymentMethod.createdAt,
      isDefault: ctPaymentMethod.default,
      token: tokenValue,
      type: ctPaymentMethod.method || '',
      displayOptions: this.convertPaymentMethodDisplayOptions(ckoInstrument),
    };
  }

  private convertPaymentMethodDisplayOptions(ckoInstrument: CkoInstrument): StoredPaymentMethodDisplayOptions {
    if (ckoInstrument.type === 'card') {
      return {
        brand: {
          //TODO: map to a CT value
          key: ckoInstrument.scheme || '',
        },
        endDigits: ckoInstrument.last4 || '',
        expiryMonth: ckoInstrument.expiryMonth as number,
        expiryYear: ckoInstrument.expiryYear as number,
      };
    }

    return {};
  }
}
