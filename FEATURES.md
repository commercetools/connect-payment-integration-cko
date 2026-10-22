# Connector features

This file lists the features of the Checkout.com connector for commercetools Checkout. Use it as a checklist during handover. A checked box means the feature works in this repository today. An unchecked box means the feature does not exist yet, and the section explains how to build it.

The connector has two parts. The enabler is the browser library that renders the payment forms. The processor is the backend service that talks to Checkout.com and to commercetools.

## Contents

- [Overview](#overview)
- [Payment methods](#payment-methods)
- [Web components and dropin](#web-components-and-dropin)
- [Express checkout](#express-checkout)
- [Tokenization](#tokenization)
- [Recurring orders](#recurring-orders)
- [Payment operations](#payment-operations)
- [Other implemented features](#other-implemented-features)
- [Candidate features beyond commercetools Checkout](#candidate-features-beyond-commercetools-checkout)

## Overview

Status summary:

- [x] Individual payment methods as web components
- [x] Payment sessions with Flow, 3DS, and webhooks
- [x] Pay with a saved card
- [x] Capture, void, refund, and reverse
- [ ] Dropin
- [ ] Express checkout
- [ ] Tokenization of payment methods other than cards
- [ ] Recurring orders

A web component is a payment form for one payment method. A dropin is one prebuilt form that shows several payment methods. Express checkout is a wallet button that pays from the product or cart page, before the checkout page.

Reference repositories for the missing features:

- Template: `/Users/davidsanchezortiz/projects/connect-payment-integration-template`
- Adyen connector: `/Users/davidsanchezortiz/projects/connect-payment-integration-adyen`

Paths with a line number, such as `file.ts:10`, use the state of the files at the time of writing. Line numbers can drift.

Items that the author could not verify are marked "not verified". Verify them against the Checkout.com documentation or in a sandbox before you rely on them.

## Payment methods

The connector supports 14 payment methods. Each method is one web component.

The columns show where each method appears:

- Enabler type: the key in `supportedMethods` in `enabler/src/payment-enabler/cko-payment-enabler.ts:184`.
- Flow component: the name that the enabler passes to `ckoWebComponents.create(...)` in `enabler/src/components/payment-methods/*.ts`.
- Payment components: the entry in the `/operations/payment-components` response. The code is in `processor/src/services/converters/payment-components.converter.ts`.
- Session value: the value that the processor sends in `enabled_payment_methods` when it creates a payment session.
- Recorded as: the commercetools transaction type that the processor writes when the payment is submitted. It comes from `processor/src/config/payment-method.config.ts`.

| Method | Enabler type | Flow component | Payment components | Session value | Recorded as |
| --- | --- | --- | --- | --- | --- |
| ACH | `ach` | `plaid` | yes | `plaid` | Charge |
| Alma | `alma` | `alma` | yes | `alma` | Charge |
| Apple Pay | `applepay` | `applepay` | yes | `applepay` | Authorization |
| Bizum | `bizum` | `bizum` | yes | `bizum` | Charge |
| Card | `card` | `card` | yes | `card` | Authorization |
| EPS | `eps` | `eps` | yes | `eps` | Charge |
| Google Pay | `googlepay` | `googlepay` | yes | `googlepay` | Authorization |
| iDEAL | `ideal` | `ideal` | yes | `ideal` | Charge |
| Klarna | `klarna` | `klarna` | yes | `klarna` | Authorization |
| MB WAY | `mbway` | `mbway` | yes | `mbway` | Charge |
| PayPal | `paypal` | `paypal` | yes | `paypal` | Authorization |
| Przelewy24 | `przelewy24` | `p24` | yes | `p24` | Charge |
| SEPA Direct Debit | `sepa` | `sepa` | yes | `sepa` | Charge |
| Vipps | `vipps` | `vipps` | yes | `vipps` | Authorization |

Checklist:

- [x] Every method above has a builder in the enabler.
- [x] Every method above is in the `/operations/payment-components` response.
- [x] The session value is derived from the payment methods that commercetools Checkout allows for the session.
- [x] The processor maps `ach` to `plaid` and `przelewy24` to `p24` in both directions (`processor/src/helpers/method-name.helper.ts:13`).
- [x] The README section "Supported Payment Methods" matches the code. It lists the same 14 methods. ACH is the Flow component `plaid`. The README does not list Plaid as a separate method, and no separate method exists.

How the session value works: the processor does not keep its own list for `enabled_payment_methods`. It reads the allowed methods from the commercetools Checkout session in `getAllowedPaymentMethodsFromContext` (`processor/src/helpers/method-name.helper.ts:3`). It renames only `ach` and `przelewy24`. Every other value goes to Checkout.com unchanged. Not verified: that Checkout.com accepts each of these values (for example `sepa`, `applepay`) in `enabled_payment_methods`.

### Inconsistencies

- [ ] The enum `PaymentMethod` in `enabler/src/payment-enabler/payment-enabler.ts:412` contains `twint`. No builder, no `/payment-components` entry, and no name mapping exists for it. Remove `twint` from the enum, or build the method.
- [ ] The same enum sets `przelewy24 = "p24"`. The builder key, the `/payment-components` entry, and the commercetools method name are `przelewy24`. The enum value differs from them. Check where the value is used before you rely on it.
- [ ] `paymentMethodConfig` lists only 8 methods (`processor/src/config/payment-method.config.ts:14`). Methods that are not in the list, such as `card` and `klarna`, are recorded as Authorization. Review the list for Vipps and PayPal. Not verified: whether Checkout.com captures those two automatically.
- [ ] The processor does not check the allowed methods against its own list. If commercetools Checkout allows a method that the connector does not support, the enabler throws "Component type not supported". Consider filtering in `convertAllowedPaymentMethodsToCkoFormat`.

## Web components and dropin

### Web components

- [x] `createComponentBuilder(type)` returns a builder for each of the 14 methods (`enabler/src/payment-enabler/cko-payment-enabler.ts:180`).
- [x] The enabler creates one Checkout.com payment session and loads the Flow web components with it (`cko-payment-enabler.ts:78`).
- [x] `/operations/payment-components` returns the 14 methods in `components` (`payment-components.converter.ts:7`).

### Dropin

- [ ] Dropin is not supported. `createDropinBuilder` has an empty `supportedMethods` object, so every call throws (`cko-payment-enabler.ts:217`). `/operations/payment-components` returns `dropins: []` (`payment-components.converter.ts:6`).

#### What to do

1. Read the enabler contract. `createDropinBuilder(type)`, `DropinType`, `DropinOptions`, and `PaymentDropinBuilder` are in `enabler/src/payment-enabler/payment-enabler.ts:80`, `:706`, `:746`, and `:785`. The `DropinType` values are `embedded` and `hpp`.
2. Read the template implementation. The builder map is in `connect-payment-integration-template/enabler/src/payment-enabler/payment-enabler-mock.ts:194`. The embedded dropin class is in `connect-payment-integration-template/enabler/src/dropin/dropin-embedded.ts`. The `DropinOptions` type is in `connect-payment-integration-template/enabler/src/payment-enabler/payment-enabler.ts:373`.
3. Read the Adyen implementation. See `connect-payment-integration-adyen/enabler/src/payment-enabler/adyen-payment-enabler.ts:87`.
4. Create a dropin class in `enabler/src/dropin/`. It must implement `DropinComponent` (`mount`, `submit`, and the callbacks in `DropinOptions`).
5. Create the dropin with the Flow web components. Checkout.com Flow has a component that shows all enabled methods in one form. Not verified: the name and options of that component. Check the `@checkout.com/checkout-web-components` documentation.
6. Register the class in `createDropinBuilder`. Reuse the same `initCko` session, `handleSubmit`, and `onPaymentCompleted` code that the web components use.
7. In the processor, return the dropin type in `/operations/payment-components`. Change `dropins: []` to `dropins: [{ type: 'embedded' }]`. The Adyen code is in `connect-payment-integration-adyen/processor/src/services/converters/payment-components.converter.ts:8`.
8. Update the tests: `processor/test/services/converters/payment-components.converter.test.ts`.
9. Decide how the dropin handles saving a card. See [Tokenization](#tokenization).

## Express checkout

- [ ] Express checkout is not supported. `createExpressBuilder` always throws (`cko-payment-enabler.ts:265`). `/operations/payment-components` returns `express: []` (`payment-components.converter.ts:51`).

#### What to do

1. Read the enabler contract in `enabler/src/payment-enabler/payment-enabler.ts:850` (`ExpressOptions`) and `:887` (`PaymentExpressBuilder`). The options contain these callbacks:
   - `onPayButtonClick`: returns a new `sessionId` for a cart that the express flow owns.
   - `onShippingAddressSelected`: receives the address that the wallet returns.
   - `getShippingMethods`: returns the shipping options for that address.
   - `onShippingMethodSelected`: receives the selected shipping method.
   - `onPaymentSubmit`: receives the shipping address, the billing address, and the customer email.
   - `onComplete` and `initialAmount`.
2. Read the Adyen processor routes as the reference. In `connect-payment-integration-adyen/processor/src/routes/adyen-payment.route.ts`:
   - `POST /express-config` (line 401). It uses `corsAuthHook` instead of the session hook, because the call happens before a session exists.
   - `POST /express-payments` (line 138) and `POST /express-payments/details` (line 206).
   - `GET /express-payment-data` (line 351).
3. Add the CORS check. The Adyen `corsAuthHook` in `connect-payment-integration-adyen/processor/src/libs/fastify/cors/cors.ts` compares the request origin with a comma-separated list. The list comes from the `ALLOWED_ORIGINS` environment variable (`connect-payment-integration-adyen/processor/src/config/config.ts:56`). It answers 403 for other origins. Add the variable to `connect.yaml` and to `processor/src/config/config.ts`. The global CORS plugin in this repository allows every origin (`processor/src/server/server.ts`).
4. Add the processor logic. The Adyen service has `expressConfig` (`adyen-payment.service.ts:204`) and the express payment methods. They create the cart, set the shipping address and shipping method, and create the payment.
5. Add the enabler side. Adyen has the API client calls in `connect-payment-integration-adyen/enabler/src/api/processor-api.client.ts:156` (`/express-config`), `:175` (`/express-payments`), and `:187` (`/express-payments/details`). The builder map is in `adyen-payment-enabler.ts:104`. The template has a `SampleExpressBuilder` in `connect-payment-integration-template/enabler/src/payment-enabler/payment-enabler-mock.ts:215`.
6. Return the supported express types in `/operations/payment-components`. Adyen returns `applepay`, `googlepay`, and `paypal` (`connect-payment-integration-adyen/processor/src/services/converters/payment-components.converter.ts:16`).
7. Replace the error in `createExpressBuilder` with a builder map.

What Checkout.com offers for Apple Pay and Google Pay express: not verified. Check whether the Flow Apple Pay and Google Pay components can return shipping address and shipping method events. If they cannot, use the wallet API of the provider directly and send the token to Checkout.com.

## Tokenization

Tokenization means that Checkout.com stores a payment method and returns an ID. The connector keeps that ID in commercetools as a stored payment method (SPM). A customer can then pay again without typing the details.

### What works today

- [x] Opt-in on the payment (`setStorePaymentDetails`) works for the card method.
- [x] The saved card is shown in the UI and the customer can pay with it.
- [x] The customer can delete a saved card. The processor deletes it in commercetools first and then in Checkout.com.
- [x] The feature can be turned off per channel with `storedPaymentMethodsEnabled` in `CKO_CONFIG`.
- [ ] No other payment method is tokenized.

### Which methods can be tokenized

| Method | Can the UI request tokenization? | Does the backend save it? |
| --- | --- | --- |
| Card | Yes | Yes |
| Apple Pay | No | Possibly (see below). Not verified. |
| Google Pay | No | Possibly (see below). Not verified. |
| All other methods | No | No |

The UI request: only `card.ts` passes the opt-in value (`enabler/src/components/payment-methods/card.ts:48`). Every other component calls `setStorePaymentDetails?.(false)` in its `submit`. The stored payment builder exists only for `card` (`cko-payment-enabler.ts:244`).

### What happens for each step

1. The enabler sends `storePaymentMethod` in the body of `POST /payment-sessions/:id` (`cko-payment-enabler.ts:167`).
2. The processor reads the flag. If the stored payment methods feature is on and the flag is true, it sends `payment_type: 'Unscheduled'` to Checkout.com. Otherwise it sends `Regular` (`processor/src/services/converters/submit-payment-session.converter.ts:11`). The converter does not look at the payment method type.
3. Checkout.com sends a webhook, such as `payment_approved`. The processor converts it in `processor/src/services/converters/notification.converter.ts:191`.
4. If `source.type` is `card`, the processor takes `source.id` as the token. It writes it to `paymentMethodInfo.token.value` on the commercetools Payment. A source of any other type gets no token.
5. For a card, the processor also builds custom fields on `paymentMethodInfo`: brand, last four digits, BIN, expiry month, expiry year, and a flag `storePaymentMethod`. It builds them only when `savePaymentMethodAdditionalDetails` is true, which is the default (`notification.converter.ts:209`).
6. The flag `storePaymentMethod` is true when `source.id` exists and the payment metadata has no `payment_method_id` (`notification.converter.ts:220`). A payment with a saved card has `payment_method_id`, so it does not create a second copy.
7. After the Payment update, `savePaymentMethod` runs (`processor/src/services/cko-payment.service.ts:451`). It does nothing unless the flag is true. It skips the save when the customer already has this token. It logs and ignores errors.
8. `savePaymentMethod` calls `ctPaymentMethodService.save` with: the customer ID from the Payment, the method name, the token (`source.id`), the payment interface, the interface account, and the custom fields. The payment interface defaults to `checkout-cko`. The interface account defaults to the channel ID. The result is a commercetools Payment Method object, which is the SPM. The `token.value` of that object holds the Checkout.com instrument ID.

When the customer lists saved cards, the processor reads the SPMs for the customer. It then calls `GET /instruments/{token}` on Checkout.com for each one (`processor/src/services/cko-stored-payment-method.service.ts:295`). The UI shows brand, last four digits, and expiry from the instrument. An SPM without a matching instrument is not shown.

### Gaps and risks

- [ ] The save depends on the webhook. There is no save at payment time. If the webhook is late or lost, the card is not saved.
- [ ] The save needs a customer on the Payment. An anonymous cart cannot save a card. The error is logged and ignored.
- [ ] If `savePaymentMethodAdditionalDetails` is false, the custom fields are not built. The flag is then never true, and no card is saved. The setting name suggests that it only controls extra data. Decide whether this link is intended.
- [ ] The save does not check the opt-in itself. It checks only for `source.id` and the absence of `payment_method_id`. Not verified: whether Checkout.com returns `source.id` for a card payment without opt-in. If it does, the connector saves cards that the customer did not choose to save. Test this in the sandbox.
- [ ] Apple Pay and Google Pay: the processor reads `card_wallet_type` as the method name. If Checkout.com reports the source of a wallet payment as `card`, the processor can save a token for it. Not verified. Test this in the sandbox.
- [ ] `getStoredPaymentMethods` returns SPMs of any method type. Only cards have display data. Other types get an empty `displayOptions`.

### What to do to tokenize another payment method

1. Find out which methods Checkout.com can store as an instrument. Not verified. Check the Checkout.com documentation for the payment instruments API and for each method.
2. In the component of that method, pass the opt-in value in `submit`. Use `card.ts:48` as the model. Replace `setStorePaymentDetails?.(false)`.
3. In `notification.converter.ts:191`, handle the new `source.type`. Set the token and the custom fields for it.
4. In `getStoredPaymentMethodsConverter.convertPaymentMethodDisplayOptions` (`processor/src/services/converters/get-stored-payment-methods.converter.ts:63`), add display options for the new instrument type.
5. Add a stored payment builder in `enabler/src/stored/stored-payment-methods/` and register it in `createStoredPaymentMethodBuilder` (`cko-payment-enabler.ts:244`).
6. Pay with the stored method. `processStoredPayment` sends `source: { type: 'id', id: token }` (`process-stored-payment.converter.ts:29`). Check that Checkout.com accepts this source for the new method.
7. Add tests next to the existing tests for the converters.

### Other ways to tokenize

- [ ] Tokenize without a payment (zero amount). Not supported. See "Save a new card with a zero amount" under [Recurring orders](#recurring-orders).
- [ ] Tokenize from a webhook alone. The connector already does this for cards, as described above. The code does not use any separate Checkout.com instrument event.

## Recurring orders

A recurring order is an order that commercetools Checkout creates again on a schedule. The customer does not take part in the later orders. commercetools Checkout calls the connector for each later order, and the connector must charge the saved payment method. A charge that the merchant starts without the shopper is a merchant-initiated transaction (MIT).

- [ ] Recurring orders are not supported.
- [x] The route `POST /operations/transactions` exists. It checks the OAuth token and the scope `manage_checkout_transactions` (`processor/src/routes/operation.route.ts:123`). The body schema matches the template (`processor/src/dtos/operations/transaction.dto.ts`).
- [ ] The service method always throws `NotImplementedError`, so the route answers 501 (`processor/src/services/cko-payment.service.ts:67`).

Terms for this section:

- A recurring payment job is an object in commercetools Checkout. It links a stored payment method to a recurring cart. commercetools Checkout uses it to create the later orders.
- The SDK service for jobs is `ctRecurringPaymentJobService` from `@commercetools/connect-payments-sdk`. It applies only to commercetools Checkout.

### What to do

#### Step a: charge the saved payment method (MIT)

1. In `handleTransaction` (`cko-payment.service.ts:67`), check `transactionDraft.type`. If it is `Recurring`, call a new private method. If not, throw `ErrorInvalidField`. The template does this at `connect-payment-integration-template/processor/src/services/mock-payment.service.ts:633`. Adyen does it at `connect-payment-integration-adyen/processor/src/services/adyen-payment.service.ts:1152`.
2. Check that the stored payment methods feature is on for the channel. If not, throw `ErrorInvalidOperation`.
3. Get the cart with `ctCartService.getCart({ id: transactionDraft.cartId })`. If `cart.customerId` is not set, throw `ErrorInternalConstraintViolated`.
4. Get the cart amount with `ctCartService.getPaymentAmount({ cart })`. If the draft has an `amount`, check two things. The currency must match the cart. The `centAmount` must not be higher than the cart amount.
5. If `transactionDraft.paymentMethodId` is missing, throw `ErrorRequiredField`.
6. Get the SPM with `ctPaymentMethodService.get`. Pass the customer ID, the payment interface, and the interface account. These come from `getConfig()`. If the SPM has no token, throw `ErrorInternalConstraintViolated`.
7. Create the commercetools Payment with `ctPaymentService.createPayment`. Set `amountPlanned`, `checkoutTransactionItemId`, `paymentMethodInfo` with the token and method, and the customer. Then add it to the cart with `ctCartService.addPayment`.
8. Build the Checkout.com request in a new converter. Model it on `ProcessStoredPaymentConverter` (`processor/src/services/converters/process-stored-payment.converter.ts`). Use `source: { type: 'id', id: token }`. Remove `success_url` and `failure_url`, because no shopper is present. Set `payment_type` to `Recurring`, set `merchant_initiated` to true, and set `previous_payment_id` to the ID of the first payment. The research for this file found these field names in the Checkout.com recurring payments guide (see [Candidate features](#candidate-features-beyond-commercetools-checkout)). The type in `processor/src/clients/types/payment.type.ts:57` already allows `payment_type`. The other two fields do not exist in the types yet. Also see below: the first payment (the customer present) must use `payment_type: 'Recurring'` and not `Regular`.
9. Leave 3DS out of the MIT request. The research found that Checkout.com asks for 3DS on the first payment and omits it for the later MIT. Check the guide before you ship.
10. Pass the idempotency key. `TransactionDraft.idempotencyKey` exists, but no Checkout.com call in the connector sends one today. Not verified: the Checkout.com header name for idempotency.
11. Send the request with `getCkoApiClient().payments.createPayment`. Update the Payment with `pspReference`, an `Authorization` transaction, and a `pspInteractions` entry. Use the code in `cko-stored-payment-method.service.ts:131` as the model.
12. Return the result. Return `Completed` when the payment is authorized. Return `Failed` with the error code `PaymentRejected` and a message when it is declined. Return `Pending` for any other status. Always return `paymentId`. Adyen does this at `adyen-payment.service.ts:1100`. The template does it at `mock-payment.service.ts:700`.
13. Make the webhook flow safe for these payments. The notification handler finds the Payment from `metadata.payment_id`. Put `payment_id` in the metadata of the MIT request, as `ProcessStoredPaymentConverter` does.
14. Add unit tests for each branch: feature off, no customer, wrong currency, amount too high, missing method ID, missing token, approved, declined, and pending.

#### Step b: create the recurring payment job

1. Wire the SDK service. Add `ctRecurringPaymentJobService: paymentSDK.ctRecurringPaymentJobService` to the service options. The template does this in `connect-payment-integration-template/processor/src/server/app.ts:8` and `.../server/plugins/mock-payment.plugin.ts:11`. Adyen does it in `connect-payment-integration-adyen/processor/src/server/app.ts:23`. Add the field to `CkoPaymentServiceOptions` in `processor/src/services/types/cko-payment.type.ts` and to `processor/src/server/app.ts`.
2. Get the commercetools ID of the SPM after you save it. In `savePaymentMethod` (`cko-payment.service.ts:474`), the result `spm` holds `spm.id`. If the token already exists for the customer (`cko-payment.service.ts:466`), find the existing SPM instead. Adyen uses `ctPaymentMethodService.getByTokenValue` at `adyen-payment.service.ts:1895`.
3. Call `createRecurringPaymentJobIfApplicable` with the origin Payment and the SPM. The template wrapper is in `mock-payment.service.ts:511`. The Adyen wrapper is in `adyen-payment.service.ts:785`.
4. Call the wrapper only after the Payment is authorized and the SPM exists. The template does this at `mock-payment.service.ts:397`. Adyen does this from the tokenization webhook at `adyen-payment.service.ts:679`.
5. Do not let a failure break the webhook. The SDK method does not throw. It returns `null` when the cart is not recurring or when the request fails.
6. Pay with an existing card: do the same call when the customer pays a recurring cart with a saved card. Adyen covers this at `adyen-payment.service.ts:1895`. Add the call to `processStoredPayment` or to the webhook path.

#### Step c: permissions, status, and `connect.yaml`

1. The API client must have the scope `manage_recurring_payment_jobs`. It also needs `manage_payment_methods` for the SPMs.
2. In `status()` (`cko-payment.service.ts:96`), add `manage_recurring_payment_jobs` to `requiredPermissions` when stored payment methods are on. The template does this at `mock-payment.service.ts:97`. Adyen does it at `adyen-payment.service.ts:247`.
3. Update the text of `CTP_CLIENT_ID` in `connect.yaml`. The current text lists `manage_payments`, `manage_orders`, `view_sessions`, `view_api_clients`, `manage_checkout_payment_intents`, `introspect_oauth_tokens`, `manage_types`, and `view_types`. It does not list `manage_payment_methods`, `view_customers`, `manage_recurring_payment_jobs`, or `manage_checkout_transactions`.
4. Update `processor/README.md` and the README section on API client scopes. The template documents this at `connect-payment-integration-template/README.md:159`. Adyen documents it at `connect-payment-integration-adyen/processor/README.md:82`.

#### Step d: change the payment method of a recurring order

Not supported. To support it, the customer must replace the saved payment method on the recurring order. Not verified: how commercetools Checkout asks the connector to do this. The Adyen connector has no dedicated route for it in the files that were read. Use the SDK documentation and the Adyen code as a start, and ask the commercetools Checkout team.

A likely approach: the customer saves a new method with the normal flow, and commercetools updates the recurring order to point to the new SPM. This is not verified.

#### Save a new card with a zero amount

Goal: save a card without a purchase, for example to change the method of a recurring order.

- Use a card verification. Send `POST /payments` with a token source and an amount of 0 or no amount. A success returns `approved: true` and the status `Card Verified`. The response contains `source.id` and `customer.id`. A 202 answer means that the customer must complete 3DS. Source: https://www.checkout.com/docs/payments/authenticate-payments/card-verification
- Some issuers reject a zero amount. The documented workaround is a small authorization that you void afterward. Checkout.com also lists Intelligent Acceptance as an option.
- A `card_verified` webhook exists. The connector does not handle it today, so add it to `notification.converter.ts:18`.
- The connector has `getInstrument` and `deleteInstrument` only (`processor/src/clients/api/instrument.api.ts`). The new endpoint must send the verification, handle the 3DS redirect, and then call `ctPaymentMethodService.save` and the recurring payment job, as in step b.
- Not verified: whether the Flow session can create the instrument without a charge. A Flow extension, "collect payment details without an initial payment session", may help. See https://www.checkout.com/docs/payments/accept-payments/accept-a-payment-on-your-website/extend-your-flow-integration/collect-payment-details-without-an-initial-payment-session

## Payment operations

The route is `POST /operations/payment-intents/:id`. It requires an OAuth token with the scope `manage_project` or `manage_checkout_payment_intents` (`processor/src/routes/operation.route.ts:88`). The code is in `processor/src/services/cko-payment-intent.service.ts`.

- [x] Capture (`capturePayment`). It sends the amount to Checkout.com. A partial capture is possible. Not verified: several partial captures. The research found that Checkout.com needs the capture type `NonFinal` for them, and the connector does not set a capture type. The connector does not check the amount against the authorized amount. Checkout.com does the check.
- [x] Refund (`refundPayment`). It sends the amount. A partial refund is possible. The `transactionId` field in the request is read but not used.
- [x] Void (`cancelPayment`). It voids the whole authorization. The request has no amount field. A partial void is not supported.
- [x] Reverse (`reversePayment`). It sends no amount, so it reverses the whole payment. The connector records a Refund if a Charge exists, and a CancelAuthorization if not.
- [x] A failed call to Checkout.com does not throw. The connector records a failed transaction in commercetools and answers with the outcome `rejected`.
- [x] The request accepts only one action in the `actions` array (`maxItems: 1`).
- [ ] The result of each operation is final only after the webhook. The connector writes the transaction as `Success` when the API call succeeds, and the webhook writes it again. Not verified: that the SDK removes duplicate transactions with the same `interfaceId`. Check this in a sandbox.

## Other implemented features

- [x] Payment sessions with Flow: `POST /payment-sessions` creates the commercetools Payment and the Checkout.com session. `POST /payment-sessions/:id` submits it (`cko-payment.service.ts:166` and `:221`).
- [x] 3DS (3-D Secure, a card login step) is on by default. Set `enableThreeDS` in `CKO_CONFIG` per channel to change it (`processor/src/config/config.ts`). The redirect return route is `GET /payment-sessions/confirm`.
- [x] Pay with a saved method: `POST /stored-payment-methods/:id/payments`, with its confirm route and 3DS redirect (`processor/src/routes/stored-payment-method.route.ts`).
- [x] Stored payment methods: list, pay, and delete (`GET /stored-payment-methods`, `DELETE /stored-payment-methods/:id`).
- [x] Webhooks: `POST /notifications`. The processor checks the HMAC (a keyed hash of the body) in the header `cko-signature` (`processor/src/libs/fastify/hooks/hmac-auth.hook.ts`). It compares the values in constant time.
- [x] Handled webhook events: `payment_approved`, `payment_canceled`, `payment_declined`, `payment_expired`, `payment_captured`, `payment_capture_declined`, `payment_refunded`, `payment_refund_declined`, `payment_voided`, and `payment_void_declined` (`notification.converter.ts:18`). The processor accepts any other event and ignores it.
- [x] The processor accepts a webhook for a payment that it cannot find. It answers 200 so Checkout.com does not retry.
- [x] Multi-channel: the processor picks the Checkout.com channel from the cart. The path is a JSONata expression, `channelPath`, with the default `store.key`.
- [x] Capture timing: `captureDelayHours` in `CKO_CONFIG` sets manual, immediate, or delayed capture (`helper.converter.ts:68`).
- [x] MSSD (merchant-specific sub-domain). With the `clientId` of a channel, the connector calls the hosts that belong to that merchant. See `processor/README.md`.
- [x] `GET /operations/status`: a health check with a JWT. It checks the commercetools permissions and calls the Checkout.com payment methods API (`cko-payment.service.ts:96`).
- [x] `GET /operations/payment-components`: JWT authentication.
- [x] `GET /operations/config`: returns the public key, the environment, and the stored payment methods flag. It uses the session header.
- [x] Authentication: session header for the shopper routes, session query parameter for the return routes, JWT for the merchant center routes, OAuth for the commercetools Checkout routes.
- [x] Interface interactions: the processor saves requests and responses on the Payment. Set `saveInterfaceInteractions` to turn this off.
- [x] Custom types: the post-deploy script creates the payment custom types (`processor/src/connectors/post-deploy.ts`).
- [x] Locale conversion for Flow in the enabler (`enabler/src/converters/locale.converter.ts`).

### Gaps in this area

- [ ] The webhook route does not select the channel. The HMAC check uses the key of the default channel only (`processor/src/server/plugins/cko-payment.plugin.ts`). A webhook for another channel with another HMAC key fails with an auth error. Not verified in a running system.
- [ ] The processor does not register the webhook in Checkout.com. The post-deploy script creates custom types only. The merchant must create the webhook by hand.
- [ ] Two channel settings do not fall back to the default channel. `captureDelayHours` and `storedPaymentMethodsEnabled` use only the channel value when a channel matches (`config.ts:268` and `:303`). Other settings, such as `enableThreeDS`, fall back. Check whether this is intended.
- [ ] `/operations/status` asks for permissions that depend on features, but the list is fixed. It always asks for `manage_payment_methods`, `manage_types`, and `view_customers`. It does not ask for `manage_checkout_transactions`. The route `/transactions` needs that scope in the OAuth token of commercetools Checkout, not in the API client. Compare with the template (`mock-payment.service.ts:88`) and Adyen (`adyen-payment.service.ts:230`), which add `manage_payment_methods` only when stored payment methods are on.
- [ ] CORS allows every origin (`processor/src/server/server.ts`). The Adyen connector restricts the express route only.

## Candidate features beyond commercetools Checkout

This section comes from research on the Checkout.com platform, other Checkout.com plugins, and the Adyen connector. Statements marked "not verified" were not confirmed in the documentation. Effort estimates are guesses. Field names come from the documentation pages that the research read. Check them in the API reference before you build: https://api-reference.checkout.com/

### Needed for commercetools Checkout

- [ ] First payment of a recurring order. The session sets `payment_type: 'Regular'` (`create-payment-session.converter.ts:34`). A recurring cart must use `Recurring` for the first payment, so Checkout.com stores the card and links later payments. What to do: set `payment_type` to `Recurring` when the cart is recurring. Docs: https://www.checkout.com/docs/payments/accept-payments/pay-with-stored-card-details/recurring-payments-with-stored-card-details
- [ ] Later payments as MIT through `POST /operations/transactions`. What to do: follow step a in [Recurring orders](#recurring-orders). Use `payment_type`, `merchant_initiated`, and `previous_payment_id`. The first value of `previous_payment_id` is the ID of the first payment. A later value can be the ID of a previous MIT or a scheme transaction ID. Docs: same page, and https://support.checkout.com/hc/en-us/articles/14327067200402-Use-a-charge-ID-for-recurring-payments-in-the-API
- [ ] Source of a credential that Checkout.com does not hold. The research found `source.stored: true` for this case. Not verified for this connector. Skip it if the connector always uses Checkout.com instruments.
- [ ] Card verification with a zero amount, to change the payment method of a recurring order. What to do: see "Save a new card with a zero amount". Docs: https://www.checkout.com/docs/payments/authenticate-payments/card-verification
- [ ] Express checkout for Apple Pay and Google Pay. What to do: see [Express checkout](#express-checkout). Not verified: whether Flow has an express mode. Other Checkout.com plugins (SAP Commerce Cloud, WooCommerce) offer wallet buttons on the product and cart pages. Docs: check the Flow reference at https://www.checkout.com/docs/payments/accept-payments/accept-a-payment-on-your-website/get-started-with-flow
- [ ] Dropin. What to do: see [Dropin](#dropin). Not verified: the research could not confirm that commercetools Checkout requires it. The Adyen connector has it. The Flow composite component, `checkout.create('flow')`, shows all methods in one session. Docs: same Flow page.
- [ ] Partial and multiple captures, and partial refunds. What to do: check the capture request in `capture-payment.converter.ts`. Several partial captures need the capture type `NonFinal`. Without it, Checkout.com voids the rest after the first capture. The limit is 150 partial actions for each payment (captures and refunds). Docs: https://www.checkout.com/docs/payments/manage-payments/capture-a-payment and https://support.checkout.com/hc/en-us/articles/26443377835794-Partial-capture-action-limit
- [ ] More webhooks for correct states. What to do: add `payment_pending` and `card_verified` to the event map in `notification.converter.ts:18`. The connector ignores both today. Check the event pages first for the fields that each event carries. Docs: https://www.checkout.com/docs/developer-resources/event-notifications
- [ ] Authentication events. Not verified: which events exist and whether the connector needs them.

### Useful mainly for other clients

- [ ] Fraud detection. What to do: send `risk` set to true in the payment request, and map flagged payments to a payment state. The webhook type has `risk.flagged` (`processor/src/clients/types/webhook.type.ts`), but no code reads it. Strategies are set in the Checkout.com dashboard, and the account manager must enable the feature. Not verified: the `risk` object in the payment response and any review actions. Docs: https://www.checkout.com/docs/business-operations/prevent-fraud
- [ ] Risk SDK for device data. What to do: add it to the enabler. Not verified: whether Flow already includes it. Docs: https://www.checkout.com/docs/business-operations/prevent-fraud/integrate-with-risk-sdk
- [ ] `fraud_reported` webhook. What to do: add it to the event map and record it on the Payment. Docs: https://www.checkout.com/docs/developer-resources/event-notifications/event-types/fraud_reported
- [ ] Disputes. What to do: map the webhooks `dispute_received` and `dispute_evidence_required` to a record on the commercetools Payment. Evidence upload is a back-office task and can stay out of the connector. Docs: https://www.checkout.com/docs/payments/process-disputes/disputes-api
- [ ] Capture override for each method. The Adyen connector has a per-method `supportSeparateCapture` setting, as this connector has in `payment-method.config.ts`. What to do: make that list a configuration value for each channel, and review the methods that are missing from it. Docs: https://www.checkout.com/docs/payments/manage-payments/capture-a-payment
- [ ] Incremental authorization. What to do: add an operation that raises an estimated authorization before capture. Visa and Mastercard support it globally and Amex in the US. The commercetools Checkout contract has no hook for it. Docs: https://www.checkout.com/docs/payments/manage-payments/authorize-a-payment/adjust-an-estimated-authorization
- [ ] Partial authorization. What to do: send `partial_authorization.enabled: true` and handle an approved amount that is lower than the order amount. Checkout.com advises against auto-capture with it. Docs: https://www.checkout.com/docs/payments/manage-payments/authorize-a-payment
- [ ] Hosted Payments Page. What to do: add a route that calls `POST /hosted-payments` and redirects the customer to the link in `_links.redirect`. It does not fit the enabler model. Docs: https://www.checkout.com/docs/integrate/hosted-payments-page
- [ ] Payment Links. What to do: add a route that calls `POST /payment-links`. The account manager must enable the feature. It suits pay-by-link orders. Docs: https://www.checkout.com/docs/payments/accept-payments/create-a-payment-link
- [ ] Interaction logging with masking. The connector already saves the request and the response on the Payment (`saveInterfaceInteractions`). It does not mask any field. What to do: mask sensitive fields before it saves them, as the Adyen connector does.
- [ ] Level 2 and Level 3 data, billing descriptors, and MOTO (payments that a call-center agent enters). What to do: send the extra fields from the cart. `payment_type` already allows `MOTO`. Not verified: the field names for Level 2 and Level 3 data. Docs: the plugin pages at https://www.checkout.com/docs/payments/accept-payments/connect-to-an-ecommerce-platform
- [ ] Network tokens and account updater. Both are mostly account settings at Checkout.com. What to do: ask the account manager to enable them, and test that stored cards still work. Not verified: which webhook reports an updated instrument. Docs: https://www.checkout.com/docs/payments/store-and-manage-credentials/store-credentials/network-tokens and https://www.checkout.com/docs/payments/store-and-manage-credentials/update-stored-credentials/real-time-account-updater

### Not verified or out of scope

- Click to Pay: the research could not confirm support in Flow.
- Subscriptions product: the research found no Checkout.com subscriptions API. This is an inference from search results. The scheduling of later payments belongs to commercetools Checkout.
- Payment Context and Payment Setup API: needed only if you leave Flow for Klarna or PayPal. Docs: https://api-reference.checkout.com/tag/Payment-Context/
- Forward API, reporting exports, and payouts: not a core connector job.
