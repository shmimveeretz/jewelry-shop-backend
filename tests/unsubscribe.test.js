import { test } from "node:test";
import assert from "node:assert/strict";

process.env.JWT_SECRET = "test-secret";
const { createUnsubscribeToken, isValidUnsubscribeToken } = await import(
  "../src/utils/unsubscribe.js"
);

test("a token unsubscribes only the address it was made for", () => {
  const token = createUnsubscribeToken("Dana@Example.com");
  assert.equal(isValidUnsubscribeToken("dana@example.com", token), true);
  assert.equal(isValidUnsubscribeToken(" DANA@example.com ", token), true);
  assert.equal(isValidUnsubscribeToken("other@example.com", token), false);
});

test("tampered or malformed tokens are rejected", () => {
  const token = createUnsubscribeToken("dana@example.com");
  const flipped = (token[0] === "a" ? "b" : "a") + token.slice(1);
  assert.equal(isValidUnsubscribeToken("dana@example.com", flipped), false);
  assert.equal(isValidUnsubscribeToken("dana@example.com", token.slice(0, -1)), false);
  assert.equal(isValidUnsubscribeToken("dana@example.com", ""), false);
  assert.equal(isValidUnsubscribeToken("dana@example.com", undefined), false);
  assert.equal(isValidUnsubscribeToken(["dana@example.com"], token), false);
});
