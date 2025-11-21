import {
  ErrorInvalidOperation,
  PaymentMethod,
  CommercetoolsCartService,
  CommercetoolsPaymentService,
  CommercetoolsPaymentMethodService,
} from '@commercetools/connect-payments-sdk';

import { getCartIdFromContext } from '../libs/fastify/context/context';

import {
  ProcessStoredPaymentRequestDTO,
  ProcessStoredPaymentResponseDTO,
  StoredPaymentMethodsResponseDTO,
} from '../dtos/stored-payment-methods.dto';
import { getConfig } from '../config/config';
import { CkoInstrument } from '../clients/types/instrument.type';
import { getCkoApiClient } from '../clients/cko.client';
import { log } from '../libs/logger';
import { GetStoredPaymentMethodsConverter } from './converters/get-stored-payment-methods.converter';
import { CkoStoredPaymentMethodServiceOptions } from './types/cko-payment.type';
import { ProcessStoredPaymentConverter } from './converters/process-stored-payment.converter';

export class CkoStoredPaymentMethodService {
  private ctCartService: CommercetoolsCartService;
  private ctPaymentService: CommercetoolsPaymentService;
  private ctPaymentMethodService: CommercetoolsPaymentMethodService;
  private getStoredPaymentMethodsConverter: GetStoredPaymentMethodsConverter;
  private processStoredPaymentConverter: ProcessStoredPaymentConverter;

  constructor(opts: CkoStoredPaymentMethodServiceOptions) {
    this.ctCartService = opts.ctCartService;
    this.ctPaymentService = opts.ctPaymentService;
    this.ctPaymentMethodService = opts.ctPaymentMethodService;
    this.getStoredPaymentMethodsConverter = new GetStoredPaymentMethodsConverter();
    this.processStoredPaymentConverter = new ProcessStoredPaymentConverter();
  }

  async getStoredPaymentMethods(): Promise<StoredPaymentMethodsResponseDTO> {
    if (!getConfig().isStoredPaymentMethodsEnabled()) {
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

    return this.getStoredPaymentMethodsConverter.convert({
      ctPaymentMethods,
      ckoInstruments,
    });
  }

  public async processStoredPayment(
    id: string,
    opts: { data: ProcessStoredPaymentRequestDTO },
  ): Promise<ProcessStoredPaymentResponseDTO> {
    const payment = await this.ctPaymentService.getPayment({
      id: opts.data.paymentReference,
    });
    // TODO:  two times we get the cart, consider optimizing
    const cart = await this.ctCartService.getCart({
      id: getCartIdFromContext(),
    });
    const customerId = await this.getCustomerIdFromCart();

    const ctPaymentMethod = await this.ctPaymentMethodService.get({
      id,
      customerId,
      paymentInterface: getConfig().getStoredPaymentMethodsPaymentInterface(),
      interfaceAccount: getConfig().getStoredPaymentMethodsInterfaceAccount(),
    });

    const ckoPaymentRequest = this.processStoredPaymentConverter.convertRequest({
      token: ctPaymentMethod.token!.value!,
      cart,
      payment,
    });

    const ckoPaymentResponse = await getCkoApiClient().payments.createPayment(ckoPaymentRequest);

    // TODO: Update payment and manage errors

    const result = this.processStoredPaymentConverter.convertResponse({
      responseData: ckoPaymentResponse,
      payment,
    });

    return result;
  }

  public async deleteStoredPaymentMethod(id: string): Promise<void> {
    const customerId = await this.getCustomerIdFromCart();

    const ctPaymentMethod = await this.ctPaymentMethodService.get({
      id,
      customerId,
      paymentInterface: getConfig().getStoredPaymentMethodsPaymentInterface(),
      interfaceAccount: getConfig().getStoredPaymentMethodsInterfaceAccount(),
    });

    try {
      await getCkoApiClient().instruments.deleteInstrument(ctPaymentMethod.token!.value!);
    } catch (error) {
      log.error('Error deleting CKO instrument', {
        error,
        ctPaymentMethodId: ctPaymentMethod.id,
        token: ctPaymentMethod.token?.value,
      });
      throw error;
    }
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
