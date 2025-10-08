import { CardBuilder } from "../components/payment-methods/card/card";
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
import { GooglePayBuilder } from "../components/payment-methods/card/googlepay";
import { PayPalBuilder } from "../components/payment-methods/card/paypal";
import { SepaBuilder } from "../components/payment-methods/card/sepa";

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

  constructor(options: EnablerOptions) {
    this.setupData = CkoPaymentEnabler._Setup(options);
  }

  private static _Setup = async (options: EnablerOptions): Promise<{ baseOptions: BaseOptions }> => {
    // Fetch SDK config from processor if needed, for example:

    const [sessionResponse, configResponse] = await Promise.all([
      fetch(options.processorUrl + "/payment-sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": options.sessionId,
        },
        body: JSON.stringify({}),
      }),
      fetch(options.processorUrl + "/operations/config", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": options.sessionId,
        },
      }),
    ]);

    const [sessionJson, configJson] = await Promise.all([sessionResponse.json(), configResponse.json()]);
    const paymentSessionId = sessionJson.id;
    const paymentReference = sessionJson.paymentReference;

    const cko = await loadCheckoutWebComponents({
      publicKey: configJson.publicKey,
      environment: configJson.environment,
      locale: options.locale || "en-GB",
      paymentSession: sessionJson,
      onReady: () => {
        console.log("onReady");
      },
      onPaymentCompleted: (component, paymentResponse) => {
        console.info("Create Payment with PaymentId: ", paymentResponse.id);
        if (options.onComplete) {
          options.onComplete({
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
        if (options.onError) {
          options.onError(error, {
            paymentReference,
            method: { type: component.type },
          });
        }
      },
      handleSubmit: async (_component: Component, submitData: SubmitData) => {
        const res = await fetch(options.processorUrl + "/payment-sessions/" + paymentSessionId, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-Id": options.sessionId,
          },
          body: JSON.stringify({
            ...submitData,
            paymentReference,
          }),
        });

        const data = await res.json();

        console.log("Payment Session submitted", data);

        return data;
      },
    });

    return {
      baseOptions: {
        ckoWebComponents: cko,
        environment: configJson.environment,
        sessionId: options.sessionId,
        processorUrl: options.processorUrl,
        onComplete: options.onComplete,
        onError: options.onError,
        locale: options.locale,
      },
    };
  };

  async createComponentBuilder(type: string): Promise<PaymentComponentBuilder | never> {
    const { baseOptions } = await this.setupData;

    const supportedMethods = {
      card: CardBuilder,
      googlepay: GooglePayBuilder,
      paypal: PayPalBuilder,
      sepa: SepaBuilder,
    };

    if (!Object.keys(supportedMethods).includes(type)) {
      throw new Error(
        `Component type not supported: ${type}. Supported types: ${Object.keys(supportedMethods).join(", ")}`
      );
    }

    return new supportedMethods[type](baseOptions);
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
