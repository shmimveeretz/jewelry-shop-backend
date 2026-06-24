import mongoose from "mongoose";
import dns from "dns";

// Node.js may be misconfigured to use 127.0.0.1 (a local proxy that isn't running).
// Override with reliable public DNS so mongodb+srv:// SRV lookups always work.
// This only affects this process — it does not change system DNS settings.
const currentServers = dns.getServers();
if (currentServers.length === 0 || currentServers.every((s) => s.startsWith("127."))) {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
  console.log("⚠️  DNS override: local DNS unavailable, using 8.8.8.8 / 1.1.1.1");
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    console.log(`
╔═══════════════════════════════════════════════════════════╗
║  ✅ MongoDB Connected Successfully                        ║
║  📊 Database: ${conn.connection.db.databaseName.padEnd(40)} ║
║  🌍 Host: ${conn.connection.host.padEnd(44)} ║
╚═══════════════════════════════════════════════════════════╝
    `);

    // Handle connection events
    mongoose.connection.on("error", (err) => {
      console.error(`❌ MongoDB connection error: ${err}`);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("⚠️  MongoDB disconnected");
    });

    // Graceful shutdown
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      console.log("MongoDB connection closed through app termination");
      process.exit(0);
    });

    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Failed: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
