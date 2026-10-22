# Connector Processor

Backend service for the Checkout.com payment connector. It handles payment sessions, stored payment methods, payment operations, and webhook processing.

## Overview

The processor is middleware between commercetools and Checkout.com. It provides:

- Payment session creation and submit
- Stored payment method management
- Payment operations (capture, void, refund, reverse)
- Webhook event processing
- Multi-channel configuration support
- Merchant Center integration

The processor does not support these features yet:

- Recurring payments. The processor does not charge recurring payments and does not create the recurring payment job.
- Express checkout. `GET /operations/payment-components` returns `express: []`.
- `POST /operations/transactions`. The route has the contract of the connector template, but it always returns HTTP 501 `NotImplemented`.

## API Endpoints

### Payment Operations

#### Get Configuration
```
GET /operations/config
Headers:
  - x-session-id: <session-id>
```
Returns the public configuration for the enabler.

#### Create Payment Session
```
POST /payment-sessions
Headers:
  - x-session-id: <session-id>
Body: {
  "locale"?: string
}
```
Creates a Checkout.com payment session and a commercetools payment. The processor reads the amount and the currency from the cart in the session.

**Response:**
```json
{
  "id": "string",
  "payment_session_token": "string",
  "payment_session_secret": "string",
  "paymentReference": "string"
}
```

#### Complete Payment Session
```
POST /payment-sessions/:id
Headers:
  - x-session-id: <session-id>
Body: {
  "paymentReference": "string",
  "session_data":  "string",
  "storePaymentMethod"?: boolean
}
```
Submits the payment to Checkout.com and updates the commercetools payment.

**Response:**
```json
{
  "id": "string",
  "status": "string",
  "type": "string",
  "paymentReference": "string",
  "action"?: {
    "type": "redirect",
    "url": "string"
  }
}
```

#### Confirm Payment
```
GET /payment-sessions/confirm
Query Parameters:
  - paymentReference: string
  - success: boolean
  - cko-payment-id: string
  - x-session-id: string
```
Confirms the payment after a redirect and redirects the customer to the merchant return URL. Checkout.com calls this endpoint after 3DS (a card authentication step) or other redirect flows. The request carries the session in the query parameters.

### Stored Payment Methods

#### List Stored Payment Methods
```
GET /stored-payment-methods
Headers:
  - x-session-id: <session-id>
  - Authorization: Bearer <session-token>
```
Returns the saved payment methods of the customer. The processor reads the customer ID from the session.

**Response:**
```json
{
  "storedPaymentMethods": [
    {
      "id": "string",
      "type": "string",
      "isDefault": boolean,
      "createdAt": "string",
      "displayOptions": {
        "endDigits"?: "string",
        "brand"?: {
          "key": "string"
        },
        "expiryMonth"?: number,
        "expiryYear"?: number,
        "logoUrl"?: "string"
      }
    }
  ]
}
```

#### Process Payment with Stored Method
```
POST /stored-payment-methods/:id/payments
Headers:
  - x-session-id: <session-id>

Body: {
  "paymentReference": "string"
}
```
Processes a payment with a saved payment method.

**Response:**
```json
{
  "id": "string",
  "status": "string",
  "type"?: "string",
  "paymentReference": "string",
  "action"?: {
    "type"?: "string",
    "url": "string"
  }
}
```

#### Confirm Stored Payment
```
GET /stored-payment-methods/:id/payments/confirm
Query Parameters:
  - paymentReference: string
  - success: boolean
  - cko-session-id?: string
  - x-session-id: string
```
Confirms the stored payment after a redirect and redirects the customer to the merchant return URL.

#### Delete Stored Payment Method
```
DELETE /stored-payment-methods/:id
Headers:
  - x-session-id: <session-id>
```
Deletes a saved payment method from Checkout.com and from commercetools.

### Payment Modifications

#### Execute Payment Operation
```
POST /operations/payment-intents/:id
Headers:
  - Authorization: Bearer <oauth-token>
Body: {
  "actions": [
    {
      "action": "capturePayment" | "cancelPayment" | "refundPayment" | "reversePayment",
      "amount"?: {
        "centAmount": number,
        "currencyCode": "string"
      },
      "merchantReference"?: "string",
      "transactionId"?: "string"
    }
  ]
}
```
Runs a capture, cancel (void), refund, or reverse operation on a payment.

**Notes:**
- `amount` is required for `capturePayment` and `refundPayment`
- `amount` is not used for `cancelPayment` and `reversePayment`
- `transactionId` is optional for `refundPayment` to refund a specific transaction
- `merchantReference` is optional for all actions

**Response:**
```json
{
  "outcome": "approved" | "rejected" | "received"
}
```

### Webhooks

#### Process Webhook
```
POST /notifications
Headers:
  - cko-signature: <hmac-signature>
Body: <Checkout.com webhook payload>
```
Processes Checkout.com webhook events and updates commercetools payments. The processor checks the HMAC signature (a keyed hash of the body) of each request.

The processor supports these events:
- `payment_approved`
- `payment_declined`
- `payment_canceled`
- `payment_expired`
- `payment_captured`
- `payment_capture_declined`
- `payment_refunded`
- `payment_refund_declined`
- `payment_voided`
- `payment_void_declined`

### Merchant Center Integration

#### Health Check
```
GET /operations/status
Headers:
  - Authorization: Bearer <jwt-token>
```
Makes sure that the processor can connect to commercetools and Checkout.com. Merchant Center uses this endpoint. The check needs these API client scopes: `manage_payments`, `view_sessions`, `view_api_clients`, `view_customers`, `manage_orders`, `introspect_oauth_tokens`, `manage_checkout_payment_intents`, `manage_types`, and `manage_payment_methods`.

#### Get Payment Components
```
GET /operations/payment-components
Headers:
  - Authorization: Bearer <jwt-token>
```
Returns the Checkout.com payment methods that you can configure. The `express` list is empty because express checkout is not supported.

## Authentication

The processor supports these authentication mechanisms:

### 1. OAuth2 (Payment Operations)
Used for the payment modification endpoints. The commercetools API client needs these scopes:
- `manage_checkout_payment_intents` for `/operations/payment-intents/:id`
- `manage_checkout_transactions` for `/operations/transactions` (the endpoint returns HTTP 501 today)

### 2. Session Token (Enabler Integration)
Used for the payment session, stored payment method, and `/operations/config` endpoints. You create the session with the commercetools Session API. The confirm endpoints read the session from the query parameters.

### 3. JWT (Merchant Center)
Used for the Merchant Center endpoints (`/operations/status`, `/operations/payment-components`). The Merchant Center forward-to proxy adds the JWT.

### 4. HMAC (Webhooks)
Used for `/notifications`. The processor checks the `cko-signature` header with the HMAC key of the channel.

**Local Development with JWT:**

```bash
# Set JWKS URL
export CTP_JWKS_URL="http://localhost:9002/jwt/.well-known/jwks.json"

# Start the JWT mock server (from the root directory)
# The mock code is in docker-dev/jwt-mock and it listens on port 9002
docker compose up -d jwt-server

# Request a test token
curl http://localhost:9002/jwt/token \
  -H "Content-Type: application/json" \
  -d '{
    "iss": "https://mc-api.europe-west1.gcp.commercetools.com",
    "sub": "subject",
    "https://mc-api.europe-west1.gcp.commercetools.com/claims/project_key": "<project-key>"
  }'

# Use the token in requests
curl http://localhost:8080/operations/status \
  -H "Authorization: Bearer <token>"
```

## Local Development

### Environment Setup

1. Use Node 24. The `.nvmrc` file in the root directory sets the version. The `engines` field in `package.json` needs Node 24 or later.

2. Copy the environment template:
```bash
cp .env.template .env
```

3. Set the environment variables (see the Configuration section below).

4. Install dependencies:
```bash
npm install
```

### Running the Application

Development mode:
```bash
npm run dev
```

Production build:
```bash
npm run build
npm start
```

The processor listens on port `8080`.

### Testing

The tests use Vitest. They use `msw` to mock HTTP calls.

Run all tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Run tests with coverage:
```bash
npm run test:coverage
```

### Code Quality

Lint code:
```bash
npm run lint
```

Fix lint issues:
```bash
npm run lint:fix
```

Format code:
```bash
npm run format
```

## Configuration

The processor needs these environment variables. The `connect.yaml` file in the root directory lists them for deployment.

### commercetools
- `CTP_PROJECT_KEY` - Project key
- `CTP_CLIENT_ID` - API client ID. The client needs the scopes in the Health Check section and `manage_checkout_transactions`
- `CTP_CLIENT_SECRET` - API client secret
- `CTP_API_URL` - API URL (e.g., https://api.europe-west1.gcp.commercetools.com)
- `CTP_AUTH_URL` - Auth URL (e.g., https://auth.europe-west1.gcp.commercetools.com)
- `CTP_SESSION_URL` - Session URL (e.g., https://session.europe-west1.gcp.commercetools.com)
- `CTP_CHECKOUT_URL` - Checkout URL (e.g., https://checkout.europe-west1.gcp.commercetools.com). The default is the europe-west1 URL
- `CTP_JWKS_URL` - JWKS URL for JWT validation
- `CTP_JWT_ISSUER` - JWT issuer

### Checkout.com
- `CKO_CONFIG` - JSON configuration (see main README for structure). Each channel accepts an optional `clientId` (see MSSD below)
- `CKO_ENVIRONMENT` - Environment: `sandbox` or `production`

### Application
- `MERCHANT_RETURN_URL` - URL where the customer returns after the payment
- `HEALTH_CHECK_TIMEOUT` - Health check timeout in ms (default: 5000)
- `LOGGER_LEVEL` - Log level: `trace`, `debug`, `info`, `warn`, `error`, or `fatal` (default: `info`)

### Merchant-specific sub-domains (MSSD)

MSSD gives each Checkout.com client its own API and Access hosts. Clients created on or after 1 October 2026 must call their own hosts instead of the shared ones. Earlier clients can migrate at any time.

| Environment | API | Access (OAuth) |
| --- | --- | --- |
| Production | `https://{prefix}.api.checkout.com` | `https://{prefix}.access.checkout.com` |
| Sandbox | `https://{prefix}.api.sandbox.checkout.com` | `https://{prefix}.access.sandbox.checkout.com` |

`{prefix}` is the first 8 characters of the Checkout.com client ID after `cli_`, in lowercase (for example `cli_vkuhvk4vjn2edkps7dfsq6emqm` gives `vkuhvk4v`).
Production and sandbox have different client IDs. Make sure that `CKO_ENVIRONMENT` and the client ID are for the same environment.

Each channel in `CKO_CONFIG` (`default` and each entry of `channels`) accepts these fields:

- `clientId` (optional): Checkout.com client ID. The connector derives the prefix and uses the matching hosts for the API calls of the channel. A value that is not `cli_` followed by at least 8 alphanumeric characters stops the connector at startup with `Invalid CKO_CONFIG for channel "<key>": Invalid Checkout.com client ID ...`.
- `apiBaseUrl` and `accessBaseUrl` (optional): explicit host overrides for the case that Checkout.com changes the format. They take precedence over the derived hosts. They must use https and must be `checkout.com` hosts. The connector rejects a sandbox host in production and a production host in sandbox.
- If a channel has no `clientId` and no overrides, the connector uses the shared hosts (`api(.sandbox).checkout.com`). This is correct for clients created before 1 October 2026.

A channel that the cart context selects uses only its own `clientId` and overrides. It does not inherit them from `default`.
If a new client calls the shared host, the call fails with HTTP 403 `base_url_invalid` (API) or HTTP 400 `invalid_context` (Access).

Notes:
- The connector authenticates with the secret key as a bearer token, so the connector resolves the Access host (`getConfig().getAccessBaseUrl()`) but does not call it today.
- `/balances` has no MSSD enforcement. The connector does not call it.
- The Checkout.com Flow web components (`@checkout.com/checkout-web-components`) take no host option. They work with the payment session that the connector creates on the merchant-specific host.
- Handover note: there are no existing merchants in commercetools, so the exemption for earlier clients does not apply here.

## Deployment Scripts

### Post-Deploy
Runs automatically after the connector deployment:
```bash
npm run connector:post-deploy
```

Creates the commercetools custom types for payment methods and interface interactions.

### Pre-Undeploy
Runs automatically before the connector undeployment:
```bash
npm run connector:pre-undeploy
```

Deletes the custom types that the connector created.

## Error Handling

The processor returns these HTTP status codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (invalid authentication)
- `404` - Not Found (resource does not exist)
- `409` - Conflict (version mismatch)
- `500` - Internal Server Error
- `501` - Not Implemented (`POST /operations/transactions`)

Error responses include:
```json
{
  "message": "Error description",
  "errors": [
    {
      "code": "error_code",
      "message": "Detailed error message"
    }
  ]
}
```

## Multi-Channel Support

The processor selects the Checkout.com channel configuration from the cart context. See the main README for the multi-channel configuration.
