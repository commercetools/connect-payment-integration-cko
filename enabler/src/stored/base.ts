import {
  StoredComponentOptions,
  StoredComponent,
  StoredComponentBuilder,
  PaymentMethod,
  CocoStoredPaymentMethod,
  PaymentResult,
} from "../payment-enabler/payment-enabler";
import { PaymentApi } from "../api/api.client";
import { BaseOptions, StoredPaymentMethodsConfig } from "../payment-enabler/cko-payment-enabler";

/**
 * Base Web Component
 */
export abstract class BaseStoredComponentBuilder implements StoredComponentBuilder {
  public componentHasSubmit = true;

  protected paymentMethod: PaymentMethod;
  protected storedPaymentMethodsConfig: StoredPaymentMethodsConfig;
  protected apiClient: PaymentApi;
  protected onComplete: (result: PaymentResult) => void;
  protected onError: (error: any, context?: { paymentReference?: string }) => void;
  protected getPaymentReference: () => string;

  constructor(paymentMethod: PaymentMethod, baseOptions: BaseOptions) {
    this.paymentMethod = paymentMethod;
    this.apiClient = baseOptions.apiClient;
    this.storedPaymentMethodsConfig = baseOptions.storedPaymentMethodsConfig;
    this.getPaymentReference = baseOptions.getPaymentReference;
    this.onComplete = baseOptions.onComplete;
    this.onError = baseOptions.onError;
  }

  abstract build(config: StoredComponentOptions): StoredComponent;
}

export abstract class DefaultStoredComponent implements StoredComponent {
  protected paymentMethod: PaymentMethod;
  protected apiClient: PaymentApi;
  protected componentOptions: StoredComponentOptions;
  protected storedPaymentMethodsConfig: StoredPaymentMethodsConfig;
  protected usedCocoStoredPaymentMethod: CocoStoredPaymentMethod;
  protected onComplete: (result: PaymentResult) => void;
  protected onError: (error: any, context?: { paymentReference?: string }) => void;
  protected getPaymentReference: () => string;

  constructor(opts: {
    paymentMethod: PaymentMethod;
    apiClient: PaymentApi;
    componentOptions: StoredComponentOptions;
    storedPaymentMethodsConfig: StoredPaymentMethodsConfig;
    onComplete: (result: PaymentResult) => void;
    onError: (error: any, context?: { paymentReference?: string }) => void;
    getPaymentReference: () => string;
  }) {
    this.paymentMethod = opts.paymentMethod;
    this.apiClient = opts.apiClient;
    this.componentOptions = opts.componentOptions;
    this.storedPaymentMethodsConfig = opts.storedPaymentMethodsConfig;
    this.onComplete = opts.onComplete;
    this.onError = opts.onError;
    this.getPaymentReference = opts.getPaymentReference;
  }

  abstract init(options: { id: string }): void;

  abstract submit(): Promise<void>;

  async mount(_selector: string): Promise<void> {}

  async isAvailable(): Promise<boolean> {
    if (!this.storedPaymentMethodsConfig.isEnabled) {
      console.log(`${this.paymentMethod} is not allowed to be used cause the stored payment methods is not enabled`);
      return Promise.resolve(false);
    }

    return Promise.resolve(true);
  }

  async remove(): Promise<void> {
    return this.apiClient.deleteStoredPaymentMethod(this.usedCocoStoredPaymentMethod.id);
  }
}
