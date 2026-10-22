import { CardBuilder } from "../components/payment-methods/card";
import {
  loadCheckoutWebComponents,
  CheckoutWebComponents,
  Component,
  SubmitData,
  CheckoutError,
  HandleClickResponse,
} from "@checkout.com/checkout-web-components";
import {
  CocoStoredPaymentMethod,
  DropinType,
  EnablerOptions,
  PaymentComponentBuilder,
  PaymentDropinBuilder,
  PaymentEnabler,
  PaymentExpressBuilder,
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
import { VippsBuilder } from "../components/payment-methods/vipps";

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
  private initStoredPaymentMethodsConfig: Promise<void>;
  private storedPaymentMethodsConfig: StoredPaymentMethodsConfig;
  private currentPaymentReference: string;
  private storePaymentDetails = false;

  constructor(options: EnablerOptions) {
    this.apiClient = new PaymentApi({ processorUrl: options.processorUrl, sessionId: options.sessionId });
    this.locale = convertToCkoLocale(options.locale || "en-GB");
    this.onComplete = options.onComplete;
    this.onError = options.onError;
    this.initCko = this.initializeCkoComponents();
    this.initStoredPaymentMethodsConfig = this.initializeStoredPaymentMethodsConfig();
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
        console.log("CKO Web Components are ready");
      },
      onPaymentCompleted: (component, paymentResponse) => {
        console.log("Payment completed", {
          component: component.type,
          status: paymentResponse.status,
          paymentId: paymentResponse.id,
          paymentReference: this.currentPaymentReference,
        });

        if (this.onComplete) {
          this.onComplete({
            paymentReference: this.currentPaymentReference,
            isSuccess: paymentResponse.status === "Approved",
            method: { type: component.type },
          });
        }
      },
      onChange: (component) => {
        console.log(`Payment component changed`, {
          component: component.type,
          isValid: component.isValid(),
        });
      },
      onError: (component: Component, error: CheckoutError) => {
        console.error("Payment component error", {
          component: component.type,
          error,
          paymentReference: this.currentPaymentReference,
        });

        if (this.onError) {
          this.onError(error, {
            paymentReference: this.currentPaymentReference,
            method: { type: component.type },
          });
        }
      },
      handleClick: async (component: Component): Promise<HandleClickResponse | void> => {
        if (component["onPayButtonClick"]) {
          try {
            await component["onPayButtonClick"]();
          } catch (_error) {
            return {
              continue: false,
            };
          }
        }

        return {
          continue: true,
        };
      },

      handleSubmit: async (component: Component, submitData: SubmitData) => {
        if (!component.isValid()) {
          console.error("Cannot submit - component validation failed", {
            component: component.type,
          });
          throw new Error(`Cannot submit ${component.type} component as it is not valid`);
        }

        const res = await this.apiClient.submitPaymentSession(paymentSessionId, {
          ...submitData,
          paymentReference: this.currentPaymentReference,
          storePaymentMethod: this.storePaymentDetails,
        });

        console.log("Payment session submitted successfully", {
          component: component.type,
          sessionId: paymentSessionId,
          paymentReference: this.currentPaymentReference,
        });

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
      vipps: VippsBuilder,
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

  async createExpressBuilder(_type: string): Promise<PaymentExpressBuilder | never> {
    throw new Error("Express checkout is not supported by the Checkout.com connector");
  }

  async isStoredPaymentMethodsEnabled(): Promise<boolean> {
    await this.initStoredPaymentMethodsConfig;
    return this.storedPaymentMethodsConfig?.isEnabled;
  }

  async getStoredPaymentMethods({ allowedMethodTypes }): Promise<any> {
    await this.initStoredPaymentMethodsConfig;

    if (!this.storedPaymentMethodsConfig?.isEnabled) {
      return { storedPaymentMethods: [] };
    }

    if (allowedMethodTypes && allowedMethodTypes.length > 0) {
      return {
        storedPaymentMethods: this.storedPaymentMethodsConfig.storedPaymentMethods.filter((method) =>
          allowedMethodTypes.includes(method.type)
        ),
      };
    }

    return { storedPaymentMethods: this.storedPaymentMethodsConfig.storedPaymentMethods };
  }

  setStorePaymentDetails = (enabled: boolean): void => {
    this.storePaymentDetails = enabled;
  };

  private async initializeStoredPaymentMethodsConfig(): Promise<void> {
    try {
      const apiRes = await this.apiClient.getStoredPaymentMethods();
      this.storedPaymentMethodsConfig = {
        isEnabled: true,
        storedPaymentMethods: apiRes.storedPaymentMethods,
      };
    } catch (error) {
      console.warn("Failed to load stored payment methods, disabling feature", error);
      this.storedPaymentMethodsConfig = {
        isEnabled: false,
        storedPaymentMethods: [],
      };
    }
  }
}
