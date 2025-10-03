import { SupportedPaymentComponentsSchemaDTO } from '../../dtos/operations/payment-componets.dto';

export class PaymentComponentsConverter {
  public convertResponse(): SupportedPaymentComponentsSchemaDTO {
    return {
      dropins: [],
      components: [
        {
          type: 'card', 
        },
        {
          type: 'googlepay',
        },
      ],
    };
  }
}
