import express from "express";
import rateLimit from "express-rate-limit";
import { sendContactEmail } from "../controllers/contactController.js";

const router = express.Router();

// Each submission sends two emails (one to the visitor's address), so keep it
// well below what a script could use to spam through the shop's sender.
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "שלחת מספר פניות ברצף. נסה שוב מאוחר יותר",
  },
});

// POST /api/contact - Send contact form email
router.post("/", contactLimiter, sendContactEmail);

export default router;
