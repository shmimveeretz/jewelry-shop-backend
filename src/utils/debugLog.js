// #region agent log
// Temporary debug-session logger (session 390f6a). Appends NDJSON lines to the
// session log file and mirrors to the debug ingest server when available.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_PATH = path.resolve(__dirname, "../../../debug-390f6a.log");

export function dbg(payload) {
  const entry = {
    sessionId: "390f6a",
    timestamp: Date.now(),
    ...payload,
  };
  try {
    fs.appendFile(LOG_PATH, JSON.stringify(entry) + "\n", () => {});
  } catch {
    /* noop */
  }
  fetch("http://127.0.0.1:7344/ingest/04171ffe-b9c7-4a68-aa80-feae36360d3e", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "390f6a",
    },
    body: JSON.stringify(entry),
  }).catch(() => {});
}
// #endregion
