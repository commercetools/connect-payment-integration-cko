import { PaymentApi } from "../../api/api.client";
import { BaseOptions, StoredPaymentMethodsConfig } from "../../payment-enabler/cko-payment-enabler";
import {
  PaymentMethod,
  PaymentResult,
  StoredComponent,
  StoredComponentOptions,
} from "../../payment-enabler/payment-enabler";
import { BaseStoredComponentBuilder, DefaultStoredComponent } from "../base";

/**
 * Stored Credit card component
 */
export class StoredCardBuilder extends BaseStoredComponentBuilder {
  constructor(baseOptions: BaseOptions) {
    super(PaymentMethod.card, baseOptions);
  }

  build(config: StoredComponentOptions): StoredComponent {
    const cardComponent = new StoredCardComponent({
      paymentMethod: this.paymentMethod,
      apiClient: this.apiClient,
      componentOptions: config,
      storedPaymentMethodsConfig: this.storedPaymentMethodsConfig,
      onComplete: this.onComplete,
      onError: this.onError,
      getPaymentReference: this.getPaymentReference,
    });

    cardComponent.init({
      id: config.id,
    });

    return cardComponent;
  }
}

export class StoredCardComponent extends DefaultStoredComponent {
  constructor(opts: {
    paymentMethod: PaymentMethod;
    apiClient: PaymentApi;
    componentOptions: StoredComponentOptions;
    storedPaymentMethodsConfig: StoredPaymentMethodsConfig;
    onComplete: (result: PaymentResult) => void;
    onError: (error: any, context?: { paymentReference?: string }) => void;
    getPaymentReference: () => string;
  }) {
    super(opts);
  }

  init({ id }: { id: string }): void {
    const cocoStoredPaymentMethod = this.storedPaymentMethodsConfig.storedPaymentMethods.find((spm) => {
      return spm.id === id;
    });

    if (!cocoStoredPaymentMethod) {
      throw new Error(
        `Received stored payment method id "${id} however that is not an available id to use. Available ones are: [${this.storedPaymentMethodsConfig.storedPaymentMethods
          .map((spm) => spm.id)
          .join(", ")}]"`
      );
    }

    this.usedCocoStoredPaymentMethod = cocoStoredPaymentMethod;
  }

  async submit(): Promise<void> {
    try {
      const result = await this.apiClient.payWithStoredMethod(this.usedCocoStoredPaymentMethod.id, {
        paymentReference: this.getPaymentReference(),
      });

      // Handle 3DS authentication if required
      if (result.status === "Pending" && result.action?.url) {
        // Save payment state before redirecting
        sessionStorage.setItem(
          "pending3DS",
          JSON.stringify({
            paymentReference: this.getPaymentReference(),
            paymentMethod: this.paymentMethod,
            timestamp: Date.now(),
          })
        );

        // Redirect to 3DS challenge page
        window.location.href = result.action.url;
        return;
      }

      // Handle successful authorization
      this.onComplete({
        isSuccess: result.status === "Authorized",
        paymentReference: this.getPaymentReference(),
        method: { type: this.paymentMethod },
      });
    } catch (error) {
      this.onError(error, { paymentReference: this.getPaymentReference() });
    }
  }

  remove(): Promise<void> {
    return super.remove();
  }
}