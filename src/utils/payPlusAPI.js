import axios from "axios";

const PAYPLUS_BASE_URL =
  process.env.PAYPLUS_API_URL || "https://restapi.payplus.co.il/api/v1.0";

const payPlusAPI = axios.create({
  baseURL: PAYPLUS_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Set Authorization at request time (after dotenv.config() has run)
payPlusAPI.interceptors.request.use((config) => {
  config.headers.Authorization = JSON.stringify({
    api_key: process.env.PAYPLUS_PUBLIC_KEY,
    secret_key: process.env.PAYPLUS_SECRET_KEY,
  });
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
      initial_invoice: true, // Triggers retro-document generation by PayPlus
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
      data?.payment_page_link ||
      data?.paymentUrl ||
      data?.url ||
      null;

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
 * @param {Array}    options.items                 - [{ name, quantity, price, vatType? }]
 * @param {Array}    [options.payments]            - [{ paymentMethod, sum }]
 *   paymentMethod: 1=cash 2=check 3=bank-transfer 4=credit-card 5=other
 * @param {number}   options.totalAmount           - Grand total (including VAT)
 * @param {string}   [options.currency_code]       - Default "ILS"
 * @param {number}   [options.vatType]             - 0=no VAT, 1=incl. VAT (default 1)
 * @param {string}   [options.remarks]             - Optional free-text remarks
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
    vatType = 1,
    remarks = "",
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

  if (!VALID_DOC_TYPES.includes(docType)) {
    throw new Error(
      `Invalid docType "${docType}". Valid options: ${VALID_DOC_TYPES.join(", ")}`,
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
      vatType: item.vatType ?? vatType,
    })),
    payments:
      payments.length > 0
        ? payments
        : [{ paymentMethod: 4, sum: totalAmount }], // default: credit card
    totalAmount,
    currency_code,
    vatType,
    ...(remarks && { remarks }),
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
