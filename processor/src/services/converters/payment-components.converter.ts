import { SupportedPaymentComponentsSchemaDTO } from '../../dtos/operations/payment-componets.dto';

export class PaymentComponentsConverter {
  public convertResponse(): SupportedPaymentComponentsSchemaDTO {
    return {
      dropins: [],
      components: [
        {
          type: 'ach',
        },
        {
          type: 'alma',
        },
        {
          type: 'applepay',
        },
        {
          type: 'bizum',
        },
        {
          type: 'card',
        },
        {
          type: 'eps',
        },
        {
          type: 'ideal',
        },
        {
          type: 'googlepay',
        },
        {
          type: 'klarna',
        },
        {
          type: 'mbway',
        },
        {
          type: 'paypal',
        },
        {
          type: 'przelewy24',
        },
        {
          type: 'sepa',
        },
      ],
    };
  }
}
