/**
 * Checkout UI Components and Helpers
 * This module contains all UI-related functions for the checkout process
 */

// DOM element references (will be initialized on load)
let paymentComponentsArea;
let savedMethodsList;
let availableMethodsList;
let paymentPlaceholder;
let spinner;
let methodsDivider;

/**
 * Initialize UI module with DOM references
 */
const initializeUI = (elements) => {
  paymentComponentsArea = elements.paymentComponentsArea;
  savedMethodsList = elements.savedMethodsList;
  availableMethodsList = elements.availableMethodsList;
  paymentPlaceholder = elements.paymentPlaceholder;
  spinner = elements.spinner;
  methodsDivider = elements.methodsDivider;
};

/**
 * Show toast notification
 */
const showToast = (message, type = "info", duration = 5000) => {
  const container = document.getElementById("toastContainer") || createToastContainer();

  const toast = document.createElement("div");
  toast.className = `toast-notification ${type}`;

  const icons = {
    error: "✕",
    success: "✓",
    warning: "⚠",
    info: "ℹ",
  };

  const titles = {
    error: "Error",
    success: "Success",
    warning: "Warning",
    info: "Info",
  };

  toast.innerHTML = `
    <div class="toast-icon">${icons[type]}</div>
    <div class="toast-content">
      <div class="toast-title">${titles[type]}</div>
      <p class="toast-message">${message}</p>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  container.appendChild(toast);

  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => {
      toast.classList.add("hiding");
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
};

/**
 * Create toast container if it doesn't exist
 */
const createToastContainer = () => {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  return container;
};

/**
 * Show error toast (replaces alert)
 */
const showErrorToast = (message) => {
  showToast(message, "error", 6000);
};

/**
 * Show success toast
 */
const showSuccessToast = (message) => {
  showToast(message, "success", 4000);
};

/**
 * Show warning toast
 */
const showWarningToast = (message) => {
  showToast(message, "warning", 5000);
};

/**
 * Show info toast
 */
const showInfoToast = (message) => {
  showToast(message, "info", 4000);
};

/**
 * Create a saved payment method item in the sidebar
 */
const createSavedMethodItem = (saved, onSelectCallback) => {
  const item = document.createElement("div");
  item.className = "payment-method-item saved";
  item.dataset.savedId = saved.id;

  const endDigits = saved.displayOptions?.endDigits || "••••";
  const brand = saved.displayOptions?.brand?.key || saved.type;
  const expiryMonth = saved.displayOptions?.expiryMonth;
  const expiryYear = saved.displayOptions?.expiryYear;
  const expiry = expiryMonth && expiryYear ? `${expiryMonth}/${expiryYear}` : "";

  item.innerHTML = `
    <span class="saved-badge">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    </span>
    <p class="payment-method-name">${brand.toUpperCase()} •••• ${endDigits}</p>
    ${expiry ? `<p class="payment-method-details">Expires ${expiry}</p>` : ""}
  `;

  item.addEventListener("click", () => onSelectCallback(saved.id));
  savedMethodsList.appendChild(item);
};

/**
 * Create saved payment method container with pay button
 */
const createSavedMethodContainer = (saved, onDeleteCallback) => {
  const wrapper = document.createElement("div");
  wrapper.className = "payment-component-wrapper";
  wrapper.id = `saved-method-${saved.id}`;

  // Get card brand - handle both string and object
  const brandData = saved.displayOptions?.brand;
  const cardBrand = typeof brandData === "string" ? brandData : brandData?.key || saved.type;
  const endDigits = saved.displayOptions?.endDigits || "••••";

  // Build expiry date from month and year
  const expiryMonth = saved.displayOptions?.expiryMonth;
  const expiryYear = saved.displayOptions?.expiryYear;
  const expiryDate = expiryMonth && expiryYear ? `${String(expiryMonth).padStart(2, "0")}/${expiryYear}` : "N/A";

  wrapper.innerHTML = `
    <h5>Payment Details</h5>
    <div class="payment-details-content">
      <div class="saved-method-display">
        <div class="saved-method-header">
          <div class="saved-method-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M20 6L9 17l-5-5"></path>
            </svg>
            <span>Saved Payment</span>
          </div>
          <button class="btn-delete-saved-method" id="delete-saved-${saved.id}" title="Delete this payment method">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
        <div class="saved-method-info">
          <div class="saved-method-icon">💳</div>
          <div class="saved-method-details">
            <strong>${cardBrand.toUpperCase()} •••• ${endDigits}</strong>
            <span>Expires ${expiryDate}</span>
          </div>
        </div>
        <div class="saved-method-footer">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <span>Securely stored and ready to use</span>
        </div>
      </div>
      <div class="form-group form-check" style="margin: 0 30px 15px 30px;">
        <input type="checkbox" class="form-check-input" id="termsCheckbox-saved-${saved.id}" required />
        <label class="form-check-label" for="termsCheckbox-saved-${saved.id}">
          I agree to the terms and conditions
        </label>
      </div>
      <button class="btn btn-primary btn-block btn-lg payment-submit-btn" id="pay-saved-${saved.id}" style="margin: 0 30px 30px 30px; width: calc(100% - 60px);">
        <span class="btn-spinner"></span>
        <span class="btn-text">Pay Now</span>
      </button>
    </div>
  `;

  paymentComponentsArea.appendChild(wrapper);

  // Add click handler for delete button
  document.getElementById(`delete-saved-${saved.id}`).addEventListener("click", () => {
    if (confirm(`Are you sure you want to delete this saved payment method?\n${cardBrand.toUpperCase()} •••• ${endDigits}`)) {
      onDeleteCallback(saved.id);
    }
  });

  // Add click handler for pay button - USE TOAST INSTEAD OF ALERT
  document.getElementById(`pay-saved-${saved.id}`).addEventListener("click", () => {
    if (!document.getElementById(`termsCheckbox-saved-${saved.id}`).checked) {
      showWarningToast("You must agree to the terms and conditions.");
      return;
    }
    showInfoToast("Payment with saved method not yet implemented");
  });
};

/**
 * Create a payment method item in the sidebar
 */
const createPaymentMethodItem = (type, meta, onSelectCallback) => {
  const item = document.createElement("div");
  item.className = "payment-method-item";
  item.dataset.type = type;

  item.innerHTML = `
    <p class="payment-method-name">${type.charAt(0).toUpperCase() + type.slice(1)}</p>
  `;

  item.addEventListener("click", () => onSelectCallback(type));
  availableMethodsList.appendChild(item);
};

/**
 * Create payment method container for component mounting
 */
const createPaymentMethodContainer = (type) => {
  const wrapper = document.createElement("div");
  wrapper.className = "payment-component-wrapper";
  wrapper.id = `payment-method-${type}`;

  wrapper.innerHTML = `
    <h5>Payment Details</h5>
    <div class="payment-component-container" id="component-${type}"></div>
    <div id="storePaymentMethod-container-${type}" class="form-group form-check hidden">
      <input type="checkbox" class="form-check-input" id="storePaymentMethod-${type}" />
      <label class="form-check-label" for="storePaymentMethod-${type}">
        Save payment method for future use
      </label>
    </div>
    <div class="form-group form-check">
      <input type="checkbox" class="form-check-input" id="termsCheckbox-${type}" required />
      <label class="form-check-label" for="termsCheckbox-${type}">
        I agree to the terms and conditions
      </label>
    </div>
    <div id="payment-button-container-${type}"></div>
  `;

  paymentComponentsArea.appendChild(wrapper);
};

/**
 * Show specific payment container
 */
const showPaymentContainer = (containerId) => {
  paymentPlaceholder.classList.add("hidden");

  // Hide all payment containers
  document.querySelectorAll(".payment-component-wrapper").forEach((wrapper) => {
    wrapper.classList.remove("active");
  });

  // Show selected container
  document.getElementById(containerId)?.classList.add("active");
};

/**
 * Clear all payment method selections
 */
const clearSelection = () => {
  document.querySelectorAll(".payment-method-item").forEach((item) => {
    item.classList.remove("selected");
  });

  // Hide all payment containers
  document.querySelectorAll(".payment-component-wrapper").forEach((wrapper) => {
    wrapper.classList.remove("active");
  });

  paymentPlaceholder.classList.remove("hidden");
};

/**
 * Clear all payment methods from the UI
 */
const clearPaymentMethods = () => {
  savedMethodsList.innerHTML = "";
  availableMethodsList.innerHTML = "";
  paymentComponentsArea.innerHTML = "";
  methodsDivider.classList.add("hidden");
  paymentPlaceholder.classList.remove("hidden");
};

/**
 * Show loading spinner
 */
const showSpinner = () => {
  paymentPlaceholder.classList.add("hidden");
  spinner.classList.remove("hidden");
};

/**
 * Hide loading spinner
 */
const hideSpinner = () => {
  spinner.classList.add("hidden");
};

/**
 * Show success modal
 */
const showSuccess = (message) => {
  const referenceEl = document.getElementById("successReference");
  referenceEl.textContent = message;
  $("#successModal").modal("show");
};

/**
 * Show error modal
 */
const showError = (message) => {
  const errorMessageEl = document.getElementById("errorMessage");
  errorMessageEl.textContent = message;
  $("#errorModal").modal("show");
};

/**
 * Handle success modal close
 */
const handleSuccessClose = () => {
  $("#successModal").modal("hide");
  // The main index.html will handle resetCheckoutState()
  // This is just for closing the modal
};

/**
 * Reset entire checkout UI
 */
const resetCheckout = () => {
  clearPaymentMethods();
  clearSelection();
  document.getElementById("cartId").value = "";
};

/**
 * Show cart summary modal with improved visual design
 */
/**
 * Show cart summary modal with improved visual design
 */
const showCartSummary = (cart) => {
  const modal = $("#cartSummaryModal");
  const content = document.getElementById("cartSummaryContent");

  if (!cart) {
    content.innerHTML = '<p class="text-muted">No cart loaded</p>';
    modal.modal("show");
    return;
  }

  // Helper functions
  const formatPrice = (centAmount, currencyCode) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
    }).format(centAmount / 100);
  };

  const getCountryFlag = (countryCode) => {
    const flags = {
      DE: "🇩🇪",
      NL: "🇳🇱",
      ES: "🇪🇸",
      US: "🇺🇸",
      GB: "🇬🇧",
      FR: "🇫🇷",
    };
    return flags[countryCode] || "🌍";
  };

  // Calculate totals
  const subtotal = cart.customLineItems?.reduce((sum, item) => sum + item.money.centAmount * item.quantity, 0) || 0;
  const totalTax = cart.taxedPrice?.totalTax?.centAmount || 0;
  const shippingCost = cart.shippingInfo?.price?.centAmount || 0;
  const grandTotal = cart.totalPrice?.centAmount || 0;

  // Get discount information
  // 1. Discounts from discount codes (line item level)
  const discountCodesAmount =
    cart.discountCodes?.reduce((sum, dc) => {
      const discountAmount = dc.discountedAmount?.centAmount || 0;
      return sum + discountAmount;
    }, 0) || 0;

  // 2. Discounts on total price (cart level)
  const totalPriceDiscountAmount = cart.discountOnTotalPrice?.discountedAmount?.centAmount || 0;

  // 3. Shipping discounts
  const shippingDiscountAmount =
    cart.shippingInfo?.discountedPrice?.includedDiscounts?.reduce((sum, discount) => {
      return sum + (discount.discountedAmount?.centAmount || 0);
    }, 0) || 0;

  // Total discount = all discount types combined
  const totalDiscount = discountCodesAmount + totalPriceDiscountAmount + shippingDiscountAmount;

  // Get custom fields
  const customFields = cart.custom?.fields || {};

  // Update the cart total preview in header button
  const cartTotalPreview = document.getElementById("cartTotalPreview");
  if (cartTotalPreview) {
    cartTotalPreview.textContent = formatPrice(grandTotal, cart.totalPrice.currencyCode);
  }

  // Build the clean summary
  const html = `
    <!-- Cart ID -->
    <div class="cart-summary-intro">
      <strong>Cart ID:</strong> <span class="cart-id-display">${cart.id}</span>
    </div>

    <!-- Meta Information -->
    <div class="cart-meta-section">
      <div class="cart-meta-item">
        <div class="cart-meta-label">Country</div>
        <div class="cart-meta-value">${getCountryFlag(cart.country)} ${cart.country}</div>
      </div>
      <div class="cart-meta-item">
        <div class="cart-meta-label">Currency</div>
        <div class="cart-meta-value">${cart.totalPrice.currencyCode}</div>
      </div>
      <div class="cart-meta-item">
        <div class="cart-meta-label">Items</div>
        <div class="cart-meta-value">${cart.lineItemCount || cart.customLineItems?.length || 0}</div>
      </div>
    </div>

    <!-- Line Items -->
    ${
      cart.customLineItems && cart.customLineItems.length > 0
        ? `
    <div class="line-items-section">
      <h6>Products</h6>
      <table class="line-items-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${cart.customLineItems
            .map(
              (item) => `
            <tr>
              <td class="product-name">${item.name.en || item.name}</td>
              <td>${item.quantity}</td>
              <td>${formatPrice(item.money.centAmount, cart.totalPrice.currencyCode)}</td>
              <td>${formatPrice(item.money.centAmount * item.quantity, cart.totalPrice.currencyCode)}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
    `
        : ""
    }

    <!-- Regular Line Items (if any) -->
    ${
      cart.lineItems && cart.lineItems.length > 0
        ? `
    <div class="line-items-section">
      <h6>Products</h6>
      <table class="line-items-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${cart.lineItems
            .map(
              (item) => `
            <tr>
              <td class="product-name">${item.name[Object.keys(item.name)[0]]}</td>
              <td>${item.quantity}</td>
              <td>${formatPrice(item.price.value.centAmount, cart.totalPrice.currencyCode)}</td>
              <td>${formatPrice(item.totalPrice.centAmount, cart.totalPrice.currencyCode)}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>
    `
        : ""
    }

    <!-- Shipping Address -->
    ${
      cart.shippingAddress
        ? `
    <div class="address-section">
      <h6>Shipping Address</h6>
      <div class="address-text">
        ${cart.shippingAddress.firstName || ""} ${cart.shippingAddress.lastName || ""}<br>
        ${cart.shippingAddress.streetName || ""} ${cart.shippingAddress.streetNumber || ""}<br>
        ${cart.shippingAddress.postalCode || ""} ${cart.shippingAddress.city || ""}<br>
        ${cart.shippingAddress.state ? cart.shippingAddress.state + "<br>" : ""}
        ${cart.shippingAddress.country}
      </div>
    </div>
    `
        : ""
    }

    <!-- Billing Address -->
    ${
      cart.billingAddress
        ? `
    <div class="address-section">
      <h6>Billing Address</h6>
      <div class="address-text">
        ${cart.billingAddress.firstName || ""} ${cart.billingAddress.lastName || ""}<br>
        ${cart.billingAddress.streetName || ""} ${cart.billingAddress.streetNumber || ""}<br>
        ${cart.billingAddress.postalCode || ""} ${cart.billingAddress.city || ""}<br>
        ${cart.billingAddress.state ? cart.billingAddress.state + "<br>" : ""}
        ${cart.billingAddress.country}
      </div>
    </div>
    `
        : ""
    }

    <!-- Custom Fields -->
    ${
      Object.keys(customFields).length > 0
        ? `
    <div class="custom-fields-section">
      <h6>Custom Fields</h6>
      ${Object.entries(customFields)
        .map(
          ([key, value]) => `
        <div class="custom-field-item">
          <span class="custom-field-label">${key}</span>
          <span class="custom-field-value">${value}</span>
        </div>
      `
        )
        .join("")}
    </div>
    `
        : ""
    }

    <!-- Totals (at the end) -->
    <div class="totals-section">
      <h6>Order Summary</h6>
      <div class="total-row">
        <span class="total-label">Subtotal</span>
        <span class="total-value">${formatPrice(subtotal, cart.totalPrice.currencyCode)}</span>
      </div>
      ${
        shippingCost > 0
          ? `
      <div class="total-row">
        <span class="total-label">Shipping</span>
        <span class="total-value">${formatPrice(shippingCost, cart.totalPrice.currencyCode)}</span>
      </div>
      `
          : ""
      }
      ${
        totalDiscount > 0
          ? `
      <div class="total-row discount-row">
        <span class="total-label">Discount</span>
        <span class="total-value">-${formatPrice(totalDiscount, cart.totalPrice.currencyCode)}</span>
      </div>
      `
          : ""
      }
      ${
        totalTax > 0
          ? `
      <div class="total-row">
        <span class="total-label">Tax</span>
        <span class="total-value">${formatPrice(totalTax, cart.totalPrice.currencyCode)}</span>
      </div>
      `
          : ""
      }
      <div class="total-row grand-total">
        <span class="total-label">Total</span>
        <span class="total-value">${formatPrice(grandTotal, cart.totalPrice.currencyCode)}</span>
      </div>
    </div>
  `;

  content.innerHTML = html;
  modal.modal("show");
};

// Export all UI functions
export {
  initializeUI,
  createSavedMethodItem,
  createSavedMethodContainer,
  createPaymentMethodItem,
  createPaymentMethodContainer,
  showPaymentContainer,
  clearSelection,
  clearPaymentMethods,
  showSpinner,
  hideSpinner,
  showSuccess,
  showError,
  showCartSummary,
  showToast,
  showErrorToast,
  showSuccessToast,
  showWarningToast,
  showInfoToast,
};
