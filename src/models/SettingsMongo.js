import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    motd: { type: String, default: "" },
  },
  { timestamps: true },
);

const SettingsMongo = mongoose.model("Settings", settingsSchema);

export default SettingsMongo;
