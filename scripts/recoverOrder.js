/**
 * Recover a paid order that was approved by PayPlus but never saved to MongoDB.
 *
 * Usage:
 *   node scripts/recoverOrder.js <pageRequestUidOrOrderId>
 *
 * Example:
 *   node scripts/recoverOrder.js order_1782395051880_guest_1782395051880
 */
import dns from "dns";
import dotenv from "dotenv";
import mongoose from "mongoose";
import OrderMongo from "../src/models/OrderMongo.js";
import PendingOrderMongo from "../src/models/PendingOrderMongo.js";
import { getTransactionByPageRequestUid, isPayPlusTransactionApproved } from "../src/utils/payPlusAPI.js";

dotenv.config();

const currentServers = dns.getServers();
if (currentServers.length === 0 || currentServers.every((s) => s.startsWith("127."))) {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

const uid = process.argv[2];
const forceFromPending = process.argv.includes("--force");

if (!uid) {
  console.error("Usage: node scripts/recoverOrder.js <pageRequestUid> [--force]");
  process.exit(1);
}

function isApproved(payPlusResponse) {
  return isPayPlusTransactionApproved(payPlusResponse);
}

function buildOrderFromSources(orderData, txData, transactionUid) {
  const customerName =
    orderData.customerName ||
    txData.customer_name ||
    txData.full_name ||
    "לקוח";
  const customerEmail =
    orderData.customerEmail || txData.email || txData.customer_email || "";
  const customerPhone =
    orderData.customerPhone || txData.phone || txData.customer_phone || "";
  const totalPrice =
    orderData.totalPrice ??
    orderData.totalAmount ??
    Number(txData.amount) ??
    0;
  const items =
    orderData.items ??
    (txData.items || []).map((i) => ({
      productId: i.product_uid || "",
      name: i.name,
      price: Number(i.price),
      quantity: Number(i.quantity) || 1,
      selectedOptions: {},
    }));

  return {
    customerName,
    customerEmail,
    customerPhone,
    items,
    shippingAddress: {
      fullName:
        orderData.shippingAddress?.fullName ||
        orderData.shippingAddress?.name ||
        customerName,
      address:
        orderData.shippingAddress?.address ||
        orderData.shippingAddress?.street ||
        "",
      city: orderData.shippingAddress?.city || "",
      zipCode: orderData.shippingAddress?.zipCode || "",
    },
    itemsPrice: Number(orderData.itemsPrice) || 0,
    shippingPrice: Number(orderData.shippingPrice) || 0,
    totalPrice: Number(totalPrice),
    couponCode: orderData.couponCode || null,
    discountPercent: Number(orderData.discountPercent) || 0,
    paymentStatus: "completed",
    transactionUid,
    orderId: transactionUid,
    status: "Pending",
  };
}

await mongoose.connect(process.env.MONGODB_URI);

console.log(`\n🔍 Recovering order for UID: ${uid}\n`);

const existing = await OrderMongo.findOne({ transactionUid: uid });
if (existing) {
  console.log("✅ Order already exists in database:");
  console.log(JSON.stringify(existing.toObject(), null, 2));
  await mongoose.disconnect();
  process.exit(0);
}

const pendingDoc = await PendingOrderMongo.findOne({ pageRequestUid: uid });
if (pendingDoc) {
  console.log("📦 Found PendingOrder with customer data:");
  console.log(`   Name: ${pendingDoc.orderData?.customerName}`);
  console.log(`   Email: ${pendingDoc.orderData?.customerEmail}`);
  console.log(`   Items: ${pendingDoc.orderData?.items?.length ?? 0}`);
  console.log(`   Total: ${pendingDoc.orderData?.totalPrice} ₪`);
} else {
  console.log("⚠️  No PendingOrder found (may have expired after 24h TTL)");
}

let payPlusResponse = null;
let approved = false;

try {
  payPlusResponse = await getTransactionByPageRequestUid(uid);
  console.log("\n📥 PayPlus transaction response:");
  console.log(JSON.stringify(payPlusResponse, null, 2));
  approved = isApproved(payPlusResponse);
} catch (err) {
  console.error("\n❌ PayPlus lookup failed:", err.message);
  if (!pendingDoc?.orderData) {
    await mongoose.disconnect();
    process.exit(1);
  }
  if (!forceFromPending) {
    console.log(
      "\nℹ️  PendingOrder exists — re-run with --force after confirming payment in PayPlus dashboard.",
    );
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log("\n⚠️  --force: saving from PendingOrder without PayPlus verification");
  approved = true;
}

if (!approved) {
  console.error("\n❌ PayPlus reports payment NOT approved — order not created.");
  await mongoose.disconnect();
  process.exit(1);
}

const txData = payPlusResponse?.data ?? {};
const orderData = pendingDoc?.orderData ?? {};
const doc = buildOrderFromSources(orderData, txData, uid);
const saved = await OrderMongo.create(doc);

console.log("\n✅ Order recovered and saved to MongoDB:");
console.log(`   MongoDB _id: ${saved._id}`);
console.log(`   transactionUid: ${saved.transactionUid}`);
console.log(`   Customer: ${saved.customerName} <${saved.customerEmail}>`);
console.log(`   Total: ${saved.totalPrice} ₪`);
console.log(`   Items: ${saved.items.length}`);

if (pendingDoc) {
  await pendingDoc.deleteOne();
  console.log("🗑️  PendingOrder cleaned up");
}

await mongoose.disconnect();
