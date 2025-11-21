import {
  ComponentOptions,
  PaymentComponent,
  PaymentComponentBuilder,
  PaymentMethod,
} from "../../payment-enabler/payment-enabler.ts";
import { BaseComponent } from "../base.ts";
import { BaseOptions } from "../../payment-enabler/cko-payment-enabler.ts";
import { Component } from "@checkout.com/checkout-web-components";

export class ApplePayBuilder implements PaymentComponentBuilder {
  public componentHasSubmit = false;

  constructor(private baseOptions: BaseOptions) {}

  build(config: ComponentOptions): PaymentComponent {
    const cmp = new ApplePay(this.baseOptions, config);
    cmp.init();
    return cmp;
  }
}

export class ApplePay extends BaseComponent {
  private component: Component;

  constructor(baseOptions: BaseOptions, componentOptions: ComponentOptions) {
    super(PaymentMethod.applepay, baseOptions, componentOptions);
  }

  init(): void {
    this.component = this.ckoWebComponents.create("applepay", {});
  }

  async mount(selector: string) {
    const isAvailable = await this.component.isAvailable();
    if (!isAvailable) {
      throw new Error("Apple Pay component is not available");
    }

    this.component.mount(selector);
  }

  async submit(_opts: { storePaymentDetails?: boolean }): Promise<void> {
    this.setStorePaymentDetails?.(false);
    this.component.submit();
  }

  async showValidation() {}

  async isValid() {
    return true;
  }

  async getState() {
    return {};
  }

  async isAvailable(): Promise<boolean> {
    return await this.component.isAvailable();
  }
}
