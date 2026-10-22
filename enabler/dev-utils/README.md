# Demo store: development utilities

The `dev-utils/commercestore` directory has a demo store for development and tests. The demo store is a React app. The connector build does not include these files.

## Files

Demo store pages in `commercestore`:

- `index.html`: checkout page.
- `payments.html`: payment management page.
- `admin.html`: store configuration page for tax rates, shipping methods, and countries.
- `return.html`: page where the shopper returns after a redirect payment.
- `css/store.css`: styles for all pages.
- `tsconfig.json`: TypeScript settings for the demo store.

Source files in `commercestore/src`:

- `checkout.tsx`, `payments.tsx`, `admin.tsx`, and `return.tsx`: entry point of each page.
- `CheckoutApp.tsx`, `PaymentsApp.tsx`, `AdminApp.tsx`, and `ReturnApp.tsx`: root component of each page.
- `api/ct.ts`: commercetools API calls, the session, and the JWT token requests.
- `api/processor.ts`: processor API calls.
- `components`, `hooks`, and `data`: UI components, React hooks, and sample country data.
- `types.ts`: shared types, including the enabler contract.

Shared files in `dev-utils`:

- `method-labels.ts`: display names of the payment methods, shared by the demo store pages.

## Usage

Start the development server in the `enabler` directory:

```bash
npm run dev
```

Open these pages:

- Checkout: `http://localhost:3000/`. The dev server serves `dev-utils/commercestore/index.html` at this address. The enabler has no `index.html` of its own.
- Payment management: `http://localhost:3000/dev-utils/commercestore/payments.html`
- Store configuration: `http://localhost:3000/dev-utils/commercestore/admin.html`

The demo store reads the `VITE_*` variables in `enabler/.env`. See `enabler/.env.template`.

The demo store gets a JWT token from the JWT mock server at `http://localhost:9002/jwt/token`. Start the mock server with `docker compose up jwt-server` in the root directory.

## Not supported

The demo store has no pages for features that the connector does not support. These features are express checkout, recurring orders, and Drop-in. The Drop-in tab appears only if the processor returns Drop-in types.

## Payment interface filter

The payment management page shows only payments with a specific `paymentInterface`. Set it with this variable:

```bash
VITE_PAYMENT_INTERFACE=checkout-cko
```

The default is `checkout-cko`. The filter hides payments from other connectors.

## Build exclusion

The connector build (`npm run build`) uses only `src/main.ts` as its entry. It writes `public/connector-enabler.{es,umd}.js`. The Vite build does not process the files in `dev-utils`, so the connector does not include them.

## Development workflow

1. Create a cart with the Quick Cart or Custom Cart button on the checkout page.
2. Start the checkout and pay with a component or a saved card.
3. Open the payment management page to view payments and run actions, such as capture and refund.
4. Run `npm run build` to build the connector.

Do not use these files in production. The connector does not depend on them.
