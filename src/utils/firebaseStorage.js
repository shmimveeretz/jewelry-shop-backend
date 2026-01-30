import admin from "firebase-admin";
import path from "path";

const bucket = admin.storage().bucket();

// Upload file to Firebase Storage
export const uploadFile = async (file, folder = "products") => {
  try {
    if (!file) {
      throw new Error("No file provided");
    }

    // Create unique filename
    const timestamp = Date.now();
    const originalName = file.originalname || "upload";
    const ext = path.extname(originalName);
    const filename = `${folder}/${timestamp}_${originalName}`;

    // Upload to Firebase
    const blob = bucket.file(filename);
    await blob.save(file.buffer, {
      metadata: {
        contentType: file.mimetype || "application/octet-stream",
      },
    });

    // Make public (read-only)
    await blob.makePublic();

    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    console.log("✅ File uploaded:", publicUrl);

    return {
      success: true,
      url: publicUrl,
      filename,
      size: file.size,
    };
  } catch (error) {
    console.error("❌ Upload error:", error);
    throw error;
  }
};

// Delete file from Firebase
export const deleteFile = async (filename) => {
  try {
    const blob = bucket.file(filename);
    await blob.delete();

    console.log("🗑️ File deleted:", filename);
    return { success: true };
  } catch (error) {
    console.error("❌ Delete error:", error);
    throw error;
  }
};

// Get signed URL (for private files, expires in 7 days)
export const getSignedUrl = async (filename) => {
  try {
    const [signedUrl] = await bucket.file(filename).getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return signedUrl;
  } catch (error) {
    console.error("❌ Error getting signed URL:", error);
    throw error;
  }
};

export default { uploadFile, deleteFile, getSignedUrl };
