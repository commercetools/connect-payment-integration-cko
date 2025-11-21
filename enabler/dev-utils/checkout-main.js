/**
 * Main Checkout Application
 * Handles the complete checkout flow including cart creation and payment processing
 */

import { Enabler } from "/src/main.ts";
import {
  getCtpToken,
  ensureProjectConfiguration,
  createCart,
  createPreconfiguredCart,
  searchCustomerByEmail,
  createCustomer,
  getCustomerById,
  getCartById,
  getSessionId,
} from "/dev-utils/api.js";
import {
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
  showErrorToast,
  showSuccessToast,
  showWarningToast,
  showInfoToast,
} from "/dev-utils/checkout-ui.js";

// State
let methodsStore = new Map();
let savedMethodsStore = new Map();
let selectedMethod = null;
let enabler = null;
let currentCartId = null;
let currentCart = null;

// DOM Elements (initialized on load)
let checkoutContent;
let spinner;
let savedMethodsList;
let availableMethodsList;
let methodsDivider;
let paymentPlaceholder;
let paymentComponentsArea;
let btnReset;
let btnQuickCart;
let btnCustomCart;
let btnCartSummary;

/**
 * Initialize the application
 */
const init = () => {
  // Get DOM elements
  checkoutContent = document.getElementById("checkout-content");
  spinner = document.getElementById("spinner");
  savedMethodsList = document.getElementById("saved-methods-list");
  availableMethodsList = document.getElementById("available-methods-list");
  methodsDivider = document.getElementById("methods-divider");
  paymentPlaceholder = document.getElementById("payment-placeholder");
  paymentComponentsArea = document.getElementById("payment-components-area");
  btnReset = document.getElementById("btnReset");
  btnQuickCart = document.getElementById("btnQuickCart");
  btnCustomCart = document.getElementById("btnCustomCart");
  btnCartSummary = document.getElementById("btnCartSummary");

  // Initialize UI module
  initializeUI({
    paymentComponentsArea,
    savedMethodsList,
    availableMethodsList,
    paymentPlaceholder,
    spinner,
    methodsDivider,
  });

  // Setup event listeners
  setupEventListeners();
};

/**
 * Setup all event listeners
 */
const setupEventListeners = () => {
  // Quick Cart Modal - Customer Type Cards
  document.querySelectorAll('input[name="quickCartCustomer"]').forEach((radio) => {
    radio.addEventListener("change", function () {
      document.querySelectorAll(".customer-type-card").forEach((card) => {
        card.classList.remove("selected");
      });
      this.closest(".customer-type-card").classList.add("selected");
    });
  });

  // Quick Cart Modal
  btnQuickCart.addEventListener("click", handleQuickCartOpen);
  document.getElementById("btnConfirmQuickCart").addEventListener("click", handleQuickCartCreate);

  // Custom Cart Modal - Customer Type Cards
  document.querySelectorAll('input[name="customCustomerOption"]').forEach((radio) => {
    radio.addEventListener("change", function () {
      // Update visual selection
      document.querySelectorAll(".customer-type-card-custom").forEach((card) => {
        card.classList.remove("selected");
      });
      this.closest(".customer-type-card-custom").classList.add("selected");

      // Show/hide customer details
      handleCustomerOptionChange({ target: this });
    });
  });

  // Custom Cart Modal
  btnCustomCart.addEventListener("click", handleCustomCartOpen);
  document.getElementById("btnConfirmCustomCart").addEventListener("click", handleCustomCartCreate);
  document.getElementById("btnAddLineItem").addEventListener("click", handleAddLineItem);

  // Cart Summary
  btnCartSummary.addEventListener("click", () => showCartSummary(currentCart));

  // Load Checkout
  document.getElementById("btnLoadCheckout").addEventListener("click", handleLoadCheckout);

  // Reset
  btnReset.addEventListener("click", resetCheckoutState);

  // Setup modal close event listeners
  $("#successModal").on("hidden.bs.modal", function () {
    resetCheckoutState();
  });
};

/**
 * Handle Quick Cart modal open
 */
const handleQuickCartOpen = async () => {
  try {
    await ensureProjectConfiguration();
  } catch (error) {
    console.error("Error checking project configuration:", error);
  }
  $("#quickCartModal").modal("show");
};

/**
 * Handle Quick Cart creation
 */
const handleQuickCartCreate = async () => {
  const country = document.getElementById("quickCartCountry").value;
  const withCustomer = document.querySelector('input[name="quickCartCustomer"]:checked').value === "with";

  // Determine currency by country
  const currencyMap = {
    DE: "EUR",
    NL: "EUR",
    ES: "EUR",
    FR: "EUR",
    IT: "EUR",
    GB: "GBP",
    US: "USD",
  };
  const currency = currencyMap[country] || "EUR";

  const errorDiv = document.getElementById("quickCartError");
  const btn = document.getElementById("btnConfirmQuickCart");

  // Hide previous errors
  errorDiv.style.display = "none";

  // Add loading state to button
  btn.disabled = true;
  btn.classList.add("loading");

  try {
    const cart = await createPreconfiguredCart({
      country,
      currency,
      withCustomer,
    });

    $("#quickCartModal").modal("hide");

    document.getElementById("cartId").value = cart.id;
    await loadCheckout(cart.id);
  } catch (error) {
    console.error("Error creating cart:", error);
    errorDiv.textContent = error.message || "Failed to create cart";
    errorDiv.style.display = "block";
  } finally {
    // Remove loading state
    btn.disabled = false;
    btn.classList.remove("loading");
  }
};

/**
 * Handle Custom Cart modal open
 */
const handleCustomCartOpen = async () => {
  try {
    await ensureProjectConfiguration();

    // Always reset and add one default line item when opening
    const lineItemsList = document.getElementById("customLineItemsList");
    lineItemsList.innerHTML = ""; // Clear existing items
    handleAddLineItem(); // Add one default item

    // Hide error message
    document.getElementById("customCartError").style.display = "none";
  } catch (error) {
    console.error("Error checking project configuration:", error);
  }
  $("#customCartModal").modal("show");
};

/**
 * Handle customer option change
 */
const handleCustomerOptionChange = (e) => {
  document.querySelectorAll(".customer-details-content").forEach((field) => {
    field.classList.remove("active");
  });

  if (e.target.value === "existing") {
    document.getElementById("customExistingCustomerFields").classList.add("active");
  } else if (e.target.value === "new") {
    document.getElementById("customNewCustomerFields").classList.add("active");
  }
};

/**
 * Handle add line item
 */
const handleAddLineItem = () => {
  const template = document.getElementById("lineItemTemplate");
  const clone = template.cloneNode(true);
  clone.style.display = "block";
  clone.removeAttribute("id");

  const removeBtn = clone.querySelector(".custom-line-item-remove");
  removeBtn.addEventListener("click", function () {
    this.closest(".custom-line-item-card").remove();
    updateLineItemsRemoveButtons();
  });

  document.getElementById("customLineItemsList").appendChild(clone.firstElementChild);
  updateLineItemsRemoveButtons();
};

/**
 * Update visibility of remove buttons based on number of items
 */
const updateLineItemsRemoveButtons = () => {
  const lineItemsList = document.getElementById("customLineItemsList");
  const items = lineItemsList.querySelectorAll(".custom-line-item-card");

  items.forEach((item) => {
    const removeBtn = item.querySelector(".custom-line-item-remove");
    if (items.length <= 1) {
      removeBtn.style.display = "none";
    } else {
      removeBtn.style.display = "flex";
    }
  });
};

/**
 * Handle Custom Cart creation
 */
const handleCustomCartCreate = async () => {
  // Parse region selection (format: "COUNTRY-CURRENCY")
  const regionValue = document.getElementById("customCartRegion").value;
  const [country, currency] = regionValue.split("-");
  const customerOption = document.querySelector('input[name="customCustomerOption"]:checked').value;

  const errorDiv = document.getElementById("customCartError");
  const btn = document.getElementById("btnConfirmCustomCart");
  errorDiv.style.display = "none";

  // Add loading state
  btn.disabled = true;
  btn.classList.add("loading");

  try {
    // Collect custom line items
    const customLineItems = [];
    document.querySelectorAll("#customLineItemsList .custom-line-item-card").forEach((item) => {
      const name = item.querySelector(".line-item-name").value.trim();
      const quantity = parseInt(item.querySelector(".line-item-quantity").value);
      const price = parseInt(item.querySelector(".line-item-price").value);

      if (name && quantity > 0 && price >= 0) {
        customLineItems.push({
          name: { en: name },
          quantity,
          money: {
            currencyCode: currency,
            centAmount: price,
          },
          slug: name.toLowerCase().replace(/\s+/g, "-"),
        });
      }
    });

    // Validate that we have at least one line item
    if (customLineItems.length === 0) {
      throw new Error("Please add at least one valid line item with name, quantity, and price");
    }

    let customerId = null;

    // Handle customer
    if (customerOption === "existing") {
      const email = document.getElementById("customExistingCustomerEmail").value.trim();
      if (!email) {
        throw new Error("Please enter customer email");
      }
      const customers = await searchCustomerByEmail(email);
      if (customers.length === 0) {
        throw new Error(`No customer found with email: ${email}`);
      }
      customerId = customers[0].id;
    } else if (customerOption === "new") {
      const email = document.getElementById("customNewCustomerEmail").value.trim();
      const firstName = document.getElementById("customNewCustomerFirstName").value.trim();
      const lastName = document.getElementById("customNewCustomerLastName").value.trim();

      if (!email || !firstName || !lastName) {
        throw new Error("Please fill all customer fields");
      }

      const customer = await createCustomer(email, firstName, lastName);
      customerId = customer.id;
    }

    // Create cart
    const cart = await createCart({
      currency,
      country,
      customerId,
      customLineItems,
    });

    $("#customCartModal").modal("hide");

    // Load the cart
    document.getElementById("cartId").value = cart.id;
    await loadCheckout(cart.id);

    // Reset form
    resetCustomCartForm();
  } catch (error) {
    console.error("Error creating cart:", error);
    errorDiv.textContent = error.message || "Failed to create cart";
    errorDiv.style.display = "block";
  } finally {
    // Remove loading state
    btn.disabled = false;
    btn.classList.remove("loading");
  }
};

/**
 * Reset custom cart form
 */
const resetCustomCartForm = () => {
  document.getElementById("customLineItemsList").innerHTML = "";
  document.getElementById("customExistingCustomerEmail").value = "";
  document.getElementById("customNewCustomerEmail").value = "";
  document.getElementById("customNewCustomerFirstName").value = "";
  document.getElementById("customNewCustomerLastName").value = "";
  document.getElementById("customCartRegion").selectedIndex = 0;
  document.querySelector('input[name="customCustomerOption"][value="none"]').checked = true;
  document.querySelectorAll(".customer-type-card-custom").forEach((card) => {
    card.classList.remove("selected");
  });
  document.querySelector(".customer-type-card-custom").classList.add("selected");
  document.querySelectorAll(".customer-details-content").forEach((field) => {
    field.classList.remove("active");
  });
};

/**
 * Handle load checkout button
 */
const handleLoadCheckout = async () => {
  const cartId = document.getElementById("cartId").value.trim();
  if (!cartId) {
    showWarningToast("Please enter a cart ID or create a new cart");
    return;
  }
  currentCartId = cartId;
  await loadCheckout(cartId);
};

/**
 * Load checkout for a cart
 */
const loadCheckout = async (cartId) => {
  showSpinner();
  hideCheckoutContent();
  clearPaymentMethods();

  try {
    // Get cart details
    currentCart = await getCartById(cartId);

    // Load available payment methods
    const res = await fetch(`${__VITE_PROCESSOR_URL__}/operations/payment-components`);
    const paymentMethods = await res.json();

    const sessionId = await getSessionId(cartId, false);

    enabler = new Enabler({
      processorUrl: __VITE_PROCESSOR_URL__,
      sessionId: sessionId,
      onComplete: (result) => {
        if (result.isSuccess) {
          showSuccess(`${result.paymentReference}`);
        } else {
          showError("Payment was not successful. Please try again.");
        }
      },
      onError: (error, context) => {
        console.error("Payment error:", error, context);
        const errorMessage = error?.message || "An error occurred during payment processing.";
        showError(errorMessage);
      },
    });

    const storedPaymentMethods = await enabler.getStoredPaymentMethods({
      allowedMethodTypes: ["card"],
    });
    const storedMethods = storedPaymentMethods?.storedPaymentMethods || [];

    // Register saved payment methods (will appear on top)
    for (const method of storedMethods) {
      // Create the stored payment method builder and component
      const builder = await enabler.createStoredPaymentMethodBuilder(method.type);
      const component = builder.build({
        id: method.id,
        brands: method.displayOptions?.brand ? [method.displayOptions.brand.key] : [],
      });

      savedMethodsStore.set(method.id, {
        id: method.id,
        type: method.type,
        token: method.token,
        displayOptions: method.displayOptions,
        isDefault: method.isDefault,
        component: component, // Store the component so we can call remove() later
      });
      createSavedMethodItem(method, selectSavedMethod);
      createSavedMethodContainer(method, deleteSavedMethod, payWithSavedMethod);
    }

    // Show divider if there are saved methods
    if (storedMethods.length > 0) {
      methodsDivider.classList.remove("hidden");
    }

    // Register available payment methods
    for (const method of paymentMethods.components) {
      const builder = await enabler.createComponentBuilder(method.type);
      methodsStore.set(method.type, {
        type: method.type,
        meta: method,
        builder,
        mounted: false,
      });
      createPaymentMethodItem(method.type, method, selectPaymentMethod);
      createPaymentMethodContainer(method.type);
    }

    hideSpinner();
    showCheckoutContent();
    btnReset.style.display = "flex";
    btnCartSummary.style.display = "flex";

    showSuccessToast(`Cart loaded successfully: ${cartId.substring(0, 8)}...`);
  } catch (error) {
    console.error("Error loading checkout:", error);
    showErrorToast(error.message || "Failed to load checkout. Please check your cart ID and try again.");
    hideSpinner();
    resetCheckoutState();
  }
};

/**
 * Select saved payment method
 */
const selectSavedMethod = async (savedId) => {
  clearSelection();
  document.querySelector(`[data-saved-id="${savedId}"]`)?.classList.add("selected");

  const saved = savedMethodsStore.get(savedId);
  selectedMethod = { saved: true, data: saved };

  showPaymentContainer(`saved-method-${savedId}`);
};

/**
 * Delete saved payment method
 */
const deleteSavedMethod = async (savedId) => {
  try {
    showSpinner();

    // Get the saved method from store
    const savedMethod = savedMethodsStore.get(savedId);

    // Call remove() on the stored payment method component
    if (savedMethod?.component) {
      await savedMethod.component.remove();
    }

    // Remove from UI
    const savedItem = document.querySelector(`[data-saved-id="${savedId}"]`);
    savedItem?.remove();

    const savedContainer = document.getElementById(`saved-method-${savedId}`);
    savedContainer?.remove();

    // Remove from store
    savedMethodsStore.delete(savedId);

    // Clear selection if this was the selected method
    if (selectedMethod?.saved && selectedMethod?.data?.id === savedId) {
      clearSelection();
      paymentPlaceholder.classList.remove("hidden");
    }

    // Hide divider if no more saved methods
    if (savedMethodsStore.size === 0) {
      methodsDivider.classList.add("hidden");
    }

    hideSpinner();
    showSuccessToast("Payment method deleted successfully");
  } catch (error) {
    console.error("Error deleting saved payment method:", error);
    hideSpinner();
    showErrorToast(error.message || "Failed to delete payment method");
  }
};

/**
 * Pay with saved payment method
 */
const payWithSavedMethod = async (savedId) => {
  const savedMethod = savedMethodsStore.get(savedId);

  if (!savedMethod?.component) {
    throw new Error("Payment method component not found");
  }

  // Call submit on the stored payment method component
  await savedMethod.component.submit();
};

/**
 * Select payment method
 */
const selectPaymentMethod = async (type) => {
  clearSelection();
  document.querySelector(`[data-type="${type}"]`)?.classList.add("selected");

  const method = methodsStore.get(type);
  if (!method) return;

  selectedMethod = method;

  // If already mounted, just show it
  if (method.mounted) {
    showPaymentContainer(`payment-method-${type}`);
    hideSpinner();
    return;
  }

  // Otherwise, mount for the first time
  showSpinner();
  showPaymentContainer(`payment-method-${type}`);
  await loadPaymentComponent(type);
};

/**
 * Load payment component
 */
const loadPaymentComponent = async (type) => {
  try {
    const method = methodsStore.get(type);
    const builder = method.builder;

    const component = await builder.build({
      showPayButton: !builder.componentHasSubmit,
      ...(builder.componentHasSubmit
        ? {}
        : {
            onPayButtonClick: async () => {
              if (!document.getElementById(`termsCheckbox-${type}`).checked) {
                showWarningToast("You must agree to the terms and conditions.");
                return Promise.reject("Terms not accepted");
              }

              const shouldStore = document.getElementById(`storePaymentMethod-${type}`)?.checked || false;
              enabler.setStorePaymentDetails(shouldStore);

              return Promise.resolve();
            },
          }),
    });

    await component.mount(`#component-${type}`);

    // Show store payment method checkbox if it's a card
    if (type === "card" || builder.supportsStorePaymentDetails) {
      document.getElementById(`storePaymentMethod-container-${type}`).classList.remove("hidden");
    }

    // If component has custom submit
    if (builder.componentHasSubmit) {
      const submitButton = document.createElement("button");
      submitButton.className = "btn btn-primary btn-block btn-lg payment-submit-btn";
      submitButton.innerHTML = `
        <span class="btn-spinner"></span>
        <span class="btn-text">Pay Now</span>
      `;
      submitButton.addEventListener("click", async () => {
        if (!document.getElementById(`termsCheckbox-${type}`).checked) {
          showWarningToast("You must agree to the terms and conditions.");
          return;
        }

        // Show loading state
        submitButton.classList.add("loading");
        submitButton.disabled = true;

        try {
          const shouldStore = document.getElementById(`storePaymentMethod-${type}`)?.checked || false;
          await component.submit({ storePaymentDetails: shouldStore });
        } catch (error) {
          console.error("Payment submission error:", error);
          showErrorToast(error.message || "Payment failed. Please try again.");
        } finally {
          // Remove loading state
          submitButton.classList.remove("loading");
          submitButton.disabled = false;
        }
      });
      document.getElementById(`payment-button-container-${type}`).appendChild(submitButton);
    }

    method.component = component;
    method.mounted = true;
    hideSpinner();
  } catch (error) {
    console.error("Error loading payment component:", error);
    showErrorToast(error.message || "Failed to load payment component. Please try again.");
    clearSelection();
    hideSpinner();
  }
};

/**
 * Helper functions
 */
const hideCheckoutContent = () => {
  checkoutContent.classList.add("hidden");
};

const showCheckoutContent = () => {
  checkoutContent.classList.remove("hidden");
};

const resetCheckoutState = () => {
  hideCheckoutContent();
  clearPaymentMethods();
  methodsStore.clear();
  savedMethodsStore.clear();
  btnReset.style.display = "none";
  btnCartSummary.style.display = "none";
  selectedMethod = null;
  enabler = null;
  currentCartId = null;
  currentCart = null;

  // Clear cart ID input
  document.getElementById("cartId").value = "";
};

/**
 * Make handleSuccessClose global for onclick handler in HTML
 */
window.handleSuccessClose = () => {
  const modal = document.getElementById("successModal");
  modal.classList.remove("show");
  modal.style.display = "none";
  document.body.classList.remove("modal-open");
  const backdrop = document.querySelector(".modal-backdrop");
  if (backdrop) backdrop.remove();

  setTimeout(() => {
    resetCheckoutState();
  }, 300);
};

/**
 * Make handleErrorClose global for onclick handler in HTML
 */
window.handleErrorClose = () => {
  const modal = document.getElementById("errorModal");
  modal.classList.remove("show");
  modal.style.display = "none";
  document.body.classList.remove("modal-open");
  const backdrop = document.querySelector(".modal-backdrop");
  if (backdrop) backdrop.remove();
};

/**
 * Export API functions for use in other modules
 */
window.commercetoolsAPI = {
  getCustomerById,
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}