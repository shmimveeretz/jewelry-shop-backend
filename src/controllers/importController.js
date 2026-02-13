import fs from "fs";
import Product from "../models/Product.js";

/**
 * @desc    Import products from jewelry.json to MongoDB
 * @route   POST /api/products/import
 * @access  Private/Admin
 */
export const importProducts = async (req, res) => {
  try {
    console.log("📥 Starting product import from jewelry.json...");

    // Read jewelry.json
    const jewelryPath = "./data/jewelry.json";
    if (!fs.existsSync(jewelryPath)) {
      return res.status(404).json({
        success: false,
        message: "jewelry.json file not found",
      });
    }

    const jewelryData = JSON.parse(fs.readFileSync(jewelryPath, "utf8"));
    console.log(`📦 Found ${jewelryData.length} products in jewelry.json`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const item of jewelryData) {
      try {
        // Check if product already exists
        const existingProduct = await Product.Model.findOne({
          name: item.name,
        });

        if (existingProduct) {
          console.log(`⏭️  Skipping ${item.name} (already exists)`);
          skipCount++;
          continue;
        }

        // Transform Cloudinary image URLs to image objects
        const images = (item.images || []).map((url) => ({
          url, // Keep Cloudinary URL for now - can be migrated later
          alt: item.name,
        }));

        // Create product
        const productData = {
          name: item.name,
          nameEn: item.nameEn,
          description: item.description,
          descriptionEn: item.descriptionEn,
          category: item.category,
          price: item.price,
          images,
          metals: item.metals || [],
          letter: item.letter,
          meaningHe: item.meaningHe,
          meaningEn: item.meaningEn,
          gematria: item.gematria,
          types: item.types || [],
          stock: 10, // Default stock
          zodiacSign: item.zodiacSign || "כללי",
          featured: false,
          rating: { average: 0, count: 0 },
          reviews: [],
        };

        const product = await Product.create(productData);
        console.log(`✅ Created: ${product.name}`);
        successCount++;
      } catch (error) {
        console.error(
          `❌ Error importing ${item.name}: ${error.message}`
        );
        errorCount++;
      }
    }

    console.log(`\n✅ Import complete!`);
    console.log(`   ✅ Created: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);

    res.json({
      success: true,
      message: "Products imported successfully",
      created: successCount,
      skipped: skipCount,
      errors: errorCount,
    });
  } catch (error) {
    console.error("❌ Import error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
