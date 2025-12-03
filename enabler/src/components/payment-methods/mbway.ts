import {
  ComponentOptions,
  PaymentComponent,
  PaymentComponentBuilder,
  PaymentMethod,
} from "../../payment-enabler/payment-enabler.ts";
import { BaseComponent } from "../base.ts";
import { BaseOptions } from "../../payment-enabler/cko-payment-enabler.ts";
import { Component } from "@checkout.com/checkout-web-components";

export class MBWayBuilder implements PaymentComponentBuilder {
  public componentHasSubmit = true;

  constructor(private baseOptions: BaseOptions) {}

  build(config: ComponentOptions): PaymentComponent {
    const cmp = new MBWay(this.baseOptions, config);
    cmp.init();
    return cmp;
  }
}

export class MBWay extends BaseComponent {
  private showPayButton: boolean;
  private component: Component;

  constructor(baseOptions: BaseOptions, componentOptions: ComponentOptions) {
    super(PaymentMethod.mbway, baseOptions, componentOptions);
    this.showPayButton = componentOptions?.showPayButton ?? false;
  }

  init(): void {
    this.component = this.ckoWebComponents.create("mbway", {
      showPayButton: this.showPayButton,
    });
  }

  async mount(selector: string) {
    const isAvailable = await this.component.isAvailable();
    if (!isAvailable) {
      throw new Error("MBWay component is not available");
    }

    this.component.mount(selector);
  }

  async submit(_opts: { storePaymentDetails?: boolean }): Promise<void> {
    this.setStorePaymentDetails?.(false);
    this.component.submit();
  }

  async showValidation() {}

  async isValid(): Promise<boolean> {
    return this.component.isValid();
  }

  async getState() {
    return {};
  }

  async isAvailable(): Promise<boolean> {
    return await this.component.isAvailable();
  }
}
