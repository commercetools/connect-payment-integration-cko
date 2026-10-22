// ---- Global window env vars ----

declare global {
  interface Window {
    __VITE_CTP_PROJECT_KEY__: string;
    __VITE_CTP_API_URL__: string;
    __VITE_CTP_AUTH_URL__: string;
    __VITE_CTP_SESSION_URL__: string;
    __VITE_CTP_CLIENT_ID__: string;
    __VITE_CTP_CLIENT_SECRET__: string;
    __VITE_PROCESSOR_URL__: string;
    __VITE_PAYMENT_INTERFACE__: string | undefined;
  }
}

// ---- Domain types ----

export interface Country {
  code: string;
  name: string;
  currency: string;
  taxRate: number;
  taxName: string;
}

export interface Address {
  firstName: string;
  lastName: string;
  streetName: string;
  streetNumber: string;
  city: string;
  postalCode: string;
  country?: string;
  region?: string;
  phone?: string;
  email?: string;
}

export interface LineItem {
  name: string;
  quantity: number;
  centAmount: number;
}

// ---- commercetools API types (minimal shapes we actually use) ----

export interface CtMoney {
  currencyCode: string;
  centAmount: number;
  fractionDigits?: number;
}

export interface CtTransaction {
  id: string;
  type: 'Authorization' | 'CancelAuthorization' | 'Charge' | 'Refund' | 'Chargeback';
  state: 'Initial' | 'Pending' | 'Success' | 'Failure';
  amount?: CtMoney;
  timestamp?: string;
}

export interface CtPayment {
  id: string;
  version: number;
  createdAt: string;
  amountPlanned: CtMoney;
  paymentMethodInfo?: { paymentInterface?: string; method?: string };
  transactions?: CtTransaction[];
}

export interface CtCart {
  id: string;
  version: number;
  currency: string;
  country?: string;
  customerId?: string;
  origin?: string;
  totalPrice?: CtMoney;
  taxedPrice?: { totalGross: CtMoney };
  shippingInfo?: { price: CtMoney };
}

export interface CtCustomer {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface CtTaxCategoryStatus {
  exists: boolean;
  id?: string;
  version?: number;
  rates: Record<string, number>;
}

export interface CtShippingMethodStatus {
  exists: boolean;
  currencies: string[];
}

// ---- Enabler types ----

export interface PaymentMethod {
  type: string;
  label?: string;
  unavailable?: boolean;
}

export interface StoredPaymentMethod {
  id: string;
  type: string;
  token?: string;
  isDefault?: boolean;
  createdAt?: string;
  displayOptions?: {
    endDigits?: string;
    brand?: { key: string };
    expiryMonth?: number;
    expiryYear?: number;
  };
}

export interface CheckoutResult {
  isSuccess: boolean;
  paymentReference?: string;
  message?: string;
}

export interface EnablerConfig {
  processorUrl: string;
  sessionId: string;
  locale?: string;
  countryCode?: string;
  onActionRequired?: () => Promise<void>;
  onComplete?: (result: CheckoutResult) => void;
  onError?: (err: Error, ctx?: unknown) => void;
}

/** Mounting takes a CSS selector, not a DOM element. */
export interface MountableComponent {
  mount(selector: string): Promise<void>;
  submit?(opts?: { storePaymentDetails?: boolean }): Promise<void>;
  remove?(): Promise<void>;
  isValid?(): Promise<boolean>;
  showValidation?(): Promise<void>;
  isAvailable?(): Promise<boolean>;
}

/** `componentHasSubmit` is false when the component renders its own pay button (wallets). */
interface ComponentBuilder {
  componentHasSubmit?: boolean;
  build(config?: Record<string, unknown>): MountableComponent;
}

export interface DropinBuildOptions {
  showPayButton?: boolean;
  onDropinReady?: () => Promise<void>;
  onPayButtonClick?: () => Promise<void>;
}

interface DropinBuilder {
  dropinHasSubmit: boolean;
  build(config: DropinBuildOptions): MountableComponent;
}

export interface EnablerInstance {
  createComponentBuilder(type: string): Promise<ComponentBuilder>;
  createDropinBuilder(type: 'embedded' | 'hpp'): Promise<DropinBuilder>;
  createStoredPaymentMethodBuilder(type: string): Promise<ComponentBuilder>;
  isStoredPaymentMethodsEnabled(): Promise<boolean>;
  getStoredPaymentMethods(opts: { allowedMethodTypes: string[] }): Promise<{ storedPaymentMethods?: StoredPaymentMethod[] }>;
  setStorePaymentDetails(enabled: boolean): void;
}

export type EnablerConstructor = new (config: EnablerConfig) => EnablerInstance;

// ---- UI types ----

export interface Toast {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export interface CountryStatus extends Country {
  hasTax: boolean;
  hasShipping: boolean;
  isReady: boolean;
}

export interface PaymentsFilters {
  status: string;
  type: string;
  search: string;
}
