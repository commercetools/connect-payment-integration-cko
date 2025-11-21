import { CardBuilder } from "../components/payment-methods/card";
import {
  loadCheckoutWebComponents,
  CheckoutWebComponents,
  Component,
  SubmitData,
  CheckoutError,
} from "@checkout.com/checkout-web-components";
import {
  CocoStoredPaymentMethod,
  DropinType,
  EnablerOptions,
  PaymentComponentBuilder,
  PaymentDropinBuilder,
  PaymentEnabler,
  PaymentResult,
  StoredComponentBuilder,
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
import { ACHBuilder } from "../components/payment-methods/ach";
import { StoredCardBuilder } from "../stored/stored-payment-methods/card";

declare global {
  interface ImportMeta {
    env: any;
  }
}

export type StoredPaymentMethodsConfig = {
  isEnabled: boolean;
  storedPaymentMethods: CocoStoredPaymentMethod[];
};

export type BaseOptions = {
  ckoWebComponents: CheckoutWebComponents;
  apiClient: PaymentApi;
  environment: string;
  locale?: string;
  setStorePaymentDetails?: (enabled: boolean) => void;
  storedPaymentMethodsConfig?: StoredPaymentMethodsConfig;
  getPaymentReference: () => string;
  onComplete: (result: PaymentResult) => void;
  onError: (error: any, context?: { paymentReference?: string }) => void;
};

export class CkoPaymentEnabler implements PaymentEnabler {
  setupData: Promise<{ baseOptions: BaseOptions }>;
  private locale: string;
  private ckoWebComponents: CheckoutWebComponents;
  private onComplete: (result: PaymentResult) => void;
  private onError: (error: any, context?: { paymentReference?: string; method?: { type: string } }) => void;
  private apiClient: PaymentApi;
  private initCko: Promise<void>;
  private storedPaymentMethodsConfig: StoredPaymentMethodsConfig;
  private currentPaymentReference: string;
  private storePaymentDetails = false;

  constructor(options: EnablerOptions) {
    this.apiClient = new PaymentApi({ processorUrl: options.processorUrl, sessionId: options.sessionId });
    this.locale = convertToCkoLocale(options.locale || "en-GB");
    this.onComplete = options.onComplete;
    this.onError = options.onError;
    this.initCko = this.initializeCkoComponents();
  }

  private async initializeCkoComponents(): Promise<void> {
    if (this.ckoWebComponents) {
      return;
    }

    const [paymentSession, clientConfig] = await Promise.all([
      this.apiClient.createPaymentSession({ locale: this.locale }),
      this.apiClient.getPaymentConfig(),
    ]);

    const paymentSessionId = paymentSession.id;
    this.currentPaymentReference = paymentSession.paymentReference;

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
            paymentReference: this.currentPaymentReference,
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
            paymentReference: this.currentPaymentReference,
            method: { type: component.type },
          });
        }
      },
      handleSubmit: async (_component: Component, submitData: SubmitData) => {
        const res = await this.apiClient.submitPaymentSession(paymentSessionId, {
          ...submitData,
          paymentReference: this.currentPaymentReference,
          storePaymentMethod: this.storePaymentDetails,
        });

        console.log("Payment Session submitted", res);

        return res;
      },
    });
  }

  async createComponentBuilder(type: string): Promise<PaymentComponentBuilder | never> {
    await this.initCko;

    const supportedMethods = {
      ach: ACHBuilder,
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
      apiClient: this.apiClient,
      locale: this.locale,
      onComplete: this.onComplete,
      onError: this.onError,
      setStorePaymentDetails: this.setStorePaymentDetails,
    });
  }

  async createDropinBuilder(type: DropinType): Promise<PaymentDropinBuilder | never> {
    await this.initCko;

    const supportedMethods = {};

    if (!Object.keys(supportedMethods).includes(type)) {
      throw new Error(
        `Component type not supported: ${type}. Supported types: ${Object.keys(supportedMethods).join(", ")}`
      );
    }

    return new supportedMethods[type]({
      ckoWebComponents: this.ckoWebComponents,
      apiClient: this.apiClient,
      locale: this.locale,
      onComplete: this.onComplete,
      onError: this.onError,
    });
  }

  async createStoredPaymentMethodBuilder(type: string): Promise<StoredComponentBuilder | never> {
    await this.initCko;

    if (!this.storedPaymentMethodsConfig?.isEnabled) {
      throw new Error("Stored payment methods is not enabled and thus cannot be used to build a new component");
    }

    const supportedMethods = {
      card: StoredCardBuilder,
    };

    if (!Object.keys(supportedMethods).includes(type)) {
      throw new Error(
        `Component type not supported: ${type}. Supported types: ${Object.keys(supportedMethods).join(", ")}`
      );
    }

    return new supportedMethods[type]({
      ckoWebComponents: this.ckoWebComponents,
      apiClient: this.apiClient,
      locale: this.locale,
      storedPaymentMethodsConfig: this.storedPaymentMethodsConfig,
      onComplete: this.onComplete,
      onError: this.onError,
      getPaymentReference: () => this.currentPaymentReference,
    });
  }

  async isStoredPaymentMethodsEnabled(): Promise<boolean> {
    return true;
  }

  async getStoredPaymentMethods({ allowedMethodTypes }): Promise<any> {
    try {
      const apiRes = await this.apiClient.getStoredPaymentMethods();
      this.storedPaymentMethodsConfig = {
        isEnabled: true,
        storedPaymentMethods: apiRes.storedPaymentMethods,
      };

      const storedPaymentMethods = this.storedPaymentMethodsConfig.storedPaymentMethods
        .map(({ token, ...storedPaymentMethod }) => storedPaymentMethod)
        .filter((method) => allowedMethodTypes.includes(method.type));

      return { storedPaymentMethods };
    } catch (error) {
      console.error("Error fetching stored payment methods", error);
      this.storedPaymentMethodsConfig = {
        isEnabled: false,
        storedPaymentMethods: [],
      };
      return { storedPaymentMethods: [] };
    }
  }

  setStorePaymentDetails = (enabled: boolean): void => {
    this.storePaymentDetails = enabled;
  };
}
