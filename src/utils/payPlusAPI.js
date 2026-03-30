import axios from "axios";

const payPlusAPI = axios.create({
  baseURL:
    process.env.PAYPLUS_API_URL || "https://restapi.payplus.co.il/api/v1.0",
  headers: {
    Authorization: `Bearer ${process.env.PAYPLUS_SECRET_KEY}`,
    "Content-Type": "application/json",
  },
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
  // PayPlus returns the URL directly from generateLink
  return transactionData.url || transactionData.paymentUrl;
};

export default payPlusAPI;
