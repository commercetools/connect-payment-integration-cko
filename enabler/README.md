# Connector Enabler

Frontend module for the Checkout.com payment connector. Provides a JavaScript library that integrates [Checkout.com Flow](https://www.checkout.com/docs/payments/accept-payments/accept-a-payment-on-your-website/get-started-with-flow) web components into your checkout experience.

## Overview

The enabler wraps Checkout.com's Flow library, which provides:

- **Pre-built Payment Components**: Secure, PCI-compliant UI components for collecting payment details
- **Hosted Payment Fields**: Card inputs and payment method forms rendered by Checkout.com
- **Digital Wallets**: Apple Pay and Google Pay integration
- **Alternative Payment Methods**: Support for Klarna, PayPal, SEPA, iDEAL, and more
- **Stored Payment Methods**: Ability to display and use previously saved payment instruments

By using the enabler, you maintain control over when and how payment components load in your checkout flow, while Checkout.com handles the secure collection and tokenization of sensitive payment data.

## Considerations for Apple Pay and Google Pay

### Apple Pay Requirements

To enable Apple Pay, you must ensure the following conditions are satisfied:

1. **Domain Registration with Checkout.com**:
   - Register your domain with Checkout.com via their dashboard
   - Checkout.com will handle the Apple Pay domain verification process
   - For details, refer to [Checkout.com's Apple Pay documentation](https://www.checkout.com/docs/payments/payment-methods/wallets/apple-pay)

2. **Testing Requirements**:
   - You need an **iOS device** running iOS 11.3 or later, or a **Mac** running macOS 11.3 or later with Safari
   - The browser must be configured with an active card in Apple Wallet
   - For sandbox testing, configure your device with a test card
   - All webpages hosting an Apple Pay button must use HTTPS

3. **Checkout.com Account Configuration**:
   - Ensure your Checkout.com account has Apple Pay enabled (configured via your Checkout.com dashboard)
   - Verify your merchant settings include Apple Pay as an available payment method

### Google Pay Requirements

To enable Google Pay, you must ensure the following conditions are satisfied:

1. **Testing Requirements**:
   - Use **Chrome browser** on any device (mobile or desktop) supporting Google Pay
   - Add a payment method (card) to your Google Pay account
   - For sandbox testing, configure your Google account with test cards

2. **Checkout.com Account Configuration**:
   - Ensure **Google Pay** is enabled via your Checkout.com dashboard
   - Checkout.com automatically manages domain validation for Google Pay—no manual setup is required
   - Verify your merchant settings include Google Pay as an available payment method

## Getting Started

Please run the following npm commands under the `enabler` folder for development work in local environment.

### Install dependencies
```bash
npm install
```

### Build the application
NodeJS source codes are generated under the `public` folder:
```bash
npm run build
```

### Run development server
The development site is available at http://localhost:3000/:
```bash
npm run dev
```

### Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
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
