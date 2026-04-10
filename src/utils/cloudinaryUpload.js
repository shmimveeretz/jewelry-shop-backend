import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload image to Cloudinary
export const uploadImage = async (fileBuffer, folder = "products") => {
  try {
    if (!fileBuffer) {
      throw new Error("No file provided");
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `shamayim-vaaretz/${folder}`,
          resource_type: "auto",
          quality: "auto", // Optimize automatically
          fetch_format: "auto",
        },
        (error, result) => {
          if (error) {
            console.error("❌ Upload error:", error);
            reject(error);
          } else {
            console.log("✅ Image uploaded:", result.secure_url);
            resolve({
              success: true,
              url: result.secure_url,
              public_id: result.public_id,
              size: result.bytes,
              width: result.width,
              height: result.height,
            });
          }
        },
      );

      uploadStream.end(fileBuffer);
    });
  } catch (error) {
    console.error("❌ Upload error:", error);
    throw error;
  }
};

// Delete image from Cloudinary
export const deleteImage = async (public_id) => {
  try {
    const result = await cloudinary.uploader.destroy(public_id);
    console.log("🗑️ Image deleted:", public_id);
    return { success: true };
  } catch (error) {
    console.error("❌ Delete error:", error);
    throw error;
  }
};

// Transform/optimize image URL
export const getOptimizedUrl = (public_id, options = {}) => {
  return cloudinary.url(public_id, {
    quality: "auto",
    fetch_format: "auto",
    width: options.width,
    height: options.height,
    crop: options.crop || "fill",
    ...options,
  });
};

export default { uploadImage, deleteImage, getOptimizedUrl };
