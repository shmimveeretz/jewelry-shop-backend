import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);

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
