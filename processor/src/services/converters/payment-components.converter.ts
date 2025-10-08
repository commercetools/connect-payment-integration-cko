import { SupportedPaymentComponentsSchemaDTO } from '../../dtos/operations/payment-componets.dto';

export class PaymentComponentsConverter {
  public convertResponse(): SupportedPaymentComponentsSchemaDTO {
    return {
      dropins: [],
      components: [
        // {
        //   type: 'applepay',
        // },
        {
          type: 'card',
        },
        // {
        //   type: 'ideal',
        // },
        {
          type: 'googlepay',
        },
        {
          type: 'paypal',
        },
        {
          type: 'sepa',
        },
      ],
    };
  }
}
