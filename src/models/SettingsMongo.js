import mongoose from "mongoose";

// Top-banner messages ("message of the day"). Two slots, each with an
// optional English version shown to visitors browsing in English.
const settingsSchema = new mongoose.Schema(
  {
    motd: { type: String, default: "" },
    motd2: { type: String, default: "" },
    motdEn: { type: String, default: "" },
    motd2En: { type: String, default: "" },
  },
  { timestamps: true },
);

const SettingsMongo = mongoose.model("Settings", settingsSchema);

export default SettingsMongo;
