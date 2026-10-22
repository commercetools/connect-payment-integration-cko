/**
 * Payment method types recognized by the dev-utils UI, keyed by the type value the enabler and
 * the processor use. These get their own display tag instead of (or alongside) a card brand badge,
 * since not all of them are card-backed (wallets like Google Pay and Apple Pay are; Klarna is not).
 * Shared so every place that needs this stays in sync from a single source.
 */
export const METHOD_LABELS: Record<string, { label: string }> = {
  ach: { label: 'ACH' },
  alma: { label: 'Alma' },
  applepay: { label: 'Apple Pay' },
  bizum: { label: 'Bizum' },
  eps: { label: 'EPS' },
  googlepay: { label: 'G Pay' },
  ideal: { label: 'iDEAL' },
  klarna: { label: 'Klarna' },
  mbway: { label: 'MB WAY' },
  paypal: { label: 'PayPal' },
  przelewy24: { label: 'Przelewy24' },
  sepa: { label: 'SEPA Direct Debit' },
  vipps: { label: 'Vipps' },
};

export const METHODS_WITH_NO_CARDS: string[] = [
  'ach',
  'alma',
  'bizum',
  'eps',
  'ideal',
  'klarna',
  'mbway',
  'paypal',
  'przelewy24',
  'sepa',
  'vipps',
];
