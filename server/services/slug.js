const crypto = require("crypto");

function createSlug(title) {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 52);

  const suffix = crypto.randomBytes(4).toString("hex");
  return `${base || "poll"}-${suffix}`;
}

function anonymousId() {
  return crypto.randomBytes(12).toString("hex");
}

function createId() {
  return crypto.randomUUID();
}

module.exports = { createSlug, anonymousId, createId };
