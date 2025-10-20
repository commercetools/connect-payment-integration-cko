import { CardBuilder } from "../components/payment-methods/card";
import {
  loadCheckoutWebComponents,
  CheckoutWebComponents,
  Component,
  SubmitData,
  CheckoutError,
} from "@checkout.com/checkout-web-components";
import {
  DropinType,
  EnablerOptions,
  PaymentComponentBuilder,
  PaymentDropinBuilder,
  PaymentEnabler,
  PaymentResult,
} from "./payment-enabler";
import { GooglePayBuilder } from "../components/payment-methods/googlepay";
import { PayPalBuilder } from "../components/payment-methods/paypal";
import { SepaBuilder } from "../components/payment-methods/sepa";
import { convertToCkoLocale } from "../converters/locale.converter";
import { EPSBuilder } from "../components/payment-methods/eps";
import { KlarnaBuilder } from "../components/payment-methods/klarna";
import { BizumBuilder } from "../components/payment-methods/bizum";
import { IdealBuilder } from "../components/payment-methods/ideal";
import { Przelewy24Builder } from "../components/payment-methods/przelewy24";
import { AlmaBuilder } from "../components/payment-methods/alma";
import { ApplePayBuilder } from "../components/payment-methods/applepay";
import { MBWayBuilder } from "../components/payment-methods/mbway";
import { PaymentApi } from "../api/api.client";

declare global {
  interface ImportMeta {
    env: any;
  }
}

export type BaseOptions = {
  ckoWebComponents: CheckoutWebComponents;
  processorUrl: string;
  sessionId: string;
  environment: string;
  locale?: string;
  onComplete: (result: PaymentResult) => void;
  onError: (error: any, context?: { paymentReference?: string }) => void;
};

export class CkoPaymentEnabler implements PaymentEnabler {
  setupData: Promise<{ baseOptions: BaseOptions }>;
  private sessionId: string;
  private processorUrl: string;
  private locale: string;
  private ckoWebComponents: CheckoutWebComponents;
  private onComplete: (result: PaymentResult) => void;
  private onError: (error: any, context?: { paymentReference?: string; method?: { type: string } }) => void;
  private apiClient: PaymentApi;

  constructor(options: EnablerOptions) {
    this.sessionId = options.sessionId;
    this.apiClient = new PaymentApi({ processorUrl: options.processorUrl, sessionId: options.sessionId });
    this.processorUrl = options.processorUrl;
    this.locale = convertToCkoLocale(options.locale || "en-GB");
    this.onComplete = options.onComplete;
    this.onError = options.onError;
  }

  // constructor(options: EnablerOptions) {
  //   this.setupData = CkoPaymentEnabler._Setup(options);
  // }

  private async initializeCkoComponents(): Promise<void> {
    if (this.ckoWebComponents) {
      return;
    }

    const [paymentSession, clientConfig] = await Promise.all([
      this.apiClient.createPaymentSession({ locale: this.locale }),
      this.apiClient.getPaymentConfig(),
    ]);
    const paymentSessionId = paymentSession.id;
    const paymentReference = paymentSession.paymentReference;

    this.ckoWebComponents = await loadCheckoutWebComponents({
      publicKey: clientConfig.publicKey,
      environment: clientConfig.environment,
      locale: this.locale,
      paymentSession,
      onReady: () => {
        console.log("onReady");
      },
      onPaymentCompleted: (component, paymentResponse) => {
        console.info("Create Payment with PaymentId: ", paymentResponse.id);
        if (this.onComplete) {
          this.onComplete({
            paymentReference,
            isSuccess: paymentResponse.status === "Approved",
            method: { type: component.type },
          });
        }
      },
      onChange: (component) => {
        console.log(`onChange() -> isValid: "${component.isValid()}" for "${component.type}"`);
      },
      onError: (component: Component, error: CheckoutError) => {
        console.error("onError", error, "Component", component.type);
        if (this.onError) {
          this.onError(error, {
            paymentReference,
            method: { type: component.type },
          });
        }
      },
      handleSubmit: async (_component: Component, submitData: SubmitData) => {
        const res = await this.apiClient.submitPaymentSession(paymentSessionId, {
          ...submitData,
          paymentReference,
        });

        console.log("Payment Session submitted", res);

        return res;
      },
    });
  }

  async createComponentBuilder(type: string): Promise<PaymentComponentBuilder | never> {
    await this.initializeCkoComponents();

    const supportedMethods = {
      alma: AlmaBuilder,
      applepay: ApplePayBuilder,
      bizum: BizumBuilder,
      card: CardBuilder,
      eps: EPSBuilder,
      googlepay: GooglePayBuilder,
      ideal: IdealBuilder,
      klarna: KlarnaBuilder,
      mbway: MBWayBuilder,
      paypal: PayPalBuilder,
      przelewy24: Przelewy24Builder,
      sepa: SepaBuilder,
    };

    if (!Object.keys(supportedMethods).includes(type)) {
      throw new Error(
        `Component type not supported: ${type}. Supported types: ${Object.keys(supportedMethods).join(", ")}`
      );
    }

    return new supportedMethods[type]({
      ckoWebComponents: this.ckoWebComponents,
      sessionId: this.sessionId,
      processorUrl: this.processorUrl,
      locale: this.locale,
      onComplete: this.onComplete,
      onError: this.onError,
    });
  }

  async createDropinBuilder(type: DropinType): Promise<PaymentDropinBuilder | never> {
    const { baseOptions } = await this.setupData;

    const supportedMethods = {};

    if (!Object.keys(supportedMethods).includes(type)) {
      throw new Error(
        `Component type not supported: ${type}. Supported types: ${Object.keys(supportedMethods).join(", ")}`
      );
    }

    return new supportedMethods[type](baseOptions);
  }
}
