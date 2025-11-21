export type CkoAddress = {
  country: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip?: string;
};

export enum CkoPaymentStatus {
  APPROVED = 'Approved',
  DECLINED = 'Declined',
  ACTION_REQUIRED = 'Action Required',
}

export type CkoLineItems = {
  name: string;
  quantity: number;
  unit_price: number;
  total_amount?: number;
};

export interface PaymentSessionRequest {
  amount: number;
  currency: string;
  reference?: string;
  metadata?: Record<string, unknown>;
  description?: string;
  success_url: string;
  failure_url: string;
  processing_channel_id: string;
  customer?: {
    id?: string;
    email?: string;
    name?: string;
    phone?: {
      country_code?: string;
      number: string;
    };
    tax_number?: string;
  };
  billing: {
    address: CkoAddress;
    phone?: {
      country_code?: string;
      number: string;
    };
  };
  shipping?: {
    address: CkoAddress;
    phone?: {
      country_code?: string;
      number: string;
    };
  };
  payment_type?: 'Regular' | 'Recurring' | 'Unscheduled' | 'MOTO' | 'Installment';
  billing_descriptor?: {
    name: string;
    city: string;
    reference?: string;
  };
  locale?: string;
  capture: boolean;
  capture_on?: string;
  enabled_payment_methods?: string[];
  disabled_payment_methods?: string[];
  '3ds'?: {
    enabled: boolean;
    [key: string]: unknown;
  };
  integration: {
    external_platform: {
      name: 'Commercetools';
      version: string;
    };
  };
  items?: CkoLineItems[];
  [key: string]: unknown;
}

export interface PaymentSessionResponse {
  id: string;
  payment_session_token: string;
  payment_session_secret: string;
  _links: { self: { href: string } };
  [key: string]: unknown;
}

export type SubmitPaymentSessionRequest = {
  session_data: string;
  payment_type?: 'Regular' | 'Recurring' | 'Unscheduled' | 'MOTO' | 'Installment';
  [key: string]: unknown;
};

export interface SubmitPaymentSessionResponse {
  id: string;
  status: CkoPaymentStatus;
  type: string;
  action?: Record<string, unknown>;
}
