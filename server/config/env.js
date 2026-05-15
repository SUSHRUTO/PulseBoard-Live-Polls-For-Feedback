const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env"), quiet: true });

const isProduction = process.env.NODE_ENV === "production";

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction,
  port: Number(process.env.PORT || 4000),
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgres://pollpulse:pollpulse@localhost:5433/pollpulse",
  databaseSsl: process.env.DATABASE_SSL === "true",
  jwtSecret:
    process.env.JWT_SECRET ||
    (isProduction ? undefined : "dev-only-change-me-before-production"),
  redisUrl: process.env.REDIS_URL || "",
  oidc: {
    issuerUrl: process.env.OIDC_ISSUER_URL || "",
    clientId: process.env.OIDC_CLIENT_ID || "",
    clientSecret: process.env.OIDC_CLIENT_SECRET || "",
    callbackUrl:
      process.env.OIDC_CALLBACK_URL ||
      `http://localhost:${process.env.PORT || 4000}/api/auth/oidc/callback`
  }
};

if (!env.jwtSecret) {
  throw new Error("JWT_SECRET is required in production.");
}

module.exports = env;
