import axios from "axios";

const PAYPLUS_BASE_URL =
  process.env.PAYPLUS_API_URL || "https://restapi.payplus.co.il/api/v1.0";

const payPlusAPI = axios.create({
  baseURL: PAYPLUS_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Set Authorization at request time (after dotenv.config() has run).
// PayPlus docs also accept api-key / secret-key headers; both are sent for compatibility.
payPlusAPI.interceptors.request.use((config) => {
  const apiKey = process.env.PAYPLUS_PUBLIC_KEY;
  const secretKey = process.env.PAYPLUS_SECRET_KEY;
  if (apiKey && secretKey) {
    config.headers.Authorization = JSON.stringify({
      api_key: apiKey,
      secret_key: secretKey,
    });
    config.headers["api-key"] = apiKey;
    config.headers["secret-key"] = secretKey;
  }
  return config;
});

/**
 * Create a payment transaction with PayPlus
 * @param {Object} paymentData - Payment data object
 * @returns {Promise<Object>} PayPlus API response
 */
export const createPayPlusTransaction = async (paymentData) => {
  try {
    const response = await payPlusAPI.post(
      "/PaymentPages/generateLink",
      paymentData,
    );
    return response.data;
  } catch (error) {
    console.error("PayPlus API Error:", error.response?.data || error.message);
    throw new Error(
      error.response?.data?.message || "Failed to create PayPlus transaction",
    );
  }
};

/**
 * Generate a PayPlus payment link, including retro-document generation.
 * Always includes initial_invoice: true so PayPlus auto-issues a fiscal document.
 *
 * @param {Object} options
 * @param {number}   options.amount            - Total amount in ILS
 * @param {string}   [options.currency_code]   - Default "ILS"
 * @param {string}   [options.description]     - Payment description shown on page
 * @param {string}   [options.customerName]    - Customer full name
 * @param {string}   [options.customerEmail]   - Customer email (for invoice)
 * @param {string}   [options.customerPhone]   - Customer phone
 * @param {string}   [options.moreInfo]        - Internal reference (order ID, etc.)
 * @param {Array}    [options.items]           - Line items for invoice [{name, quantity, price}]
 * @param {string}   [options.successUrl]      - Redirect on success
 * @param {string}   [options.failureUrl]      - Redirect on failure
 * @param {string}   [options.notifyUrl]       - Webhook callback URL
 * @returns {Promise<{ paymentPageUrl: string, pageRequestUid: string, raw: Object }>}
 */
export const generatePaymentLink = async ({
  amount,
  currency_code = "ILS",
  description = "",
  customerName = "",
  customerEmail = "",
  customerPhone = "",
  moreInfo = "",
  items = [],
  successUrl,
  failureUrl,
  notifyUrl,
}) => {
  try {
    const payload = {
      payment_page_uid: process.env.PAYPLUS_PAYMENT_PAGE_UID,
      charge_method: 1, // 1 = charge only
      amount,
      currency_code,
      sendEmailApproval: true,
      sendEmailFailure: false,
      // Triggers automatic invoice generation by PayPlus (requires invoice company
      // to be integrated and activated in payment page settings)
      initial_invoice: true,
      // Ensure VAT is included in the invoice
      paying_vat: true,
      more_info: moreInfo,
      ...(description && { description }),
      ...(successUrl && { refURL_success: successUrl }),
      ...(failureUrl && { refURL_failure: failureUrl }),
      ...(notifyUrl && { refURL_callback: notifyUrl }),
      customer: {
        customer_name: customerName,
        email: customerEmail,
        phone: customerPhone,
      },
      // Line items on invoice (name only required; product_uid optional for catalog products)
      ...(items.length > 0 && {
        items: items.map((item) => ({
          name: item.name,
          quantity: item.quantity ?? 1,
          price: item.price,
        })),
      }),
    };

    console.log("📤 generatePaymentLink →", JSON.stringify(payload, null, 2));

    const response = await payPlusAPI.post(
      "/PaymentPages/generateLink",
      payload,
    );

    console.log(
      "📥 generatePaymentLink ←",
      JSON.stringify(response.data, null, 2),
    );

    const data = response.data?.data ?? response.data;
    const paymentPageUrl =
      data?.payment_page_link || data?.paymentUrl || data?.url || null;

    if (!paymentPageUrl) {
      throw new Error(
        `PayPlus did not return a payment URL. Response: ${JSON.stringify(response.data)}`,
      );
    }

    return {
      paymentPageUrl,
      pageRequestUid: data?.page_request_uid || null,
      raw: response.data,
    };
  } catch (error) {
    const detail = error.response?.data ?? error.message;
    console.error("❌ generatePaymentLink error:", JSON.stringify(detail));
    throw new Error(
      error.response?.data?.results?.message ||
        error.response?.data?.message ||
        error.message ||
        "Failed to generate PayPlus payment link",
    );
  }
};

/**
 * Create a fiscal document manually via PayPlus Books API.
 *
 * @param {string} docType  - Document type key:
 *   "inv_tax_receipt" | "inv_proforma" | "inv_receipt" | "inv_tax" |
 *   "inv_order"       | "inv_refund"   | "inv_delivery"
 *
 * @param {Object} options
 * @param {Object}   options.customer              - { name, email, phone?, address? }
 * @param {Array}    options.items                 - [{ name, quantity, price }]
 * @param {Array}    [options.payments]            - [{ paymentMethod, sum }]
 *   paymentMethod: 1=cash 2=check 3=bank-transfer 4=credit-card 5=other
 * @param {number}   options.totalAmount           - Grand total (including VAT)
 * @param {string}   [options.currency_code]       - Default "ILS"
 * @param {string}   [options.vatType]             - PayPlus string enum (default "vat-type-included"):
 *   "vat-type-included" | "vat-type-not-included" | "vat-type-exempt"
 * @param {string}   [options.remarks]             - Optional free-text remarks
 * @param {boolean}  [options.sendEmail]           - Email the document to customer (default true)
 * @returns {Promise<Object>} PayPlus Books API response
 */
export const createManualDocument = async (
  docType,
  {
    customer,
    items,
    payments = [],
    totalAmount,
    currency_code = "ILS",
    vatType = "vat-type-included", // PayPlus string enum — NOT a number
    remarks = "",
    sendEmail = true,
  },
) => {
  const VALID_DOC_TYPES = [
    "inv_tax_receipt",
    "inv_proforma",
    "inv_receipt",
    "inv_tax",
    "inv_order",
    "inv_refund",
    "inv_delivery",
  ];

  const VALID_VAT_TYPES = [
    "vat-type-included",
    "vat-type-not-included",
    "vat-type-exempt",
  ];

  if (!VALID_DOC_TYPES.includes(docType)) {
    throw new Error(
      `Invalid docType "${docType}". Valid options: ${VALID_DOC_TYPES.join(", ")}`,
    );
  }

  if (!VALID_VAT_TYPES.includes(vatType)) {
    throw new Error(
      `Invalid vatType "${vatType}". Valid options: ${VALID_VAT_TYPES.join(", ")}`,
    );
  }

  if (!customer?.name) throw new Error("customer.name is required");
  if (!Array.isArray(items) || items.length === 0)
    throw new Error("items array is required and must not be empty");
  if (totalAmount == null) throw new Error("totalAmount is required");

  const payload = {
    customer: {
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
      ...(customer.address && { address: customer.address }),
    },
    items: items.map((item) => ({
      name: item.name,
      quantity: item.quantity ?? 1,
      price: item.price,
    })),
    payments:
      payments.length > 0 ? payments : [{ paymentMethod: 4, sum: totalAmount }], // default: credit card
    totalAmount,
    currency_code,
    vatType, // string enum: "vat-type-included" | "vat-type-not-included" | "vat-type-exempt"
    send_document_email: sendEmail, // email the document to the customer
    ...(remarks && { more_info: remarks }),
  };

  console.log(
    `📤 createManualDocument [${docType}] →`,
    JSON.stringify(payload, null, 2),
  );

  try {
    const response = await payPlusAPI.post(
      `/books/docs/new/${docType}`,
      payload,
    );

    console.log(
      `📥 createManualDocument [${docType}] ←`,
      JSON.stringify(response.data, null, 2),
    );

    return response.data;
  } catch (error) {
    const detail = error.response?.data ?? error.message;
    console.error(
      `❌ createManualDocument [${docType}] error:`,
      JSON.stringify(detail),
    );
    throw new Error(
      error.response?.data?.results?.message ||
        error.response?.data?.message ||
        error.message ||
        `Failed to create PayPlus document of type "${docType}"`,
    );
  }
};

/**
 * Get transaction details by payment page request UID.
 * Uses PayPlus IPN Full (documented lookup) — GetTransactionDetails returns 403 on many accounts.
 * @param {string} pageRequestUid - PayPlus page_request_uid / payment_page_request_uid
 * @returns {Promise<Object>} Transaction details
 */
export const getTransactionByPageRequestUid = async (pageRequestUid) => {
  // #region agent log
  fetch("http://127.0.0.1:7344/ingest/04171ffe-b9c7-4a68-aa80-feae36360d3e", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "439f43",
    },
    body: JSON.stringify({
      sessionId: "439f43",
      hypothesisId: "B",
      location: "payPlusAPI.js:getTransactionByPageRequestUid:entry",
      message: "PayPlus transaction lookup start",
      data: {
        uidPrefix: String(pageRequestUid).slice(0, 8),
        apiUrl: PAYPLUS_BASE_URL,
        hasPublicKey: Boolean(process.env.PAYPLUS_PUBLIC_KEY),
        hasSecretKey: Boolean(process.env.PAYPLUS_SECRET_KEY),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  try {
    const response = await payPlusAPI.post("/PaymentPages/ipn-full", {
      payment_request_uid: pageRequestUid,
    });

    // #region agent log
    fetch("http://127.0.0.1:7344/ingest/04171ffe-b9c7-4a68-aa80-feae36360d3e", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "439f43",
      },
      body: JSON.stringify({
        sessionId: "439f43",
        hypothesisId: "B",
        location: "payPlusAPI.js:getTransactionByPageRequestUid:success",
        message: "PayPlus ipn-full succeeded",
        data: {
          resultsStatus: response.data?.results?.status ?? null,
          statusCode:
            response.data?.data?.status_code ??
            response.data?.transaction?.status_code ??
            null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    return response.data;
  } catch (error) {
    const status = error.response?.status;
    const detail = error.response?.data ?? error.message;

    console.error(
      "PayPlus ipn-full error:",
      status,
      typeof detail === "object" ? JSON.stringify(detail) : detail,
    );

    // #region agent log
    fetch("http://127.0.0.1:7344/ingest/04171ffe-b9c7-4a68-aa80-feae36360d3e", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "439f43",
      },
      body: JSON.stringify({
        sessionId: "439f43",
        hypothesisId: "B",
        location: "payPlusAPI.js:getTransactionByPageRequestUid:error",
        message: "PayPlus ipn-full failed",
        data: { httpStatus: status ?? null, detailType: typeof detail },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    throw new Error("Failed to fetch transaction by page request UID");
  }
};

/** Whether a PayPlus ipn-full / redirect payload indicates an approved charge. */
export const isPayPlusTransactionApproved = (payPlusResponse) => {
  const tx =
    payPlusResponse?.transaction ??
    payPlusResponse?.data?.transaction ??
    payPlusResponse?.data ??
    {};

  const statusCode = tx.status_code ?? payPlusResponse?.data?.status_code ?? null;
  const txStatus =
    payPlusResponse?.results?.status ?? tx.status ?? payPlusResponse?.data?.status ?? null;

  return (
    statusCode === "000" ||
    statusCode === 0 ||
    statusCode === "0" ||
    txStatus === 1 ||
    txStatus === "1" ||
    txStatus === "success" ||
    txStatus === "approved" ||
    tx.status === "approved" ||
    tx.payment_status === "completed" ||
    payPlusResponse?.data?.payment_status === "completed"
  );
};

/**
 * Get transaction status
 * @param {string} transactionId - PayPlus transaction ID
 * @returns {Promise<Object>} Transaction details
 */
export const getTransactionStatus = async (transactionId) => {
  try {
    const response = await payPlusAPI.get(`/transactions/${transactionId}`);
    return response.data;
  } catch (error) {
    console.error("PayPlus API Error:", error.response?.data || error.message);
    throw new Error("Failed to fetch transaction status");
  }
};

/**
 * Refund a payment
 * @param {string} transactionId - PayPlus transaction ID
 * @param {number} amount - Refund amount (optional, full refund if not specified)
 * @returns {Promise<Object>} Refund response
 */
export const refundTransaction = async (transactionId, amount = null) => {
  try {
    const response = await payPlusAPI.post(
      `/transactions/${transactionId}/refund`,
      {
        amount: amount || null,
      },
    );
    return response.data;
  } catch (error) {
    console.error("PayPlus API Error:", error.response?.data || error.message);
    throw new Error("Failed to refund transaction");
  }
};

/**
 * Generate PayPlus payment page URL
 * @param {Object} transactionData - Transaction data
 * @returns {string} Payment page URL
 */
export const generatePaymentURL = (transactionData) => {
  return transactionData.url || transactionData.paymentUrl;
};

export default payPlusAPI;
