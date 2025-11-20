import { InstrumentApi } from './instrument.api';
import { PaymentMethodsApi } from './payment-method.api';
import { PaymentSessionApi } from './payment-session.api';
import { PaymentApi } from './payment.api';

export class CkoApi {
  public paymentSessions: PaymentSessionApi;
  public payments: PaymentApi;
  public paymentMethods: PaymentMethodsApi;
  public instruments: InstrumentApi;

  constructor() {
    this.paymentSessions = new PaymentSessionApi();
    this.payments = new PaymentApi();
    this.paymentMethods = new PaymentMethodsApi();
    this.instruments = new InstrumentApi();
  }
}
