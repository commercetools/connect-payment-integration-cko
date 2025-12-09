/**
 * Payment Enabler - Main entry point for payment integration
 *
 * The Payment Enabler provides a unified interface for integrating payment methods
 * into e-commerce applications. It supports:
 *
 * - Individual payment components (card, PayPal, etc.)
 * - Drop-in payment widgets (embedded or hosted)
 * - Stored payment methods (tokenization)
 *
 * @example
 * ```typescript
 * // Initialize the enabler
 * const enabler = new Enabler({
 *   processorUrl: 'https://api.example.com',
 *   sessionId: 'session_123',
 *   locale: 'en-US',
 *   onComplete: ({ isSuccess, paymentReference }) => {
 *     if (isSuccess) {
 *       window.location.href = `/order/${paymentReference}`;
 *     }
 *   },
 *   onError: (error, context) => {
 *     console.error('Payment failed:', error, context);
 *   }
 * });
 *
 * // Create a card payment component
 * const cardBuilder = await enabler.createComponentBuilder('card');
 * const cardComponent = cardBuilder.build({
 *   showPayButton: true,
 *   onPayButtonClick: async () => ({ storePaymentDetails: true })
 * });
 * await cardComponent.mount('#card-container');
 *
 * // Or create a drop-in (all payment methods in one widget)
 * const dropinBuilder = await enabler.createDropinBuilder('embedded');
 * const dropin = dropinBuilder.build({
 *   showPayButton: true,
 *   onDropinReady: async () => console.log('Drop-in ready')
 * });
 * await dropin.mount('#payment-container');
 * ```
 */
export interface PaymentEnabler {
  /**
   * Creates a payment component builder of the specified type.
   *
   * @param type - The payment method type (e.g., 'card', 'paypal', 'googlepay')
   * @returns A promise that resolves to the payment component builder
   * @throws {Error} If the payment method type is not supported or cannot be initialized
   *
   * @example
   * ```typescript
   * const builder = await enabler.createComponentBuilder('card');
   * const component = builder.build({ showPayButton: true });
   * await component.mount('#card-form');
   * ```
   */
  createComponentBuilder: (type: string) => Promise<PaymentComponentBuilder | never>;

  /**
   * Creates a payment drop-in builder of the specified type.
   *
   * Drop-ins provide a pre-built UI with multiple payment methods.
   *
   * @param type - The drop-in type ('embedded' or 'hpp')
   * @returns A promise that resolves to the payment drop-in builder
   * @throws {Error} If the drop-in type is not supported
   *
   * @example
   * ```typescript
   * // Embedded drop-in (renders in page)
   * const builder = await enabler.createDropinBuilder('embedded');
   *
   * // Hosted Payment Page (redirects user)
   * const hppBuilder = await enabler.createDropinBuilder('hpp');
   * ```
   */
  createDropinBuilder: (type: DropinType) => Promise<PaymentDropinBuilder | never>;

  /**
   * Creates a stored payment method builder for saved payment instruments.
   *
   * Used to render and process previously tokenized payment methods.
   *
   * @param type - The stored payment method type (e.g., 'card')
   * @returns A promise that resolves to the stored payment method builder
   * @throws {Error} If the stored payment method type is not supported
   *
   * @example
   * ```typescript
   * const storedMethods = await enabler.getStoredPaymentMethods({
   *   allowedMethodTypes: ['card']
   * });
   *
   * for (const method of storedMethods.storedPaymentMethods) {
   *   const builder = await enabler.createStoredPaymentMethodBuilder('card');
   *   const component = builder.build({
   *     id: method.id,
   *     brands: [method.displayOptions.brand?.key]
   *   });
   *   await component.mount(`#stored-${method.id}`);
   * }
   * ```
   */
  createStoredPaymentMethodBuilder: (type: string) => Promise<StoredComponentBuilder | never>;

  /**
   * Checks if stored payment methods (tokenization) are enabled.
   *
   * The actual value is determined by the payment processor configuration.
   *
   * @returns A promise that resolves to true if tokenization is enabled
   *
   * @example
   * ```typescript
   * if (await enabler.isStoredPaymentMethodsEnabled()) {
   *   // Show "Save for future use" checkbox
   * }
   * ```
   */
  isStoredPaymentMethodsEnabled: () => Promise<boolean>;

  /**
   * Retrieves stored payment methods for the current session/customer.
   *
   * @param allowedMethodTypes - Filter by payment method types (e.g., ['card', 'paypal'])
   * @returns A promise resolving to an object containing the list of stored methods
   *
   * @example
   * ```typescript
   * const { storedPaymentMethods } = await enabler.getStoredPaymentMethods({
   *   allowedMethodTypes: ['card']
   * });
   *
   * console.log(`Found ${storedPaymentMethods?.length ?? 0} saved cards`);
   * ```
   */
  getStoredPaymentMethods: ({ allowedMethodTypes }: { allowedMethodTypes: string[] }) => Promise<{
    storedPaymentMethods?: StoredPaymentMethod[];
  }>;
}

/**
 * Represents the current state of a payment component.
 *
 * Used for displaying payment details in the UI (e.g., card preview).
 */
export type PaymentComponentState = {
  /** Card-specific state (if applicable) */
  card?: {
    /** Last 4 digits of the card number */
    endDigits?: string;

    /** Card brand (e.g., 'visa', 'mastercard', 'amex') */
    brand?: string;

    /** Card expiry date (MM/YY format) */
    expiryDate?: string;
  };
};

/**
 * Represents an individual payment component (card form, PayPal button, etc.).
 *
 * Payment components are modular UI elements for specific payment methods.
 */
export interface PaymentComponent {
  /**
   * Mounts the payment component to the specified DOM selector.
   *
   * @param selector - CSS selector where the component will be rendered (e.g., '#card-form')
   * @throws {Error} If the selector doesn't exist or mounting fails
   *
   * @example
   * ```typescript
   * const component = builder.build({ showPayButton: true });
   * await component.mount('#payment-container');
   * ```
   */
  mount(selector: string): Promise<void>;

  /**
   * Submits the payment using the entered payment details.
   *
   * @param storePaymentDetails - Whether to tokenize this payment method
   * @throws {Error} If validation fails or payment processing errors occur
   *
   * @example
   * ```typescript
   * // Submit and save card
   * await component.submit({ storePaymentDetails: true });
   *
   * // Submit without saving
   * await component.submit({ storePaymentDetails: false });
   * ```
   */
  submit({ storePaymentDetails }: { storePaymentDetails?: boolean }): Promise<void>;

  /**
   * Shows validation errors for the payment component.
   *
   * Highlights invalid fields and displays error messages.
   *
   * @example
   * ```typescript
   * if (!await component.isValid()) {
   *   await component.showValidation();
   * }
   * ```
   */
  showValidation?(): Promise<void>;

  /**
   * Checks if the payment component is in a valid state.
   *
   * @returns true if all required fields are valid, false otherwise
   *
   * @example
   * ```typescript
   * if (await component.isValid()) {
   *   await component.submit();
   * }
   * ```
   */
  isValid?(): Promise<boolean>;

  /**
   * Gets the current state of the payment component.
   *
   * Useful for displaying payment details in the UI.
   *
   * @returns Object containing component state (e.g., card details)
   *
   * @example
   * ```typescript
   * const state = await component.getState();
   * console.log(`Card: ${state.card?.brand} ending in ${state.card?.endDigits}`);
   * ```
   */
  getState?(): Promise<PaymentComponentState>;

  /**
   * Checks if the payment component is available for use.
   *
   * Some payment methods may be conditionally available based on:
   * - Device capabilities (e.g., Apple Pay requires iOS)
   * - User authentication state
   * - Merchant configuration
   *
   * @returns true if the payment method can be used, false otherwise
   *
   * @example
   * ```typescript
   * const applePayComponent = await enabler.createComponentBuilder('applepay');
   * if (await applePayComponent.isAvailable()) {
   *   await applePayComponent.mount('#applepay-button');
   * }
   * ```
   */
  isAvailable?(): Promise<boolean>;
}

/**
 * Represents the interface for building payment components.
 *
 * Builders are used to create configured instances of payment components.
 */
export interface PaymentComponentBuilder {
  /**
   * Indicates whether the component includes a built-in submit button.
   *
   * - true: Component handles submission internally (e.g., PayPal button)
   * - false: You must provide your own submit button and call component.submit()
   */
  componentHasSubmit?: boolean;

  /**
   * Builds a payment component with the specified configuration.
   *
   * @param config - Configuration options for the payment component
   * @returns The configured payment component instance
   *
   * @example
   * ```typescript
   * // Component with built-in pay button
   * const component = builder.build({
   *   showPayButton: true,
   *   onPayButtonClick: async () => ({ storePaymentDetails: true })
   * });
   *
   * // Component without pay button (integrate with your own form)
   * const component = builder.build({ showPayButton: false });
   * ```
   */
  build(config: ComponentOptions): PaymentComponent;
}

/**
 * Configuration options for initializing the Payment Enabler.
 */
export type EnablerOptions = {
  /**
   * URL of the payment processor backend.
   *
   * This is your server that handles payment operations.
   */
  processorUrl: string;

  /**
   * Session ID for the current checkout session.
   *
   * Typically obtained from your backend when starting checkout.
   */
  sessionId: string;

  /**
   * Locale for localized payment UI (e.g., 'en-US', 'es-ES', 'fr-FR').
   *
   * @default 'en-US'
   */
  locale?: string;

  /**
   * Callback invoked when additional user action is required.
   *
   * Examples:
   * - 3D Secure authentication
   * - Biometric verification
   * - Redirect to bank for authorization
   *
   * @returns Promise that resolves when the action is completed
   *
   * @example
   * ```typescript
   * onActionRequired: async () => {
   *   // Show loading spinner
   *   console.log('Waiting for user to complete 3DS...');
   * }
   * ```
   */
  onActionRequired?: () => Promise<void>;

  /**
   * Callback invoked when payment is completed (success or failure).
   *
   * @param result - Payment result with success status and reference
   *
   * @example
   * ```typescript
   * onComplete: ({ isSuccess, paymentReference }) => {
   *   if (isSuccess) {
   *     window.location.href = `/confirmation/${paymentReference}`;
   *   } else {
   *     alert('Payment failed. Please try again.');
   *   }
   * }
   * ```
   */
  onComplete?: (result: PaymentResult) => void;

  /**
   * Callback invoked when an error occurs during payment processing.
   *
   * @param error - The error that occurred
   * @param context - Additional context (payment reference, method type)
   *
   * @example
   * ```typescript
   * onError: (error, context) => {
   *   console.error('Payment error:', error);
   *   if (context?.paymentReference) {
   *     // Log failed payment reference for support
   *     logToSupport(context.paymentReference, error);
   *   }
   * }
   * ```
   */
  onError?: (error: any, context?: { paymentReference?: string; method?: { type?: string } }) => void;
};

/**
 * Supported payment methods.
 *
 * Each enum value corresponds to a payment method that can be used
 * with `createComponentBuilder()`.
 */
export enum PaymentMethod {
  /** ACH bank transfers (US) */
  ach = "ach",

  /** Alma buy now, pay later (France) */
  alma = "alma",

  /** Apple Pay digital wallet */
  applepay = "applepay",

  /** Bizum mobile payments (Spain) */
  bizum = "bizum",

  /** Credit/debit card payments */
  card = "card",

  /** EPS bank transfers (Austria) */
  eps = "eps",

  /** Google Pay digital wallet */
  googlepay = "googlepay",

  /** iDEAL bank transfers (Netherlands) */
  ideal = "ideal",

  /** Klarna buy now, pay later */
  klarna = "klarna",

  /** MB WAY mobile payments (Portugal) */
  mbway = "mbway",

  /** PayPal digital wallet */
  paypal = "paypal",

  /** Przelewy24 bank transfers (Poland) */
  przelewy24 = "p24",

  /** SEPA direct debit (Europe) */
  sepa = "sepa",

  /** TWINT mobile payments (Switzerland) */
  twint = "twint",

  /** Vipps mobile payments (Norway) */
  vipps = "vipps",
}

/**
 * Result of a payment operation.
 *
 * Discriminated union based on `isSuccess` flag.
 */
export type PaymentResult =
  | {
      /** Payment completed successfully */
      isSuccess: true;

      /** Unique payment reference for order tracking */
      paymentReference: string;

      /** Payment method used (if available) */
      method?: { type?: string };
    }
  | {
      /** Payment failed or was cancelled */
      isSuccess: false;

      /** Payment reference (may be undefined if payment never started) */
      paymentReference?: string;

      /** Payment method attempted (if available) */
      method?: { type?: string };
    };

/**
 * Configuration options for a payment component.
 */
export type ComponentOptions = {
  /**
   * Whether to display the component's built-in pay button.
   *
   * Set to false if you want to integrate with your own checkout flow.
   *
   * @default true
   */
  showPayButton?: boolean;

  /**
   * Callback invoked when the pay button is clicked.
   *
   * Use this to:
   * - Validate checkout form
   * - Ask user if they want to save payment method
   * - Show loading state
   *
   * @returns Object indicating whether to store payment details
   *
   * @example
   * ```typescript
   * onPayButtonClick: async () => {
   *   const saveCard = document.querySelector('#save-card').checked;
   *   return { storePaymentDetails: saveCard };
   * }
   * ```
   */
  onPayButtonClick?: () => Promise<{ storePaymentDetails?: boolean }>;
};

/**
 * Represents a stored (tokenized) payment method component.
 *
 * Used for rendering and processing previously saved payment instruments.
 */
export interface StoredComponent {
  /**
   * Submits a payment using this stored payment method.
   *
   * @throws {Error} If the stored method is no longer valid or payment fails
   */
  submit(): Promise<void>;

  /**
   * Mounts the stored payment method UI to the specified selector.
   *
   * @param selector - CSS selector where the component will render
   */
  mount(selector: string): Promise<void>;

  /**
   * Shows validation errors (if any).
   */
  showValidation?(): Promise<void>;

  /**
   * Checks if the stored payment method is still valid.
   *
   * @returns true if the method can be used for payment
   */
  isValid?(): Promise<boolean>;

  /**
   * Checks if this stored payment method is available.
   *
   * May return false if:
   * - Card has expired
   * - Token was revoked
   * - Payment method no longer supported
   *
   * @returns true if the stored method can be used
   */
  isAvailable?(): Promise<boolean>;

  /**
   * Removes (deletes) this stored payment method.
   *
   * This will untokenize the payment instrument.
   */
  remove(): Promise<void>;
}

/**
 * Builder for creating stored payment method components.
 */
export interface StoredComponentBuilder {
  /**
   * Indicates whether the stored component has a built-in submit button.
   */
  componentHasSubmit: boolean;

  /**
   * Builds a stored payment method component.
   *
   * @param config - Configuration including the stored method ID
   * @returns Configured stored payment component
   */
  build(config: StoredComponentOptions): StoredComponent;
}

/**
 * Configuration options for stored payment method components.
 */
export type StoredComponentOptions = {
  /**
   * Whether to show the component's built-in pay button.
   */
  showPayButton?: boolean;

  /**
   * Callback invoked when the pay button is clicked.
   */
  onPayButtonClick?: () => Promise<void>;

  /**
   * Unique identifier of the stored payment method.
   *
   * Obtained from `getStoredPaymentMethods()`.
   */
  id: string;

  /**
   * List of card brands (e.g., ['visa', 'mastercard']).
   *
   * Used to display appropriate card logo.
   */
  brands: string[];
};

/**
 * Base display options for stored payment methods.
 */
type BaseStoredDisplayOptions = {
  /** URL to the payment method logo */
  logoUrl?: string;

  /** Additional display properties */
  [key: string]: unknown;
};

/**
 * Base structure for stored payment methods.
 */
type BaseStoredPaymentMethod = {
  /** Unique identifier for the stored method */
  id: string;

  /** Payment method type (e.g., 'card', 'paypal') */
  type: string;

  /** ISO 8601 timestamp when method was stored */
  createdAt: string;

  /** Whether this is the customer's default payment method */
  isDefault: boolean;

  /** Display information for UI rendering */
  displayOptions: BaseStoredDisplayOptions;
};

/**
 * Stored card payment method with card-specific display options.
 */
type StoredCardPaymentMethod = BaseStoredPaymentMethod & {
  type: "card";
  displayOptions: BaseStoredDisplayOptions & {
    /** Last 4 digits of the card */
    endDigits?: string;

    /** Card brand information */
    brand?: {
      /** Brand key (e.g., 'visa', 'mc', 'amex') */
      key: string;
    };

    /** Card expiry month (1-12) */
    expiryMonth?: number;

    /** Card expiry year (e.g., 2025) */
    expiryYear?: number;
  };
};

/**
 * Union of all stored payment method types.
 *
 * @example
 * ```typescript
 * const methods = await enabler.getStoredPaymentMethods({
 *   allowedMethodTypes: ['card']
 * });
 *
 * for (const method of methods.storedPaymentMethods ?? []) {
 *   if (method.type === 'card') {
 *     console.log(`Card ending in ${method.displayOptions.endDigits}`);
 *   }
 * }
 * ```
 */
export type StoredPaymentMethod = BaseStoredPaymentMethod | StoredCardPaymentMethod;

/**
 * CommerceTools-specific stored payment method with token.
 *
 * Extends base stored method with platform-specific token field.
 */
export type CocoStoredPaymentMethod = StoredPaymentMethod & {
  /** Payment token for CommerceTools platform */
  token?: string;
};

/**
 * Drop-in widget types.
 *
 * Drop-ins provide pre-built UIs with multiple payment methods.
 */
export enum DropinType {
  /**
   * Embedded drop-in - Renders directly in your page.
   *
   * Provides full control over styling and layout.
   */
  embedded = "embedded",

  /**
   * Hosted Payment Page (HPP) - Redirects user to payment provider's page.
   *
   * Fully PCI-compliant, no sensitive data on your server.
   */
  hpp = "hpp",
}

/**
 * Represents a drop-in payment component.
 *
 * Drop-ins bundle multiple payment methods into a single UI widget.
 */
export interface DropinComponent {
  /**
   * Submits the payment using the selected method in the drop-in.
   *
   * @throws {Error} If no payment method is selected or payment fails
   */
  submit(): Promise<void>;

  /**
   * Mounts the drop-in widget to the specified DOM selector.
   *
   * @param selector - CSS selector where the drop-in will render
   */
  mount(selector: string): Promise<void>;
}

/**
 * Configuration options for drop-in components.
 */
export type DropinOptions = {
  /**
   * Whether to display the drop-in's built-in pay button.
   *
   * @default true
   */
  showPayButton?: boolean;

  /**
   * Callback invoked when the drop-in UI is fully loaded.
   *
   * @example
   * ```typescript
   * onDropinReady: async () => {
   *   console.log('Drop-in loaded, showing available payment methods');
   * }
   * ```
   */
  onDropinReady?: () => Promise<void>;

  /**
   * Callback invoked when the pay button is clicked.
   *
   * @example
   * ```typescript
   * onPayButtonClick: async () => {
   *   if (!termsAccepted) {
   *     alert('Please accept terms and conditions');
   *     throw new Error('Terms not accepted');
   *   }
   * }
   * ```
   */
  onPayButtonClick?: () => Promise<void>;
};

/**
 * Builder for creating drop-in payment widgets.
 */
export interface PaymentDropinBuilder {
  /**
   * Indicates whether the drop-in has a built-in submit button.
   */
  dropinHasSubmit: boolean;

  /**
   * Builds a drop-in component with the specified configuration.
   *
   * @param config - Drop-in configuration options
   * @returns Configured drop-in component
   */
  build(config: DropinOptions): DropinComponent;
}
