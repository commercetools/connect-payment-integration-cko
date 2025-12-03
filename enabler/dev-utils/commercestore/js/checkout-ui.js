/**
 * Checkout UI Components and Helpers
 * This module contains all UI-related functions for the checkout process
 */

/**
 * Copy text to clipboard
 */
const copyToClipboard = (text, button) => {
  navigator.clipboard.writeText(text).then(() => {
    const originalContent = button.innerHTML;
    button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#078b5c" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    setTimeout(() => button.innerHTML = originalContent, 1500);
  }).catch(err => {
    console.error('Failed to copy:', err);
  });
};

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
 * Show confirmation dialog
 */
const showConfirmDialog = (title, message, onConfirm) => {
  const modalId = 'confirmDialog';
  
  // Remove existing dialog if any
  const existing = document.getElementById(modalId);
  if (existing) {
    existing.remove();
  }

  // Create modal HTML
  const modalHTML = `
    <div class="modal fade" id="${modalId}" tabindex="-1" role="dialog" aria-labelledby="${modalId}Label" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="${modalId}Label">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc3545" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              ${title}
            </h5>
            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <div class="modal-body">
            <p>${message}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-danger" id="${modalId}ConfirmBtn">Delete</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Add modal to body
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Get modal element
  const modalElement = document.getElementById(modalId);
  
  // Add confirm handler
  document.getElementById(`${modalId}ConfirmBtn`).addEventListener('click', () => {
    $(`#${modalId}`).modal('hide');
    onConfirm();
  });

  // Clean up when modal is hidden
  $(`#${modalId}`).on('hidden.bs.modal', function () {
    modalElement.remove();
  });

  // Show modal
  $(`#${modalId}`).modal('show');
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
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
        <line x1="1" y1="10" x2="23" y2="10"></line>
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
const createSavedMethodContainer = (saved, onDeleteCallback, onPayCallback) => {
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
    <div class="payment-details-content">
      <div class="saved-method-display">
        <div class="saved-method-info">
          <div class="saved-method-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
              <line x1="1" y1="10" x2="23" y2="10"></line>
            </svg>
          </div>
          <div class="saved-method-details">
            <strong>${cardBrand.toUpperCase()} •••• ${endDigits}</strong>
            <span>Expires ${expiryDate}</span>
          </div>
          <button class="btn-delete-saved-method" id="delete-saved-${saved.id}" title="Delete this payment method">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
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
      <button class="btn btn-primary btn-block btn-lg payment-submit-btn" id="pay-saved-${
        saved.id
      }" style="margin: 0 30px 30px 30px; width: calc(100% - 60px);">
        <span class="btn-spinner"></span>
        <span class="btn-text">Pay Now</span>
      </button>
    </div>
  `;

  paymentComponentsArea.appendChild(wrapper);

  // Add click handler for delete button
  document.getElementById(`delete-saved-${saved.id}`).addEventListener("click", () => {
    showConfirmDialog(
      "Delete Payment Method",
      `Are you sure you want to delete this saved payment method?<br><strong>${cardBrand.toUpperCase()} •••• ${endDigits}</strong>`,
      () => onDeleteCallback(saved.id)
    );
  });

  // Add click handler for pay button - Call submit on saved payment method component
  document.getElementById(`pay-saved-${saved.id}`).addEventListener("click", async () => {
    if (!document.getElementById(`termsCheckbox-saved-${saved.id}`).checked) {
      showWarningToast("You must agree to the terms and conditions.");
      return;
    }

    const button = document.getElementById(`pay-saved-${saved.id}`);

    try {
      // Show loading state
      button.disabled = true;
      button.classList.add("loading");

      // Call the pay callback which will submit the stored payment method
      await onPayCallback(saved.id);
    } catch (error) {
      console.error("Error processing payment:", error);
      showErrorToast(error.message || "Failed to process payment");
    } finally {
      // Remove loading state
      button.disabled = false;
      button.classList.remove("loading");
    }
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

  const placeholder = paymentPlaceholder || document.getElementById("payment-placeholder");
  if (placeholder) placeholder.classList.remove("hidden");
};

/**
 * Clear all payment methods from the UI
 */
const clearPaymentMethods = () => {
  const savedList = savedMethodsList || document.getElementById("saved-methods-list");
  const availableList = availableMethodsList || document.getElementById("available-methods-list");
  const componentsArea = paymentComponentsArea || document.getElementById("payment-components-area");
  const divider = methodsDivider || document.getElementById("methods-divider");
  const placeholder = paymentPlaceholder || document.getElementById("payment-placeholder");

  if (savedList) savedList.innerHTML = "";
  if (availableList) availableList.innerHTML = "";
  if (componentsArea) componentsArea.innerHTML = "";
  if (divider) divider.classList.add("hidden");
  if (placeholder) placeholder.classList.remove("hidden");
};

/**
 * Show loading spinner
 */
const showSpinner = () => {
  const placeholder = paymentPlaceholder || document.getElementById("payment-placeholder");
  const spinnerElement = spinner || document.getElementById("spinner");

  if (placeholder) placeholder.classList.add("hidden");
  if (spinnerElement) spinnerElement.classList.remove("hidden");
};

/**
 * Hide loading spinner
 */
const hideSpinner = () => {
  const spinnerElement = spinner || document.getElementById("spinner");
  if (spinnerElement) spinnerElement.classList.add("hidden");
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
const showCartSummary = async (cart) => {
  const modal = $("#cartSummaryModal");
  const content = document.getElementById("cartSummaryContent");

  if (!cart) {
    content.innerHTML = '<p class="text-muted">No cart loaded</p>';
    modal.modal("show");
    return;
  }

  // Get customer info if customerId exists
  let customerInfo = "Anonymous";
  if (cart.customerId) {
    try {
      const { getCustomerById } = await import("/dev-utils/commercestore/js/checkout-main.js");
      const customer = await getCustomerById(cart.customerId);
      if (customer) {
        customerInfo = customer.email || `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || "Customer";
      }
    } catch (error) {
      console.warn("Failed to fetch customer:", error);
      customerInfo = "Customer";
    }
  }

  // Helper functions
  const formatPrice = (centAmount, currencyCode) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
    }).format(centAmount / 100);
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

  // Build the clean summary with payment-details style
  const html = `
    <!-- Cart Info Section -->
    <div class="cart-detail-section">
      <h6>Cart Information</h6>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Cart ID</span>
          <div class="detail-value-with-copy">
            <span class="detail-value monospace">${cart.id}</span>
            <button class="btn-copy" onclick="copyToClipboard('${cart.id}', this)" title="Copy to clipboard"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
          </div>
        </div>
        <div class="detail-item">
          <span class="detail-label">Customer</span>
          <span class="detail-value">${customerInfo}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Currency</span>
          <span class="detail-value">${cart.totalPrice.currencyCode}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Created At</span>
          <span class="detail-value">${new Date(cart.createdAt).toLocaleString()}</span>
        </div>
      </div>
    </div>

    <!-- Line Items -->
    ${
      cart.customLineItems && cart.customLineItems.length > 0
        ? `
    <div class="cart-detail-section">
      <h6>Products</h6>
      <table class="line-items-table">
        <thead>
          <tr>
            <th>Name</th>
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
    <div class="cart-detail-section">
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
    <div class="cart-detail-section">
      <h6>Shipping Address</h6>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Name</span>
          <span class="detail-value">${
            cart.shippingAddress.firstName || cart.shippingAddress.lastName
              ? `${cart.shippingAddress.firstName || ""} ${cart.shippingAddress.lastName || ""}`.trim()
              : "N/A"
          }</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Street</span>
          <span class="detail-value">${cart.shippingAddress.streetName || ""} ${cart.shippingAddress.streetNumber || ""}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">City</span>
          <span class="detail-value">${cart.shippingAddress.postalCode || ""} ${cart.shippingAddress.city || ""}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Country</span>
          <span class="detail-value">${cart.shippingAddress.country}</span>
        </div>
      </div>
    </div>
    `
        : ""
    }

    <!-- Billing Address -->
    ${
      cart.billingAddress
        ? `
    <div class="cart-detail-section">
      <h6>Billing Address</h6>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Name</span>
          <span class="detail-value">${
            cart.billingAddress.firstName || cart.billingAddress.lastName
              ? `${cart.billingAddress.firstName || ""} ${cart.billingAddress.lastName || ""}`.trim()
              : "N/A"
          }</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Street</span>
          <span class="detail-value">${cart.billingAddress.streetName || ""} ${cart.billingAddress.streetNumber || ""}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">City</span>
          <span class="detail-value">${cart.billingAddress.postalCode || ""} ${cart.billingAddress.city || ""}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Country</span>
          <span class="detail-value"> ${cart.billingAddress.country}</span>
        </div>
      </div>
    </div>
    `
        : ""
    }

    <!-- Custom Fields -->
    ${
      Object.keys(customFields).length > 0
        ? `
    <div class="cart-detail-section">
      <h6>Custom Fields</h6>
      <div class="detail-grid">
        ${Object.entries(customFields)
          .map(
            ([key, value]) => `
          <div class="detail-item">
            <span class="detail-label">${key}</span>
            <span class="detail-value monospace">${typeof value === 'object' ? JSON.stringify(value) : value}</span>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
    `
        : ""
    }

    <!-- Totals (at the end) -->
    <div class="cart-detail-section">
      <h6>Order Summary</h6>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Subtotal</span>
          <span class="detail-value">${formatPrice(subtotal, cart.totalPrice.currencyCode)}</span>
        </div>
        ${
          shippingCost > 0
            ? `
        <div class="detail-item">
          <span class="detail-label">Shipping</span>
          <span class="detail-value">${formatPrice(shippingCost, cart.totalPrice.currencyCode)}</span>
        </div>
        `
            : ""
        }
        ${
          totalDiscount > 0
            ? `
        <div class="detail-item">
          <span class="detail-label">Discount</span>
          <span class="detail-value" style="color: #078b5c;">-${formatPrice(totalDiscount, cart.totalPrice.currencyCode)}</span>
        </div>
        `
            : ""
        }
        ${
          totalTax > 0
            ? `
        <div class="detail-item">
          <span class="detail-label">Tax</span>
          <span class="detail-value">${formatPrice(totalTax, cart.totalPrice.currencyCode)}</span>
        </div>
        `
            : ""
        }
        <div class="detail-item" style="padding-top: 15px; border-top: 2px solid #6359ff; margin-top: 10px;">
          <span class="detail-label" style="font-weight: 600; font-size: 1rem;">Total</span>
          <span class="detail-value" style="font-weight: 600; font-size: 1.1rem; color: #6359ff;">${formatPrice(grandTotal, cart.totalPrice.currencyCode)}</span>
        </div>
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
  showConfirmDialog,
  copyToClipboard,
};

// Make copyToClipboard available globally for HTML onclick handlers
if (typeof window !== 'undefined') {
  window.copyToClipboard = copyToClipboard;
}
