import SettingsMongo from "../models/SettingsMongo.js";

// @desc    Get MOTD
// @route   GET /api/settings/motd
// @access  Public
export const getMotd = async (req, res) => {
  try {
    let settings = await SettingsMongo.findOne();
    if (!settings) {
      settings = await SettingsMongo.create({ motd: "" });
    }
    res.json({ success: true, motd: settings.motd });
  } catch (error) {
    console.error("❌ Error fetching MOTD:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update MOTD
// @route   PUT /api/settings/motd
// @access  Private/Admin
export const updateMotd = async (req, res) => {
  try {
    const { motd } = req.body;

    if (motd === undefined) {
      return res
        .status(400)
        .json({ success: false, message: "motd הוא שדה חובה" });
    }

    const settings = await SettingsMongo.findOneAndUpdate(
      {},
      { motd },
      { new: true, upsert: true },
    );

    console.log("✅ MOTD updated:", motd);
    res.json({ success: true, motd: settings.motd });
  } catch (error) {
    console.error("❌ Error updating MOTD:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
