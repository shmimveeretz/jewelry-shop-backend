import {
  findCampaignProduct,
  shapeCampaignProduct,
} from "../utils/campaignProduct.js";

// @desc    Get a single product shaped for a campaign landing page
// @route   GET /api/campaign/products/:id
// @access  Public
export const getCampaignProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await findCampaignProduct(id);

    // Inactive products are treated as missing: an ad should never land on a
    // page for something we have stopped selling.
    if (!product || product.status === "inactive") {
      return res.status(404).json({
        success: false,
        message: "מוצר לא נמצא",
      });
    }

    // Public, identical for every visitor — let the CDN absorb the ad traffic.
    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");

    res.json({
      success: true,
      message: "Campaign product retrieved successfully",
      data: shapeCampaignProduct(product),
    });
  } catch (error) {
    console.error("❌ Error getting campaign product:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
