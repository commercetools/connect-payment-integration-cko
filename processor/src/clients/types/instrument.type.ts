export type CkoInstrument = {
  id: string;
  type: string;
  customer?: {
    id: string;
    email?: string;
    name?: string;
    default?: boolean;
    [key: string]: unknown;
  };
  scheme?: string;
  expiry_month?: number;
  expiry_year?: number;
  last4?: string;
  bin?: string;
  card_wallet_type?: string;
  [key: string]: unknown;
};
