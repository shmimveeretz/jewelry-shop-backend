/**
 * Backfill missing orderId values and make the orderId unique index sparse.
 *
 * Usage: node scripts/fixOrderIdIndex.js
 */
import dns from "dns";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const currentServers = dns.getServers();
if (currentServers.length === 0 || currentServers.every((s) => s.startsWith("127."))) {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

await mongoose.connect(process.env.MONGODB_URI);
const orders = mongoose.connection.db.collection("orders");

const missing = await orders.find({ $or: [{ orderId: null }, { orderId: { $exists: false } }] }).toArray();
for (const doc of missing) {
  const orderId = doc.transactionUid || doc._id.toString();
  await orders.updateOne({ _id: doc._id }, { $set: { orderId, updatedAt: new Date() } });
  console.log(`✅ Backfilled orderId for ${doc._id}: ${orderId}`);
}

try {
  await orders.dropIndex("orderId_1");
  console.log("🗑️  Dropped legacy orderId_1 index");
} catch (err) {
  console.log("ℹ️  orderId_1 index:", err.message);
}

await orders.createIndex({ orderId: 1 }, { unique: true, sparse: true });
console.log("✅ Created sparse unique index on orderId");

await mongoose.disconnect();
