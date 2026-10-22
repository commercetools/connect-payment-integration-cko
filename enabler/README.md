# Connector Enabler

Frontend module for the Checkout.com payment connector. Provides a JavaScript library that integrates [Checkout.com Flow](https://www.checkout.com/docs/payments/accept-payments/accept-a-payment-on-your-website/get-started-with-flow) web components into your checkout experience.

## Overview

The enabler wraps the Checkout.com Flow library. It provides these payment components:

- Cards, with hosted payment fields that Checkout.com renders.
- Digital wallets: Apple Pay and Google Pay.
- Alternative payment methods: ACH, Alma, Bizum, EPS, iDEAL, Klarna, MB WAY, PayPal, Przelewy24, SEPA, and Vipps.
- Stored payment methods: the enabler can show and use payment methods that the customer saved earlier.

You control when and how the payment components load in your checkout flow. Checkout.com collects and tokenizes the sensitive payment data.

Express checkout is not supported. The `createExpressBuilder` function throws an error. The `GET /operations/payment-components` endpoint of the processor returns `express: []`.

## Considerations for Apple Pay and Google Pay

### Apple Pay requirements

To use Apple Pay, make sure that these conditions are true:

1. You registered your domain with Checkout.com in the Checkout.com dashboard. Checkout.com does the Apple Pay domain verification. For details, see the [Apple Pay documentation of Checkout.com](https://www.checkout.com/docs/payments/payment-methods/wallets/apple-pay).
2. Apple Pay is enabled for your Checkout.com account, and your merchant settings list Apple Pay as a payment method.
3. Every web page with an Apple Pay button uses HTTPS.

To test Apple Pay, use one of these devices:

- An iOS device with iOS 11.3 or later.
- A Mac with macOS 11.3 or later and Safari.

The device must have an active card in Apple Wallet. For sandbox tests, add a test card to the device.

### Google Pay requirements

To use Google Pay, make sure that Google Pay is enabled for your Checkout.com account. Make sure that your merchant settings list Google Pay as a payment method. Checkout.com manages the domain validation for Google Pay, so you do not need to do it.

To test Google Pay, use Chrome on a device that supports Google Pay. Add a card to your Google Pay account. For sandbox tests, use a Google account with test cards.

## Getting started

Run these commands in the `enabler` directory. The enabler needs Node 24 (see `.nvmrc` in the root directory).

Install the dependencies:

```bash
npm install
```

Create the `.env` file from the template and enter your values:

```bash
cp .env.template .env
```

Build the application. The command writes the library to the `public` directory:

```bash
npm run build
```

The build creates `public/connector-enabler.es.js` and `public/connector-enabler.umd.js`.

Start the development server. The development site is at http://localhost:3000/ and opens the demo store in `dev-utils/commercestore`:

```bash
npm run dev
```

Run the tests with vitest:

```bash
npm test
npm run test:watch
```

The enabler has no lint script.

## How to import and use the enabler

The enabler is a JavaScript bundle. A checkout page loads the bundle, creates an `Enabler` object, and mounts payment components. A component is one payment form or button, such as a card form.

### Build output

Run `npm run build` in the `enabler` directory. The command writes two files to the `public` directory:

- `connector-enabler.es.js` is an ES module. An ES module is the standard JavaScript module format.
- `connector-enabler.umd.js` is a UMD script. A UMD script works in a plain script tag and sets the global object `Connector`.

Both files export the `Enabler` class. In the UMD script, use `Connector.Enabler`.

The `connect.yaml` file deploys the `public` directory as the `enabler` asset. Connect gives the asset a public URL. The commercetools checkout loads the bundle from this URL. Your own page can load the same URL.

At run time, the bundle loads the Checkout.com web components script from `https://checkout-web-components.checkout.com/index.js`. Make sure the page can reach this host.

### Get a session ID

The enabler needs a session ID. A session is a commercetools object that links a cart to the payment. The commercetools checkout creates the session for you. On your own page, your backend must create it.

To create a session, send `POST {session URL}/{project key}/sessions`. Put the cart in `cart.cartRef.id`. Put these values in `metadata`:

- `processorUrl`: the URL of the processor.
- `checkoutTransactionItemId`: a unique ID for this payment attempt.
- `allowedPaymentMethods`: the list of payment method types that the shopper can use.
- `merchantReturnUrl`: the page where the shopper returns after a redirect payment.

The file `dev-utils/commercestore/src/api/ct.ts` has a working example in the function `getSessionId`.

### Create the enabler

Create one `Enabler` object for each session. The constructor takes an `EnablerOptions` object:

- `processorUrl`: the URL of the processor. This option is required.
- `sessionId`: the session ID. This option is required.
- `locale`: the language of the payment forms. The default is `en-GB`. The enabler maps a locale that Checkout.com does not support to the closest match.
- `onComplete`: a function that the enabler calls when a payment ends. It receives `isSuccess`, `paymentReference`, and `method`.
- `onError`: a function that the enabler calls when a payment fails. It receives the error and a context object with `paymentReference`.
- `countryCode` and `onActionRequired`: the type accepts both options. The current code does not use them.

### Mount a component

Call `createComponentBuilder` with a payment method type, such as `card`. The processor lists the available types in `GET /operations/payment-components`. The call returns a builder. A builder creates configured components.

Check the `componentHasSubmit` property of the builder. If the value is `true`, you supply the pay button. Call `build` with `showPayButton: false` and add your own button. If the value is `false`, the component draws its own pay button. Call `build` with `showPayButton: true`.

Call `mount` with a CSS selector, not a DOM element. A CSS selector is a text pattern that finds an element, such as `#card-container`.

This example mounts a card form and pays with your own button:

```html
<div id="card-container"></div>
<button id="pay-button">Pay now</button>

<script type="module">
  import { Enabler } from "https://YOUR-ENABLER-URL/connector-enabler.es.js";

  const enabler = new Enabler({
    processorUrl: "https://YOUR-PROCESSOR-URL",
    sessionId: "YOUR-SESSION-ID",
    locale: "en-GB",
    onComplete: ({ isSuccess, paymentReference }) => {
      console.log(isSuccess ? "Paid" : "Not paid", paymentReference);
    },
    onError: (error, context) => {
      console.error(error, context);
    },
  });

  const builder = await enabler.createComponentBuilder("card");
  const component = builder.build({ showPayButton: false });
  await component.mount("#card-container");

  document.getElementById("pay-button").addEventListener("click", async () => {
    if (!(await component.isValid())) return;
    await component.submit({ storePaymentDetails: false });
  });
</script>
```

Before you mount a wallet, call `isAvailable` on the component. The method returns `false` if the device or the account does not support the wallet.

### Save a payment method

If the processor allows stored payment methods, `isStoredPaymentMethodsEnabled` returns `true`. Then you can save a new card. Call `enabler.setStorePaymentDetails(true)` before the payment. Or pass `storePaymentDetails: true` to `submit`.

### Pay with a stored payment method

Call `getStoredPaymentMethods` to list the saved methods. Pass the types that you want in `allowedMethodTypes`. Only the type `card` is supported. Then call `createStoredPaymentMethodBuilder("card")` and `build` with the `id` and `brands` of a saved method:

```js
if (await enabler.isStoredPaymentMethodsEnabled()) {
  const { storedPaymentMethods } = await enabler.getStoredPaymentMethods({
    allowedMethodTypes: ["card"],
  });
  const method = storedPaymentMethods[0];
  const storedBuilder = await enabler.createStoredPaymentMethodBuilder(method.type);
  const stored = storedBuilder.build({
    id: method.id,
    brands: [method.displayOptions.brand.key],
    showPayButton: false,
  });
  await stored.submit();
}
```

A stored component has no form, so `mount` does nothing. Call `submit` to pay. Call `remove` to delete the saved method.

### Drop-in

The `createDropinBuilder` function exists in the contract. The connector has no drop-in yet, so the function throws an error. The processor returns an empty `dropins` list.

### Express checkout

Express checkout is not supported. The `createExpressBuilder` function throws an error.

### Redirect payments

Some payments send the shopper to another page, such as 3D Secure or a bank. After the shopper returns, the processor redirects to your `merchantReturnUrl`. The URL has the query parameters `paymentReference` and `success`. Use `paymentReference` to read the payment in commercetools.

### Test with the demo store

The dev server at `http://localhost:3000/` serves the demo store from `dev-utils/commercestore`. The demo store uses all the calls in this guide. See `dev-utils/README.md`.
