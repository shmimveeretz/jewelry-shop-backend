import axios from "axios";

const payPlusAPI = axios.create({
  baseURL:
    process.env.PAYPLUS_API_URL || "https://restapi.payplus.co.il/api/v1.0g",
  headers: {
    Authorization: `Bearer ${process.env.PAYPLUS_SECRET_KEY}`,
    "Content-Type": "application/json",
    "X-Merchant-Id": process.env.PAYPLUS_MERCHANT_ID,
  },
});

/**
 * Create a payment transaction with PayPlus
 * @param {Object} paymentData - Payment data object
 * @returns {Promise<Object>} PayPlus API response
 */
export const createPayPlusTransaction = async (paymentData) => {
  try {
    const response = await payPlusAPI.post("/transactions/create", {
      ...paymentData,
      merchantId: process.env.PAYPLUS_MERCHANT_ID,
      publicKey: process.env.PAYPLUS_PUBLIC_KEY,
    });
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
  const baseURL =
    process.env.PAYPLUS_API_URL || "https://restapi.payplus.co.il/api/v1.0";
  const params = new URLSearchParams({
    merchantId: process.env.PAYPLUS_MERCHANT_ID,
    transactionId: transactionData.transactionId,
    returnUrl:
      transactionData.returnUrl ||
      `${process.env.FRONTEND_URL}/payment-success`,
    notifyUrl: `${
      process.env.BACKEND_URL || "https://jewelry-shop-udr7.onrender.com"
    }/api/payment/webhook`,
    lang: "he",
  });
  return `${baseURL}/checkout?${params.toString()}`;
};

export default payPlusAPI;
