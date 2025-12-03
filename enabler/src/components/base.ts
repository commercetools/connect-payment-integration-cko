import {
  ComponentOptions,
  PaymentComponent,
  PaymentComponentState,
  PaymentMethod,
  PaymentResult,
} from "../payment-enabler/payment-enabler";
import { BaseOptions } from "../payment-enabler/cko-payment-enabler";
import { CheckoutWebComponents } from "@checkout.com/checkout-web-components";

export type ElementOptions = {
  paymentMethod: PaymentMethod;
};

/**
 * Base Web Component
 */
export abstract class BaseComponent implements PaymentComponent {
  protected paymentMethod: ElementOptions["paymentMethod"];
  protected ckoWebComponents: CheckoutWebComponents;
  protected environment: BaseOptions["environment"];
  protected onComplete: (result: PaymentResult) => void;
  protected onError: (error: any, context?: { paymentReference?: string }) => void;
  protected setStorePaymentDetails?: (enabled: boolean) => void;
  protected componentOptions: ComponentOptions;

  constructor(paymentMethod: PaymentMethod, baseOptions: BaseOptions, componentOptions: ComponentOptions) {
    this.paymentMethod = paymentMethod;
    this.ckoWebComponents = baseOptions.ckoWebComponents;
    this.environment = baseOptions.environment;
    this.onComplete = baseOptions.onComplete;
    this.onError = baseOptions.onError;
    this.componentOptions = componentOptions;
    this.setStorePaymentDetails = baseOptions.setStorePaymentDetails;
  }

  abstract submit(opts: { storePaymentDetails?: boolean }): Promise<void>;

  abstract mount(selector: string): Promise<void>;

  showValidation?(): Promise<void>;
  isValid?(): Promise<boolean>;
  getState?(): Promise<PaymentComponentState>;
  isAvailable?(): Promise<boolean>;
}
