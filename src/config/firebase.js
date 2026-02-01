import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

let db = null;

const initializeFirebase = () => {
  try {
    // Check if already initialized
    if (admin.apps.length > 0) {
      db = getFirestore();
      console.log("✅ Firebase already initialized");
      return db;
    }

    // Initialize with environment variables (priority for Render)
    if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_PRIVATE_KEY &&
      process.env.FIREBASE_CLIENT_EMAIL
    ) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
    } else {
      throw new Error(
        "Firebase credentials not found in environment variables",
      );
    }

    db = getFirestore();

    // Configure Firestore settings
    db.settings({
      ignoreUndefinedProperties: true,
    });

    console.log(`✅ Firebase Connected`);
    console.log(
      `📊 Project ID: ${process.env.FIREBASE_PROJECT_ID || "from service account"}`,
    );

    return db;
  } catch (error) {
    console.error(`❌ Error connecting to Firebase: ${error.message}`);
    process.exit(1);
  }
};

export const getDB = () => {
  if (!db) {
    return initializeFirebase();
  }
  return db;
};

export { initializeFirebase };
