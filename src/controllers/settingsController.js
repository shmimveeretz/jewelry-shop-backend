import SettingsMongo from "../models/SettingsMongo.js";

const MOTD_FIELDS = ["motd", "motd2", "motdEn", "motd2En"];
// Same limit the admin form enforces (Frontend/src/utils/motd.js)
const MAX_MOTD_LENGTH = 180;

const cleanMotd = (value) =>
  String(value).replace(/<[^>]*>/g, "").trim().slice(0, MAX_MOTD_LENGTH);

const motdPayload = (settings) =>
  Object.fromEntries(MOTD_FIELDS.map((field) => [field, settings?.[field] || ""]));

// @desc    Get MOTD
// @route   GET /api/settings/motd
// @access  Public
export const getMotd = async (req, res) => {
  try {
    let settings = await SettingsMongo.findOne();
    if (!settings) {
      settings = await SettingsMongo.create({ motd: "" });
    }
    res.json({ success: true, ...motdPayload(settings) });
  } catch (error) {
    console.error("❌ Error fetching MOTD:", error);
    res.status(500).json({ success: false, message: "שגיאה בטעינת ההודעה" });
  }
};

// @desc    Update MOTD
// @route   PUT /api/settings/motd
// @access  Private/Admin
export const updateMotd = async (req, res) => {
  try {
    if (req.body?.motd === undefined) {
      return res
        .status(400)
        .json({ success: false, message: "motd הוא שדה חובה" });
    }

    // Only the slots the request includes are changed; anything that isn't a
    // plain string is ignored.
    const update = {};
    for (const field of MOTD_FIELDS) {
      const value = req.body[field];
      if (typeof value === "string") update[field] = cleanMotd(value);
    }

    const settings = await SettingsMongo.findOneAndUpdate({}, update, {
      new: true,
      upsert: true,
    });

    res.json({ success: true, ...motdPayload(settings) });
  } catch (error) {
    console.error("❌ Error updating MOTD:", error);
    res.status(500).json({ success: false, message: "שגיאה בעדכון ההודעה" });
  }
};
