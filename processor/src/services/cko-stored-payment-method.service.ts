import {
  ErrorInvalidOperation,
  PaymentMethod,
  CommercetoolsCartService,
  CommercetoolsPaymentService,
  CommercetoolsPaymentMethodService,
} from '@commercetools/connect-payments-sdk';

import { getCartIdFromContext } from '../libs/fastify/context/context';

import { StoredPaymentMethodsResponse } from '../dtos/operations/stored-payment-methods.dto';
import { getConfig } from '../config/config';
import { CkoInstrument } from '../clients/types/instrument.type';
import { getCkoApiClient } from '../clients/cko.client';
import { log } from '../libs/logger';
import { StoredPaymentMethodsConverter } from './converters/stored-payment-methods.converter';
import { CkoStoredPaymentMethodServiceOptions } from './types/cko-payment.type';

export class CkoStoredPaymentMethodService {
  private ctCartService: CommercetoolsCartService;
  private ctPaymentService: CommercetoolsPaymentService;
  private ctPaymentMethodService: CommercetoolsPaymentMethodService;
  private storedPaymentMethodsConverter: StoredPaymentMethodsConverter;

  constructor(opts: CkoStoredPaymentMethodServiceOptions)  {
    this.ctCartService = opts.ctCartService;
    this.ctPaymentService = opts.ctPaymentService;
    this.ctPaymentMethodService = opts.ctPaymentMethodService;
    this.storedPaymentMethodsConverter = new StoredPaymentMethodsConverter();
  }

  async getStoredPaymentMethods(): Promise<StoredPaymentMethodsResponse> {
    if(!getConfig().isStoredPaymentMethodsEnabled()){
      return {
        storedPaymentMethods: [],
      };
    }

    const customerId = await this.getCustomerIdFromCart();

    const { results: ctPaymentMethods } = await this.ctPaymentMethodService.find({
      customerId,
      paymentInterface: getConfig().getStoredPaymentMethodsPaymentInterface(),
      interfaceAccount: getConfig().getStoredPaymentMethodsInterfaceAccount(),
    });

    if (ctPaymentMethods.length === 0) {
      return { storedPaymentMethods: [] };
    }

    const ckoInstruments = await this.getCkoPaymentMethods(ctPaymentMethods);

    return this.storedPaymentMethodsConverter.convert({
      ctPaymentMethods,
      ckoInstruments,
    });
  }

  public async deleteStoredPaymentMethod(id: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  private async getCkoPaymentMethods(ctPaymentMethods: PaymentMethod[]): Promise<CkoInstrument[]> {
    const instrumentPromises = ctPaymentMethods
      .filter((pm) => pm.token?.value)
      .map(async (ctPaymentMethod) => {
        try {
          return await getCkoApiClient().instruments.getInstrument(ctPaymentMethod.token!.value);
        } catch (error) {
          log.error('Error fetching CKO instrument', {
            error,
            ctPaymentMethodId: ctPaymentMethod.id,
            token: ctPaymentMethod.token?.value,
          });
          return null;
        }
      });

    const results = await Promise.all(instrumentPromises);

    return results.filter((instrument): instrument is CkoInstrument => instrument !== null);
  }

  private async getCustomerIdFromCart(): Promise<string> {
    const ctCart = await this.ctCartService.getCart({
      id: getCartIdFromContext(),
    });

    const customerId = ctCart.customerId;

    if (!customerId) {
      throw new ErrorInvalidOperation('The cart has no customerId set.', {
        privateMessage: 'Cannot get stored payment methods without a customerId on the cart.',
        privateFields: {
          cart: {
            id: ctCart.id,
          },
        },
      });
    }

    return customerId;
  }
}
