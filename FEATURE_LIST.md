# Feature list

This file lists what the Checkout.com connector for commercetools does today and what is missing. The connector is compatible with commercetools Checkout.

The connector has two parts. The enabler is the browser library that shows the payment forms. The processor is the backend service that talks to Checkout.com and commercetools.

## Contents

- [Payment methods](#payment-methods)
- [Checkout experience](#checkout-experience)
- [Saved payment methods](#saved-payment-methods)
- [Recurring orders](#recurring-orders)
- [Payment operations](#payment-operations)
- [Platform features](#platform-features)
- [Pending work](#pending-work)

## Payment methods

The connector supports 14 payment methods. Each one is a separate web component, which is a payment form for one method. 

| Method | Type | Tokenization implemented |
| --- | --- | --- |
| Card | Card | Yes |
| Apple Pay | Wallet | No |
| Google Pay | Wallet | No |
| PayPal | Wallet | No |
| Vipps | Wallet | No |
| ACH | Bank transfer | No |
| EPS | Bank transfer | No |
| iDEAL | Bank transfer | No |
| Przelewy24 | Bank transfer | No |
| SEPA Direct Debit | Bank debit | No |
| Alma | Buy now, pay later | No |
| Klarna | Buy now, pay later | No |
| Bizum | Mobile payment | No |
| MB WAY | Mobile payment | No |

## Checkout experience

- [x] Web components: one payment form for each payment method above.
- [x] 3DS: a card login step that the bank requires. It is on by default and the merchant can turn it off for each channel.
- [ ] Dropin: one prebuilt form that shows many payment methods. Only web components exist today.
- [ ] Express checkout: a wallet button on the product or cart page, before checkout. Not supported.

<details>
<summary>How to implement the dropin</summary>

1. Create a class that implements `DropinComponent` and a builder that implements `PaymentDropinBuilder`. Both types are in `enabler/src/payment-enabler/payment-enabler.ts`.

```ts
export class DropinEmbeddedBuilder implements PaymentDropinBuilder {
  public dropinHasSubmit = true;

  constructor(private baseOptions: BaseOptions) {}

  build(config: DropinOptions): DropinComponent {
    return new DropinEmbedded(this.baseOptions, config);
  }
}
```

2. Create the Flow component that shows all enabled methods in one form. Not verified: the component name and its options. The Flow library has a composite component named `flow`. Check the `@checkout.com/checkout-web-components` documentation.

```ts
export class DropinEmbedded implements DropinComponent {
  private component: Component;

  constructor(private baseOptions: BaseOptions, private options: DropinOptions) {
    // Not verified: component name and options.
    this.component = baseOptions.ckoWebComponents.create('flow', {});
  }

  async mount(selector: string): Promise<void> {
    this.component.mount(selector);
    await this.options.onDropinReady?.();
  }

  async submit(): Promise<void> {
    this.component.submit();
  }
}
```

3. Register the builder in `createDropinBuilder`. Today the object `supportedMethods` is empty.

```ts
const supportedMethods = {
  embedded: DropinEmbeddedBuilder,
};
```

4. Tell commercetools Checkout about the dropin. Change the response of `/operations/payment-components`.

```ts
return {
  dropins: [{ type: 'embedded' }],
  components: [/* unchanged */],
  express: [],
};
```

5. Update the converter test in `processor/test/services/converters/payment-components.converter.test.ts`.

</details>

<details>
<summary>How to implement express checkout</summary>

1. Implement `createExpressBuilder` in the enabler. It throws an error today. The options type `ExpressOptions` defines the callbacks that the builder must call.

```ts
async createExpressBuilder(type: string): Promise<PaymentExpressBuilder | never> {
  await this.initCko;
  const supportedMethods = { applepay: ApplePayExpressBuilder, googlepay: GooglePayExpressBuilder };
  if (!Object.keys(supportedMethods).includes(type)) {
    throw new Error(`Express checkout type not supported: ${type}`);
  }
  return new supportedMethods[type](this.baseOptions);
}
```

2. Build the express component. It must call the callbacks of `ExpressOptions` in this order:
   - `onPayButtonClick` returns a new `sessionId` for a cart that the express flow owns.
   - `onShippingAddressSelected` and `getShippingMethods` run when the shopper picks an address.
   - `onShippingMethodSelected` runs when the shopper picks a delivery option.
   - `onPaymentSubmit` runs with the final shipping and billing addresses.
3. Add processor routes. The express flow runs before a payment session exists, so the first route cannot use the session header. Restrict it with a list of allowed origins.

```ts
export const corsAuthHook = () => async (request: FastifyRequest, reply: FastifyReply) => {
  const allowedOrigins = (getConfig().allowedOrigins?.split(',') ?? []).map((o) => o.trim().replace(/\/$/, ''));
  const origin = request.headers.origin?.replace(/\/$/, '');
  if (!origin || !allowedOrigins.includes(origin)) {
    reply.code(403).send({ error: 'Forbidden', message: 'CORS origin not allowed.' });
    return;
  }
  reply.header('Access-Control-Allow-Origin', origin);
};

fastify.post('/express-config', { preHandler: [corsAuthHook()] }, async (request, reply) => {
  return reply.status(200).send(await opts.paymentService.expressConfig({ data: request.body }));
});
```

4. Add the variable `ALLOWED_ORIGINS` to `connect.yaml` and to `processor/src/config/config.ts`.
5. Add a route that creates the payment from the wallet data, for example `POST /express-payments`. It uses the session header.
6. Declare the express types in `/operations/payment-components`.

```ts
express: [{ type: 'applepay' }, { type: 'googlepay' }],
```

7. Not verified: whether the Flow Apple Pay and Google Pay components return shipping address and shipping method events. If they do not, use the wallet API of the provider and send the wallet token to Checkout.com.

</details>

## Saved payment methods

Saving a payment method means that Checkout.com stores it and commercetools keeps a reference to it. A saved method is called a stored payment method (SPM). The connector does not store card data.

The connector saves cards only. A card is the one method that a shop can show to the shopper in a useful way, with the last four digits, the brand, and the expiry date.

- [x] Save a card during payment. The shopper opts in with a checkbox in the shop.
- [x] Pay with a saved card, including 3DS.
- [x] List and delete saved cards. The delete removes the card in commercetools and in Checkout.com.
- [x] Turn the feature off for each channel.

## Recurring orders

A recurring order is an order that commercetools creates again on a schedule. The shopper is not present for the later orders. A charge that the merchant starts without the shopper is a merchant-initiated transaction (MIT).

When the cart has a recurring item, the connector must save the payment method that the shopper uses at checkout. The later orders pay with that saved method. Any commercetools Checkout client that uses recurring orders can use this flow.

- [ ] Charge the later orders. The route `POST /operations/transactions` exists, but it answers 501 Not Implemented.
- [ ] Save the payment method when the cart has a recurring item, and create the recurring payment job.
- [ ] Send the first payment as a recurring payment. The first payment is always sent as a regular payment today.

<details>
<summary>How to implement the MIT charge</summary>

1. Replace the body of `handleTransaction` in `processor/src/services/cko-payment.service.ts`.

```ts
public async handleTransaction(transactionDraft: TransactionDraftDTO): Promise<TransactionResponseDTO> {
  if (transactionDraft.type === 'Recurring') {
    return await this.handleTransactionRecurringType(transactionDraft);
  }

  throw new ErrorInvalidField('type', transactionDraft.type || 'not-provided', 'Recurring');
}
```

2. Validate the request. The cart must have a customer, the amount must match the cart, and the saved payment method must have a token.

```ts
if (!getConfig().isStoredPaymentMethodsEnabled()) {
  throw new ErrorInvalidOperation('The stored-payment-methods feature is disabled.');
}

const ctCart = await this.ctCartService.getCart({ id: transactionDraft.cartId });
if (!ctCart.customerId) {
  throw new ErrorInternalConstraintViolated('The cart does not have a customerId set.');
}

const cartAmount = await this.ctCartService.getPaymentAmount({ cart: ctCart });
if (transactionDraft.amount) {
  if (transactionDraft.amount.currencyCode !== cartAmount.currencyCode) {
    throw new ErrorInvalidField('amount.currencyCode', transactionDraft.amount.currencyCode, cartAmount.currencyCode);
  }
  if (transactionDraft.amount.centAmount > cartAmount.centAmount) {
    throw new ErrorInvalidField('amount.centAmount', String(transactionDraft.amount.centAmount), `<= ${cartAmount.centAmount}`);
  }
}

if (!transactionDraft.paymentMethodId) {
  throw new ErrorRequiredField('paymentMethodId');
}

const paymentMethod = await this.ctPaymentMethodService.get({
  id: transactionDraft.paymentMethodId,
  customerId: ctCart.customerId,
  paymentInterface: getConfig().getPaymentInterface(),
  interfaceAccount: getConfig().getInterfaceAccount(),
});
if (!paymentMethod.token) {
  throw new ErrorInternalConstraintViolated('The referenced payment method does not have a token set.');
}
```

3. Create the commercetools Payment and add it to the cart.

```ts
const amountPlanned = transactionDraft.amount ?? cartAmount;

const payment = await this.ctPaymentService.createPayment({
  amountPlanned,
  checkoutTransactionItemId: transactionDraft.checkoutTransactionItemId,
  paymentMethodInfo: {
    paymentInterface: getConfig().getPaymentInterface(),
    interfaceAccount: getConfig().getInterfaceAccount(),
    token: { value: paymentMethod.token.value },
    ...(paymentMethod.method && { method: paymentMethod.method }),
  },
  customer: { typeId: 'customer', id: ctCart.customerId },
});

await this.ctCartService.addPayment({
  resource: { id: ctCart.id, version: ctCart.version },
  paymentId: payment.id,
});
```

4. Send the charge to Checkout.com. Use the stored source, no redirect URLs, and the MIT fields. The three MIT fields come from the Checkout.com recurring payments guide.

```ts
const ckoRequest: CkoPaymentRequest = {
  processing_channel_id: getConfig().getChannelId(),
  amount: amountPlanned.centAmount,
  currency: amountPlanned.currencyCode,
  source: { type: 'id', id: paymentMethod.token.value },
  reference: payment.id,
  billing: { address: convertAddress(ctCart.billingAddress!) },
  ...convertEnableCapture(),
  payment_type: 'Recurring',
  merchant_initiated: true,
  previous_payment_id: firstPaymentId,
  metadata: { payment_id: payment.id, cart_id: ctCart.id, payment_method_id: paymentMethod.id },
  integration: { external_platform: { name: 'Commercetools', version: '1.0.0' } },
};
const ckoResponse = await getCkoApiClient().payments.createPayment(ckoRequest);
```

Not verified: where `firstPaymentId` comes from. It is the ID of the first Checkout.com payment of the series. The connector does not keep it today. Save it when the first payment is approved, for example in a custom field. Not verified: whether to send 3DS settings for a MIT. Not verified: the Checkout.com header for idempotency. The draft has an `idempotencyKey` that the connector does not use yet.

5. Record the result in commercetools and answer commercetools Checkout.

```ts
const state = ckoResponse.status === CkoPaymentStatus.Authorized ? 'Success'
  : ckoResponse.status === CkoPaymentStatus.Declined ? 'Failure' : 'Initial';

const updated = await this.ctPaymentService.updatePayment({
  id: payment.id,
  pspReference: ckoResponse.id,
  transaction: { type: 'Authorization', amount: amountPlanned, interfaceId: ckoResponse.id, state },
});

if (state === 'Failure') {
  return {
    transactionStatus: {
      errors: [{ code: 'PaymentRejected', message: `Payment '${payment.id}' has been rejected` }],
      state: 'Failed',
    },
    paymentId: updated.id,
  };
}
return {
  transactionStatus: { errors: [], state: state === 'Success' ? 'Completed' : 'Pending' },
  paymentId: updated.id,
};
```


</details>

<details>
<summary>How to implement the first recurring payment and the recurring payment job</summary>

A recurring payment job links a saved payment method to a recurring cart. commercetools Checkout uses it to create the later orders. It applies only to commercetools Checkout.

1. Send the first payment as a recurring payment. The session request sets `payment_type: 'Regular'` today. Change it when the cart is recurring. Not verified: how to detect a recurring cart. Check the cart fields that commercetools Checkout sets.

```ts
payment_type: isRecurringCart ? 'Recurring' : 'Regular',
```

2. Give the payment service access to the job service. Add it to the service options type and to `processor/src/server/app.ts`.

```ts
const paymentService = new CkoPaymentService({
  ctCartService: paymentSDK.ctCartService,
  ctPaymentService: paymentSDK.ctPaymentService,
  ctPaymentMethodService: paymentSDK.ctPaymentMethodService,
  ctRecurringPaymentJobService: paymentSDK.ctRecurringPaymentJobService,
  // other options unchanged
});
```

3. Add a helper that creates the job.

```ts
private async createRecurringPaymentJobIfApplicable(paymentId: string, paymentMethodId: string): Promise<void> {
  const recurringPaymentJob = await this.ctRecurringPaymentJobService.createRecurringPaymentJobIfApplicable({
    originPayment: { id: paymentId, typeId: 'payment' },
    paymentMethod: { id: paymentMethodId, typeId: 'payment-method' },
  });

  if (recurringPaymentJob) {
    log.info('Created recurring payment job', { recurringPaymentJobId: recurringPaymentJob.id });
  }
}
```

The method does not throw. It returns `null` when the cart is not recurring or when the request fails.

4. Call the helper in `savePaymentMethod`, after `ctPaymentMethodService.save` returns the new payment method. If the token already exists for the customer, look up the existing payment method and call the helper with its ID.

```ts
const spm = await this.ctPaymentMethodService.save({ /* unchanged */ });
await this.createRecurringPaymentJobIfApplicable(payment.id, spm.id);
```

5. Do the same when the shopper pays a recurring cart with an already saved card. Add the call to `processStoredPayment` or to the webhook path.
6. Add the API client permission. In `status()`, add the scope to the list. Also add it to the scopes text of `CTP_CLIENT_ID` in `connect.yaml` and to the README.

```ts
requiredPermissions: [
  // existing permissions
  'manage_recurring_payment_jobs',
],
```

</details>

## Payment operations

These operations run from commercetools Checkout through `POST /operations/payment-intents/:id`.

- [x] Capture, which takes the money from an authorized payment. Partial amounts work.
- [x] Refund, which returns money to the shopper. Partial amounts work.
- [x] Void, which cancels an authorization. It always cancels the full amount.
- [x] Reverse, which refunds or cancels the whole payment, depending on its state.
- [x] Capture timing for each channel: manual, immediate, or delayed by a number of hours.
- [ ] Several partial captures on one payment. See [Nice to have](#nice-to-have-for-composable-commerce).

## Platform features

- [x] Payment sessions: the connector creates a Checkout.com session and a commercetools Payment for each checkout.
- [x] Webhooks: Checkout.com sends payment events and the connector updates commercetools. The connector checks the signature (HMAC, a keyed hash) of each request. It handles approved, declined, canceled, expired, captured, refunded, and voided events, and their failed variants.
- [x] Multi-channel: one connector can use several Checkout.com accounts. It picks the account from the cart.
- [x] Merchant-specific hosts (MSSD): each channel can call its own Checkout.com hosts.
- [x] Status check: `GET /operations/status` reports commercetools permissions and the Checkout.com connection.
- [x] Component list and public configuration for the shop: `/operations/payment-components` and `/operations/config`.
- [x] Authentication with commercetools sessions, JWT, and OAuth.
- [x] Interface interactions: the connector saves each request and response on the Payment. A setting turns this off.
- [x] Card details for saved cards: brand, last four digits, and expiry date, saved with the payment method.

## Pending work

### Required for commercetools Checkout

- [ ] Express checkout. See [Checkout experience](#checkout-experience).
- [ ] Recurring orders. See [Recurring orders](#recurring-orders).


### Nice to have for composable commerce

Checkout.com decides which of these features to offer.

- [ ] Dropin: one prebuilt form that shows many payment methods. Only web components exist today.
- [ ] Save a new card with a zero-amount check. The shopper can then change the payment method of a recurring order without a purchase.
- [ ] Payments that start from the server through an API, similar to `POST /operations/transactions`, when that API is not enough. Also payments that an agent enters for a shopper, if Checkout.com supports them.
- [ ] Several partial captures on one payment, and any other Checkout.com payment feature that Checkout.com wants to offer.

