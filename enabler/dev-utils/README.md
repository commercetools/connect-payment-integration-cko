# Demo Store - Development Utilities

This directory contains demo store pages and utilities for **development and testing purposes only**. These files are NOT included in the connector build.

## 📁 Files

### Demo Store Pages
- `index.html` - Main checkout demo page
- `payments-management.html` - Payment management interface
- `demo-store-styles.css` - Shared styles for demo pages
- `payments-management-styles.css` - Payment management specific styles

### JavaScript Modules
- `checkout-main.js` - Main checkout orchestration logic
- `checkout-ui.js` - UI components and helpers
- `payments-management.js` - Payment management application
- `api.js` - CommerceTools API integration
- `session.js` - Session management utilities

## 🚀 Usage

### Development Server
```bash
npm run dev
```

Access:
- Checkout Demo: `http://localhost:3000/`
- Payment Management: `http://localhost:3000/payments-management.html`

### Production Build
The connector build (`npm run build`) only includes:
- `src/main.ts` → Compiled to `public/connector-enabler.{es,umd}.js`

**These demo files are excluded from the build** and will not be published with the connector.

## ⚙️ Configuration

### Payment Interface Filter
The payment management page filters payments by `paymentInterface`. This is configurable via environment variable:

```bash
VITE_PAYMENT_INTERFACE=checkout-cko
```

Default: `checkout-cko`

This ensures only payments created with this connector are displayed.

## 📦 Build Exclusion

The demo store files are automatically excluded from the connector build because:

1. **Vite Configuration** (`vite.config.ts`):
   - Only builds `src/main.ts`
   - Output: `public/connector-enabler.{es,umd}.js`

2. **Source Structure**:
   - Connector source: `src/` ✅ (included in build)
   - Demo utilities: `dev-utils/` ❌ (excluded from build)

3. **HTML Files**:
   - Served by dev server for testing
   - Not processed by Vite build
   - Not published with connector

## 🔧 Development Workflow

1. **Create/Test Payments**: Use `index.html` checkout demo
2. **Manage Payments**: Use `payments-management.html` to:
   - View all payments
   - Filter by status/type
   - Execute actions (capture, refund, etc.)
3. **Build Connector**: Run `npm run build`
   - Demo files are automatically excluded
   - Only connector code is built

## ⚠️ Important Notes

- These are **development tools only**
- Do not modify for production use
- The connector itself (`src/main.ts`) is independent of these files
- Payments API integration is for demo purposes
- Filter by `paymentInterface` ensures isolation from other connectors
