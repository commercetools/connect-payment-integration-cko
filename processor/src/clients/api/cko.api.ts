import { PaymentSessionApi } from './payment-session.api';
import { PaymentApi } from './payments.api';

export class CkoApi {
  public paymentSessions: PaymentSessionApi;
  public payments: PaymentApi;

  constructor() {
    this.paymentSessions = new PaymentSessionApi();
    this.payments = new PaymentApi();
  }
}
