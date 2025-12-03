# Connector Processor

Backend service for the Checkout.com payment connector. Handles payment sessions, stored payment methods, payment operations, and webhook processing.

## Overview

The processor acts as a middleware between commercetools and Checkout.com, providing:

- Payment session creation and submit
- Stored payment method management
- Payment operations (capture, void, refund, reverse)
- Webhook event processing
- Multi-channel configuration support
- Merchant Center integration

## API Endpoints

### Payment Operations

#### Get Configuration
```
GET /operations/config
Headers:
  - x-session-id: <session-id>
```
Returns public configuration for the enabler.

#### Create Payment Session
```
POST /payment-sessions
Headers:
  - x-session-id: <session-id>
Body: {
  "locale"?: string
}
```
Creates a new Checkout.com payment session and commercetools payment. Amount and currency are extracted from the cart in the session.

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
```
Submits payment to Checkout.com and updates commercetools payment.

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
Confirms payment after redirect and redirects to merchant return URL. Called by Checkout.com after 3DS or other redirect flows.

### Stored Payment Methods

#### List Stored Payment Methods
```
GET /stored-payment-methods
Headers:
  - x-session-id: <session-id>
  - Authorization: Bearer <session-token>
```
Returns list of saved payment methods for the customer. Customer ID is extracted from the session.

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
Processes a payment using a previously saved payment method. 

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
Confirms stored payment after redirect and redirects to merchant return URL.

#### Delete Stored Payment Method
```
DELETE /stored-payment-methods/:id
Headers:
  - x-session-id: <session-id>
```
Deletes a saved payment method from both Checkout.com and commercetools.

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
Executes capture, cancel (void), refund, or reverse operations on a payment.

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
Processes Checkout.com webhook events and updates commercetools payments.

Supported events:
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
GET /status
Headers:
  - Authorization: Bearer <jwt-token>
```
Verifies connectivity to commercetools and Checkout.com. Used by Merchant Center.

#### Get Payment Components
```
GET /payment-components
Headers:
  - Authorization: Bearer <jwt-token>
```
Returns list of available Checkout.com payment methods for configuration.

## Authentication

The processor supports three authentication mechanisms:

### 1. OAuth2 (Payment Operations)
Used for payment modification endpoints (`/operations/payment-intents/:id`, `/operations/transactions`). Requires commercetools API client with scopes:
- `manage_checkout_payment_intents`
- `manage_checkout_transactions`


### 2. Session Token (Enabler Integration)
Used for payment session and stored payment method endpoints. Requires session created via commercetools Session API.

### 3. JWT (Merchant Center)
Used for Merchant Center integration endpoints (`/status`, `/payment-components`). JWT is injected by Merchant Center forward-to proxy.

**Local Development with JWT:**

```bash
# Set JWKS URL
export CTP_JWKS_URL="http://localhost:9002/.well-known/jwks.json"

# Start JWT mock server (from root directory)
docker compose up -d

# Request test token
curl http://localhost:9002/token \
  -H "Content-Type: application/json" \
  -d '{
    "iss": "https://mc-api.europe-west1.gcp.commercetools.com",
    "sub": "subject",
    "https://mc-api.europe-west1.gcp.commercetools.com/claims/project_key": "<project-key>"
  }'

# Use token in requests
curl http://localhost:8080/status \
  -H "Authorization: Bearer <token>"
```

## Local Development

### Environment Setup

1. Copy environment template:
```bash
cp .env.template .env
```

2. Configure environment variables (see Configuration section below)

3. Install dependencies:
```bash
npm install
```

### Running the Application

Development mode with hot reload:
```bash
npm run dev
```

Production build:
```bash
npm run build
npm start
```

The processor runs on port `8080` by default.

### Testing

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

Fix linting issues:
```bash
npm run lint:fix
```

Format code:
```bash
npm run format
```

## Configuration

Required environment variables:

### commercetools
- `CTP_PROJECT_KEY` - Project key
- `CTP_CLIENT_ID` - API client ID
- `CTP_CLIENT_SECRET` - API client secret
- `CTP_API_URL` - API URL (e.g., https://api.europe-west1.gcp.commercetools.com)
- `CTP_AUTH_URL` - Auth URL (e.g., https://auth.europe-west1.gcp.commercetools.com)
- `CTP_SESSION_URL` - Session URL (e.g., https://session.europe-west1.gcp.commercetools.com)
- `CTP_JWKS_URL` - JWKS URL for JWT validation
- `CTP_JWT_ISSUER` - JWT issuer

### Checkout.com
- `CKO_CONFIG` - JSON configuration (see main README for structure)
- `CKO_ENVIRONMENT` - Environment: `sandbox` or `production`

### Application
- `MERCHANT_RETURN_URL` - URL to redirect after payment
- `HEALTH_CHECK_TIMEOUT` - Health check timeout in ms (default: 10000)
- `LOGGER_LEVEL` - Log level: `error`, `warn`, `info`, or `debug`

## Deployment Scripts

### Post-Deploy
Runs automatically after connector deployment:
```bash
npm run connector:post-deploy
```

Creates required commercetools custom types for payment methods and interface interactions.

### Pre-Undeploy
Runs automatically before connector undeployment:
```bash
npm run connector:pre-undeploy
```

Cleans up custom types created by the connector.

## Error Handling

The processor returns standard HTTP status codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (invalid authentication)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (version mismatch)
- `500` - Internal Server Error

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

The processor automatically selects the appropriate Checkout.com channel configuration based on cart context. See main README for multi-channel configuration details.
