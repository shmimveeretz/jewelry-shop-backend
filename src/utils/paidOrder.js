import OrderMongo from "../models/OrderMongo.js";
import PendingOrderMongo from "../models/PendingOrderMongo.js";
import UserMongo from "../models/UserMongo.js";
import CouponMongo from "../models/CouponMongo.js";
import { formatItemNameWithExtraLetters } from "./extraHebrewLetters.js";

/**
 * Persist an order whose payment PayPlus has already confirmed.
 *
 * Shared by the signed webhook and the browser-triggered verify endpoint so
 * both build the order the same way. Order content comes from the
 * PendingOrder written by createPaymentIntent (server-priced), never from the
 * browser. The PayPlus transaction only fills gaps when the pending record has
 * expired.
 *
 * @returns {Promise<{ order, created: boolean }>}
 */
export async function saveVerifiedOrder({ pageRequestUid, txData = {}, userId = null }) {
  const existing = await OrderMongo.findOne({ transactionUid: pageRequestUid });
  if (existing) return { order: existing, created: false };

  const pendingDoc = await PendingOrderMongo.findOne({ pageRequestUid });
  const pending = pendingDoc?.orderData ?? {};

  const paidAmount = Number(txData.amount);
  const totalPrice = Number.isFinite(Number(pending.totalPrice))
    ? Number(pending.totalPrice)
    : paidAmount || 0;

  if (Number.isFinite(paidAmount) && paidAmount > 0 && Math.abs(paidAmount - totalPrice) > 0.5) {
    // Should never happen now that the amount is computed server-side; keep
    // the paid figure so the order reflects what was actually charged.
    console.warn(
      `⚠️ Paid amount ${paidAmount} differs from expected ${totalPrice} for ${pageRequestUid}`,
    );
  }

  const sourceItems =
    Array.isArray(pending.items) && pending.items.length > 0
      ? pending.items
      : (txData.items || []).map((i) => ({
          productId: i.product_uid || "",
          name: i.name,
          price: Number(i.price),
          quantity: Number(i.quantity) || 1,
        }));

  const items = sourceItems.map((item) => {
    const selections = item.selections || {};
    const extraLetters = Array.isArray(selections.extraLetters) ? selections.extraLetters : [];
    return {
      productId: item.productId || "",
      name: formatItemNameWithExtraLetters(item.name, extraLetters),
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 1,
      selectedOptions: item.selectedOptions || {},
      selections: {
        metalType: selections.metalType || "",
        length: selections.length || "",
        jewelryType: selections.jewelryType || "",
        extraLetters,
      },
    };
  });

  const customerName =
    pending.customerName || txData.customer_name || txData.full_name || "לקוח";
  const customerEmail =
    pending.customerEmail || txData.email || txData.customer_email || "";
  const customerPhone =
    pending.customerPhone || txData.phone || txData.customer_phone || "";
  const resolvedUserId = pending.userId || userId || null;

  let order;
  try {
    order = await OrderMongo.create({
      customerName,
      customerEmail: customerEmail || "unknown",
      customerPhone,
      items,
      shippingAddress: {
        fullName: pending.shippingAddress?.fullName || customerName,
        address: pending.shippingAddress?.address || "",
        city: pending.shippingAddress?.city || "",
        zipCode: pending.shippingAddress?.zipCode || "",
        country: pending.shippingAddress?.country || "IL",
      },
      itemsPrice: Number(pending.itemsPrice) || totalPrice,
      shippingPrice: Number(pending.shippingPrice) || 0,
      totalPrice: Number.isFinite(paidAmount) && paidAmount > 0 ? paidAmount : totalPrice,
      couponCode: pending.couponCode || null,
      discountPercent: Number(pending.discountPercent) || 0,
      paymentStatus: "completed",
      transactionUid: pageRequestUid,
      orderId: pending.orderId || txData.more_info || pageRequestUid,
      status: "Pending",
      ...(resolvedUserId && { userId: resolvedUserId }),
    });
  } catch (error) {
    // Webhook and browser verification can race; the unique index on
    // transactionUid makes the loser fall back to the winner's order.
    if (error?.code === 11000) {
      const winner = await OrderMongo.findOne({ transactionUid: pageRequestUid });
      if (winner) return { order: winner, created: false };
    }
    throw error;
  }

  pendingDoc?.deleteOne().catch(() => {});

  // Count the redemption only once the payment is confirmed, so abandoned
  // checkouts never burn a single-use code.
  if (pending.couponCode) {
    CouponMongo.updateOne({ code: pending.couponCode }, { $inc: { usedCount: 1 } }).catch(
      (err) => console.error("❌ Coupon usage count failed:", err.message),
    );
  }

  if (resolvedUserId) {
    UserMongo.findByIdAndUpdate(resolvedUserId, {
      $addToSet: { orders: order._id },
      updatedAt: Date.now(),
    }).catch((err) => console.error("❌ Linking order to user failed:", err.message));
  }

  return { order, created: true };
}
