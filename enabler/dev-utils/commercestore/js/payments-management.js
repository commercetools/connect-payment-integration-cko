/**
 * Payment Management Application
 * Handles listing, filtering, and managing existing payments
 */

import { showToast, showErrorToast, showSuccessToast, copyToClipboard } from "/dev-utils/commercestore/js/checkout-ui.js";
import { getPayments, getPaymentById, executePaymentAction } from "/dev-utils/commercestore/js/api.js";

// Make copyToClipboard available globally for HTML onclick handlers
if (typeof window !== 'undefined') {
  window.copyToClipboard = copyToClipboard;
}

// Configuration - payment interface to filter by
const PAYMENT_INTERFACE = window.__VITE_PAYMENT_INTERFACE__ || 'checkout-cko';

// DOM elements
let spinner;
let paymentsTableContainer;
let paymentsTableBody;
let emptyState;
let filterStatus;
let filterType;
let filterSearch;
let paymentsCount;
let currentPage;
let totalPages;

// State
let payments = [];
let filteredPayments = [];
let currentPageNum = 1;
const ITEMS_PER_PAGE = 10;

/**
 * Initialize the application
 */
const init = () => {
  console.log("Initializing Payment Management...");

  // Get DOM elements
  spinner = document.getElementById("spinner");
  paymentsTableContainer = document.getElementById("payments-table-container");
  paymentsTableBody = document.getElementById("paymentsTableBody");
  emptyState = document.getElementById("empty-state");
  filterStatus = document.getElementById("filterStatus");
  filterType = document.getElementById("filterType");
  filterSearch = document.getElementById("filterSearch");
  paymentsCount = document.getElementById("paymentsCount");
  currentPage = document.getElementById("currentPage");
  totalPages = document.getElementById("totalPages");

  // Attach event listeners
  document.getElementById("btnApplyFilters").addEventListener("click", applyFilters);
  document.getElementById("btnClearFilters").addEventListener("click", clearFilters);
  document.getElementById("btnPrevPage").addEventListener("click", () => changePage(-1));
  document.getElementById("btnNextPage").addEventListener("click", () => changePage(1));

  // Load payments on init
  loadPayments();
};

/**
 * Load all payments from CommerceTools
 */
const loadPayments = async () => {
  try {
    showSpinner();

    // Fetch payments from CommerceTools API
    const response = await getPayments({
      limit: 100,
      offset: 0,
      paymentInterface: PAYMENT_INTERFACE,
      sort: 'createdAt desc',
    });

    payments = response.results || [];
    filteredPayments = [...payments];

    console.log(`✓ Loaded ${payments.length} payments for interface: ${PAYMENT_INTERFACE}`);

    renderTable();
  } catch (error) {
    console.error("Error loading payments:", error);
    showErrorToast("Failed to load payments");
    showEmptyState();
  } finally {
    hideSpinner();
  }
};

/**
 * Apply filters to payments list
 */
const applyFilters = () => {
  const statusFilter = filterStatus.value.toLowerCase();
  const typeFilter = filterType.value.toLowerCase();
  const searchFilter = filterSearch.value.toLowerCase();

  filteredPayments = payments.filter((payment) => {
    // Get latest transaction
    const latestTxn = getLatestTransaction(payment);

    // Status filter
    if (statusFilter && latestTxn?.state?.toLowerCase() !== statusFilter) {
      return false;
    }

    // Type filter
    if (typeFilter && latestTxn?.type?.toLowerCase() !== typeFilter) {
      return false;
    }

    // Search filter
    if (searchFilter && !payment.id.toLowerCase().includes(searchFilter)) {
      return false;
    }

    return true;
  });

  currentPageNum = 1;
  renderTable();
};

/**
 * Clear all filters
 */
const clearFilters = () => {
  filterStatus.value = "";
  filterType.value = "";
  filterSearch.value = "";
  filteredPayments = [...payments];
  currentPageNum = 1;
  renderTable();
};

/**
 * Render the payments table
 */
const renderTable = () => {
  if (filteredPayments.length === 0) {
    showEmptyState();
    return;
  }

  // Calculate pagination
  const totalPagesNum = Math.ceil(filteredPayments.length / ITEMS_PER_PAGE);
  const startIndex = (currentPageNum - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const pagePayments = filteredPayments.slice(startIndex, endIndex);

  // Clear table
  paymentsTableBody.innerHTML = "";

  // Render rows
  pagePayments.forEach((payment) => {
    const row = createPaymentRow(payment);
    paymentsTableBody.appendChild(row);
  });

  // Update stats
  paymentsCount.textContent = `${filteredPayments.length} payment${filteredPayments.length !== 1 ? "s" : ""}`;
  currentPage.textContent = currentPageNum;
  totalPages.textContent = totalPagesNum;

  // Update pagination buttons
  document.getElementById("btnPrevPage").disabled = currentPageNum === 1;
  document.getElementById("btnNextPage").disabled = currentPageNum === totalPagesNum;

  // Show table
  paymentsTableContainer.classList.remove("hidden");
  emptyState.classList.add("hidden");
};

/**
 * Create a table row for a payment
 */
const createPaymentRow = (payment) => {
  const row = document.createElement("tr");

  const latestTxn = getCurrentPaymentState(payment);
  const amount = formatAmount(payment.amountPlanned);
  const method = payment.paymentMethodInfo?.method || "Unknown";
  const created = formatDate(payment.createdAt);

  row.innerHTML = `
    <td>
      <span class="payment-id">${payment.id}</span>
    </td>
    <td>
      <span class="payment-amount">${amount}</span>
    </td>
    <td>
      ${latestTxn ? `<span class="transaction-type ${latestTxn.type.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase()}">${latestTxn.type}</span>` : "-"}
    </td>
    <td>
      ${latestTxn ? `<span class="payment-status ${latestTxn.state.toLowerCase()}">${latestTxn.state}</span>` : "-"}
    </td>
    <td>
      <span class="payment-method">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"></path>
          <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"></path>
          <line x1="18" y1="17" x2="18" y2="17"></line>
        </svg>
        ${method.charAt(0).toUpperCase() + method.slice(1)}
      </span>
    </td>
    <td>
      <span class="payment-date">${created}</span>
    </td>
    <td>
      <div class="dropdown">
        <button class="btn-actions dropdown-toggle" type="button" data-toggle="dropdown">
          Actions
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <div class="dropdown-menu dropdown-menu-right">
          <button class="dropdown-item" onclick="window.viewPaymentDetails('${payment.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            View Details
          </button>
          <div class="dropdown-divider"></div>
          ${getAvailableActions(payment)}
        </div>
      </div>
    </td>
  `;

  return row;
};

/**
 * Get available actions based on payment state
 */
const getAvailableActions = (payment) => {
  const latestTxn = getCurrentPaymentState(payment);
  if (!latestTxn) return "";

  const actions = [];

  // Authorization -> Can Cancel, Capture, or Reverse
  if (latestTxn.type === "Authorization" && latestTxn.state === "Success") {
    actions.push(
      createActionButton("Capture", "check-circle", payment.id, "capture"),
      createActionButton("Cancel", "x-circle", payment.id, "cancel", true),
      createActionButton("Reverse", "rotate-ccw", payment.id, "reverse", true)
    );
  }

  // Charge -> Can Refund or Reverse
  if (latestTxn.type === "Charge" && latestTxn.state === "Success") {
    actions.push(
      createActionButton("Refund", "corner-up-left", payment.id, "refund"),
      createActionButton("Reverse", "rotate-ccw", payment.id, "reverse", true)
    );
  }

  // Refund (Partial) -> Can do another refund
  if (latestTxn.type === "Refund" && latestTxn.state === "Success") {
    const totalRefunded = getTotalRefunded(payment);
    const totalCharged = getTotalCharged(payment);
    if (totalRefunded < totalCharged) {
      actions.push(createActionButton("Refund Remaining", "corner-up-left", payment.id, "refund"));
    }
  }

  return actions.join("");
};

/**
 * Create action button HTML
 */
const createActionButton = (label, icon, paymentId, action, danger = false) => {
  const iconSvg = getIconSvg(icon);
  const className = danger ? "dropdown-item danger" : "dropdown-item";
  return `
    <button class="${className}" onclick="window.showActionModal('${paymentId}', '${action}')">
      ${iconSvg}
      ${label}
    </button>
  `;
};

/**
 * Get SVG icon
 */
const getIconSvg = (icon) => {
  const icons = {
    "check-circle": '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
    "x-circle": '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>',
    "rotate-ccw": '<polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>',
    "corner-up-left": '<polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icons[icon] || ""}</svg>`;
};

/**
 * Get latest transaction from payment
 */
const getLatestTransaction = (payment) => {
  if (!payment.transactions || payment.transactions.length === 0) {
    return null;
  }
  return payment.transactions[payment.transactions.length - 1];
};

/**
 * Get current payment state based on successful transactions
 * Returns the latest successful transaction that represents the current state
 */
const getCurrentPaymentState = (payment) => {
  if (!payment.transactions || payment.transactions.length === 0) {
    return null;
  }
  
  // Get all successful transactions in reverse chronological order (newest first)
  const successfulTxns = payment.transactions
    .filter(txn => txn.state === 'Success')
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  if (successfulTxns.length === 0) {
    // No successful transactions, return latest
    return payment.transactions[payment.transactions.length - 1];
  }
  
  // Return the most recent successful transaction
  // This correctly shows Refund if it's the latest successful transaction
  return successfulTxns[0];
};

/**
 * Get total refunded amount
 */
const getTotalRefunded = (payment) => {
  if (!payment.transactions) return 0;
  return payment.transactions
    .filter((txn) => txn.type === "Refund" && txn.state === "Success")
    .reduce((sum, txn) => sum + txn.amount.centAmount, 0);
};

/**
 * Get total charged amount
 */
const getTotalCharged = (payment) => {
  if (!payment.transactions) return 0;
  const chargeTxn = payment.transactions.find((txn) => txn.type === "Charge" && txn.state === "Success");
  return chargeTxn ? chargeTxn.amount.centAmount : 0;
};

/**
 * Change page
 */
const changePage = (delta) => {
  currentPageNum += delta;
  renderTable();
};

/**
 * View payment details
 */
window.viewPaymentDetails = (paymentId) => {
  const payment = payments.find((p) => p.id === paymentId);
  if (!payment) return;

  const content = document.getElementById("paymentDetailsContent");
  content.innerHTML = renderPaymentDetails(payment);

  $("#paymentDetailsModal").modal("show");
};

/**
 * Render payment details
 */
const renderPaymentDetails = (payment) => {
  const amount = formatAmount(payment.amountPlanned);
  const paymentMethod = payment.paymentMethodInfo || {};
  const customFields = payment.custom?.fields || {};
  
  // Build payment method info section
  let paymentMethodSection = '';
  if (paymentMethod.method) {
    const methodData = [];
    
    if (paymentMethod.paymentInterface) {
      methodData.push(`<div class="detail-item">
        <span class="detail-label">Payment Interface</span>
        <span class="detail-value monospace">${paymentMethod.paymentInterface}</span>
      </div>`);
    }
    
    if (paymentMethod.name) {
      const name = typeof paymentMethod.name === 'object' ? paymentMethod.name.en || Object.values(paymentMethod.name)[0] : paymentMethod.name;
      methodData.push(`<div class="detail-item">
        <span class="detail-label">Method Name</span>
        <span class="detail-value">${name}</span>
      </div>`);
    }
    
    paymentMethodSection = `
      <div class="payment-detail-section">
        <h6>Payment Method</h6>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">Method</span>
            <span class="detail-value">${paymentMethod.method}</span>
          </div>
          ${methodData.join('')}
        </div>
      </div>
    `;
  }
  
  // Build custom fields section if exists
  let customFieldsSection = '';
  if (Object.keys(customFields).length > 0) {
    const customFieldsHtml = Object.entries(customFields)
      .map(([key, value]) => `
        <div class="detail-item">
          <span class="detail-label">${key}</span>
          <span class="detail-value monospace">${typeof value === 'object' ? JSON.stringify(value, null, 2) : value}</span>
        </div>
      `)
      .join('');
    
    customFieldsSection = `
      <div class="payment-detail-section">
        <h6>Custom Fields</h6>
        <div class="detail-grid">
          ${customFieldsHtml}
        </div>
      </div>
    `;
  }

  return `
    <div class="payment-detail-section">
      <h6>Payment Information</h6>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Payment ID</span>
          <div class="detail-value-with-copy">
            <span class="detail-value monospace">${payment.id}</span>
            <button class="btn-copy-detail" onclick="copyToClipboard('${payment.id}', this)" title="Copy to clipboard"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
          </div>
        </div>
        ${payment.interfaceId ? `
          <div class="detail-item">
            <span class="detail-label">Interface ID</span>
            <span class="detail-value monospace">${payment.interfaceId}</span>
          </div>
        ` : ''}
        <div class="detail-item">
          <span class="detail-label">Amount Planned</span>
          <span class="detail-value">${amount}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Created At</span>
          <span class="detail-value">${formatDate(payment.createdAt)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Last Modified</span>
          <span class="detail-value">${formatDate(payment.lastModifiedAt)}</span>
        </div>
      </div>
    </div>

    ${paymentMethodSection}
    ${customFieldsSection}

    <div class="payment-detail-section">
      <h6>Transactions</h6>
      <div class="transactions-timeline">
        ${payment.transactions.map((txn, index) => renderTransaction(txn, index)).join("")}
      </div>
    </div>
  `;
};

/**
 * Render transaction timeline item
 */
const renderTransaction = (txn, index) => {
  const txnId = `txn-${index}-${txn.id.substring(0, 8)}`;
  
  return `
    <div class="timeline-item">
      <div class="timeline-content">
        <div class="timeline-header" style="cursor: pointer;" data-toggle="collapse" data-target="#${txnId}">
          <div>
            <span class="timeline-type">${txn.type}</span>
            <span class="timeline-amount">${formatAmount(txn.amount)}</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition: transform 0.2s;">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
        <div class="timeline-meta">
          <span class="payment-status ${txn.state.toLowerCase()}">${txn.state}</span>
        </div>
        <div class="collapse" id="${txnId}">
          <div class="timeline-details">
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">Transaction ID</span>
                <span class="detail-value monospace" style="font-size: 12px; word-break: break-all;">${txn.id}</span>
              </div>
              ${txn.interfaceId ? `
                <div class="detail-item">
                  <span class="detail-label">Interface ID</span>
                  <span class="detail-value monospace" style="font-size: 12px; word-break: break-all;">${txn.interfaceId}</span>
                </div>
              ` : ''}
              <div class="detail-item">
                <span class="detail-label">Type</span>
                <span class="detail-value">${txn.type}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">State</span>
                <span class="detail-value">${txn.state}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Amount</span>
                <span class="detail-value">${formatAmount(txn.amount)}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Timestamp</span>
                <span class="detail-value">${formatDate(txn.timestamp)}</span>
              </div>
              ${txn.interactionId ? `
                <div class="detail-item">
                  <span class="detail-label">Interaction ID</span>
                  <span class="detail-value monospace" style="font-size: 12px;">${txn.interactionId}</span>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
};

/**
 * Show action modal
 */
export const showActionModal = (paymentId, action) => {
  const payment = payments.find((p) => p.id === paymentId);
  if (!payment) return;

  const modal = $("#actionConfirmModal");
  const title = document.getElementById("actionConfirmTitle");
  const body = document.getElementById("actionConfirmBody");
  const confirmBtn = document.getElementById("btnConfirmAction");

  // Set title
  const actionTitles = {
    capture: "Capture Payment",
    cancel: "Cancel Authorization",
    reverse: "Reverse Transaction",
    refund: "Refund Payment",
  };
  title.textContent = actionTitles[action] || "Confirm Action";

  // Set body content
  body.innerHTML = renderActionForm(payment, action);

  // Set confirm handler
  confirmBtn.onclick = () => executeAction(paymentId, action);

  modal.modal("show");
};

/**
 * Render action form
 */
const renderActionForm = (payment, action) => {
  const amount = payment.amountPlanned.centAmount;
  const currency = payment.amountPlanned.currencyCode;

  if (action === "refund") {
    const totalCharged = getTotalCharged(payment);
    const totalRefunded = getTotalRefunded(payment);
    const maxRefund = totalCharged - totalRefunded;

    return `
      <p>Select the refund type and amount:</p>
      <div class="action-form">
        <div class="form-group">
          <label>Refund Type</label>
          <select class="form-control" id="refundType" onchange="document.getElementById('partialAmountGroup').style.display = this.value === 'partial' ? 'block' : 'none';">
            <option value="full">Full Refund</option>
            <option value="partial">Partial Refund</option>
          </select>
        </div>
        <div class="form-group" id="partialAmountGroup" style="display: none;">
          <label>Amount (in cents)</label>
          <input 
            type="number" 
            class="form-control" 
            id="refundAmount" 
            placeholder="Enter amount in cents"
            min="1"
            max="${maxRefund}"
          />
          <small class="form-text text-muted">Max refundable: ${formatAmount({ centAmount: maxRefund, currencyCode: currency })}</small>
        </div>
        <div class="action-summary">
          <h6>Summary</h6>
          <div class="action-summary-item">
            <span class="label">Total Charged:</span>
            <span class="value">${formatAmount({ centAmount: totalCharged, currencyCode: currency })}</span>
          </div>
          <div class="action-summary-item">
            <span class="label">Already Refunded:</span>
            <span class="value">${formatAmount({ centAmount: totalRefunded, currencyCode: currency })}</span>
          </div>
          <div class="action-summary-item">
            <span class="label">Remaining:</span>
            <span class="value">${formatAmount({ centAmount: maxRefund, currencyCode: currency })}</span>
          </div>
        </div>
      </div>
    `;
  }

  // Default confirmation for other actions
  return `
    <p>Are you sure you want to ${action} this payment?</p>
    <div class="action-summary">
      <h6>Payment Details</h6>
      <div class="action-summary-item">
        <span class="label">Payment ID:</span>
        <span class="value">${payment.id}</span>
      </div>
      <div class="action-summary-item">
        <span class="label">Amount:</span>
        <span class="value">${formatAmount(payment.amountPlanned)}</span>
      </div>
    </div>
  `;
};

/**
 * Execute payment action
 */
const executeAction = async (paymentId, action) => {
  const confirmBtn = document.getElementById("btnConfirmAction");

  try {
    // Show loading
    confirmBtn.disabled = true;
    confirmBtn.classList.add("loading");

    // Prepare action based on type
    let actionPayload;

    if (action === "capture") {
      const payment = payments.find((p) => p.id === paymentId);
      actionPayload = {
        action: "capturePayment",
        amount: {
          centAmount: payment.amountPlanned.centAmount,
          currencyCode: payment.amountPlanned.currencyCode,
        },
      };
    } else if (action === "refund") {
      const refundType = document.getElementById("refundType").value;
      const payment = payments.find((p) => p.id === paymentId);

      let refundAmount;
      if (refundType === "full") {
        const totalCharged = getTotalCharged(payment);
        const totalRefunded = getTotalRefunded(payment);
        refundAmount = {
          centAmount: totalCharged - totalRefunded,
          currencyCode: payment.amountPlanned.currencyCode,
        };
      } else {
        const amount = parseInt(document.getElementById("refundAmount").value);
        if (!amount || amount <= 0) {
          showErrorToast("Please enter a valid refund amount");
          return;
        }
        refundAmount = {
          centAmount: amount,
          currencyCode: payment.amountPlanned.currencyCode,
        };
      }

      actionPayload = {
        action: "refundPayment",
        amount: refundAmount,
      };
    } else if (action === "cancel") {
      actionPayload = {
        action: "cancelPayment",
      };
    } else if (action === "reverse") {
      actionPayload = {
        action: "reversePayment",
      };
    }

    // Build request body with actions array
    const requestBody = {
      actions: [actionPayload],
    };

    // Call payment-intents API
    console.log("Executing action on payment:", paymentId, "with payload:", requestBody);
    
    const result = await executePaymentAction(paymentId, requestBody);
    
    console.log("Action executed successfully:", result);

    // Success
    const actionName = action.charAt(0).toUpperCase() + action.slice(1);
    showSuccessToast(`${actionName} executed successfully`);
    $("#actionConfirmModal").modal("hide");

    // Reload payments
    await loadPayments();
  } catch (error) {
    console.error("Error executing action:", error);
    showErrorToast(error.message || `Failed to ${action} payment`);
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.classList.remove("loading");
  }
};

/**
 * Show/hide spinner
 */
const showSpinner = () => {
  spinner.classList.remove("hidden");
  paymentsTableContainer.classList.add("hidden");
  emptyState.classList.add("hidden");
};

const hideSpinner = () => {
  spinner.classList.add("hidden");
};

/**
 * Show empty state
 */
const showEmptyState = () => {
  paymentsTableContainer.classList.add("hidden");
  emptyState.classList.remove("hidden");
};

/**
 * Format amount
 */
const formatAmount = (money) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: money.currencyCode,
  }).format(money.centAmount / 100);
};

/**
 * Format date
 */
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

/**
 * Truncate ID for display
 */
const truncateId = (id) => {
  if (id.length <= 12) return id;
  return `${id.substring(0, 8)}...${id.substring(id.length - 4)}`;
};

// Make functions available globally for HTML onclick handlers
if (typeof window !== 'undefined') {
  window.viewPaymentDetails = viewPaymentDetails;
  window.showActionModal = showActionModal;
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", init);
