import SettingsMongo from "../models/SettingsMongo.js";

const MAX_MOTD_LENGTH = 180;

const sanitizeMotd = (value) => {
  if (typeof value !== "string") return "";
  return value.replace(/<[^>]*>/g, "").trim().slice(0, MAX_MOTD_LENGTH);
};

const buildMotdPayload = (settings) => ({
  motd: sanitizeMotd(settings?.motd),
  motd2: sanitizeMotd(settings?.motd2),
});

// @desc    Get MOTD
// @route   GET /api/settings/motd
// @access  Public
export const getMotd = async (req, res) => {
  try {
    let settings = await SettingsMongo.findOne();
    if (!settings) {
      settings = await SettingsMongo.create({ motd: "", motd2: "" });
    }
    res.json({ success: true, ...buildMotdPayload(settings) });
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
    if (req.body.motd === undefined && req.body.motd2 === undefined) {
      return res.status(400).json({
        success: false,
        message: "יש לשלוח לפחות אחד מהשדות motd או motd2",
      });
    }

    const update = {};
    if (req.body.motd !== undefined) {
      update.motd = sanitizeMotd(req.body.motd);
    }
    if (req.body.motd2 !== undefined) {
      update.motd2 = sanitizeMotd(req.body.motd2);
    }

    const settings = await SettingsMongo.findOneAndUpdate({}, update, {
      new: true,
      upsert: true,
    });

    const payload = buildMotdPayload(settings);
    console.log("✅ MOTD updated:", payload);
    res.json({ success: true, ...payload });
  } catch (error) {
    console.error("❌ Error updating MOTD:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
