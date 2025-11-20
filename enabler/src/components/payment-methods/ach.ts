import {
  ComponentOptions,
  PaymentComponent,
  PaymentComponentBuilder,
  PaymentMethod,
} from "../../payment-enabler/payment-enabler.ts";
import { BaseComponent } from "../base.ts";
import { BaseOptions } from "../../payment-enabler/cko-payment-enabler.ts";
import { Component } from "@checkout.com/checkout-web-components";

export class ACHBuilder implements PaymentComponentBuilder {
  public componentHasSubmit = true;

  constructor(private baseOptions: BaseOptions) {}
  
  build(config: ComponentOptions): PaymentComponent {
    const cmp = new ACH(this.baseOptions, config);
    cmp.init();
    return cmp;
  }
}

export class ACH extends BaseComponent {
  private showPayButton: boolean;
  private component: Component;

  constructor(baseOptions: BaseOptions, componentOptions: ComponentOptions) {
    super(PaymentMethod.ach, baseOptions, componentOptions);
    this.showPayButton = componentOptions?.showPayButton ?? false;
  }

  init(): void {
    this.component = this.ckoWebComponents.create("flow", {
      showPayButton: this.showPayButton,
    });
  }


  async mount(selector: string) {
    const isAvailable = await this.component.isAvailable();
    if (!isAvailable) {
      throw new Error("ACH component is not available");
    }

    this.component.mount(selector);
  }

  async submit() {
    await this.component.submit();
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
