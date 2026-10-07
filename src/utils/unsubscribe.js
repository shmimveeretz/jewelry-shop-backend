import crypto from "crypto";
import { getFrontendUrl } from "./emailTemplates.js";

/**
 * One-click newsletter unsubscribe links.
 *
 * Israel's anti-spam law (Communications Law §30A) requires every marketing
 * email to carry a simple way to opt out. The link holds the address plus an
 * HMAC of it, so it works without logging in and cannot be forged to
 * unsubscribe someone else.
 */

const sign = (email) =>
  crypto
    .createHmac("sha256", process.env.JWT_SECRET || "")
    .update(`unsubscribe:${String(email).trim().toLowerCase()}`)
    .digest("hex");

export const createUnsubscribeToken = (email) => sign(email);

export const isValidUnsubscribeToken = (email, token) => {
  if (typeof email !== "string" || typeof token !== "string") return false;
  const expected = Buffer.from(sign(email));
  const received = Buffer.from(token);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
};

/** Storefront page that confirms the opt-out (it calls the API itself). */
export const buildUnsubscribeUrl = (email) => {
  const params = new URLSearchParams({
    email: String(email).trim().toLowerCase(),
    token: createUnsubscribeToken(email),
  });
  return getFrontendUrl(`/unsubscribe?${params.toString()}`);
};
