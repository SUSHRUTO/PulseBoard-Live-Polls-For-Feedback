const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { eq } = require("drizzle-orm");
const { z } = require("zod");
const env = require("../config/env");
const { db } = require("../db/client");
const { users } = require("../db/schema");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimit");
const { setSessionCookie, clearSessionCookie } = require("../services/tokens");
const { isOidcConfigured, getOidcClient, createOidcState } = require("../services/oidc");
const { createId } = require("../services/slug");

const router = express.Router();

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(128)
});

const loginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(1).max(128)
});

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt
  };
}

router.get("/me", (req, res) => {
  res.json({ user: req.user || null });
});

router.post("/register", authLimiter(), validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db
      .insert(users)
      .values({
        id: createId(),
        name,
        email,
        passwordHash,
        createdAt: new Date()
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt
      });

    setSessionCookie(res, user);
    return res.status(201).json({ user });
  } catch (error) {
    return next(error);
  }
});

router.post("/login", authLimiter(), validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const isValid = user?.passwordHash
      ? await bcrypt.compare(password, user.passwordHash)
      : false;

    if (!user || !isValid) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    setSessionCookie(res, user);
    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.post("/logout", requireAuth, (req, res) => {
  clearSessionCookie(res);
  res.json({ message: "Signed out." });
});

router.get("/oidc/available", (_req, res) => {
  res.json({ available: isOidcConfigured() });
});

router.get("/oidc/login", async (_req, res, next) => {
  try {
    const client = await getOidcClient();
    if (!client) {
      return res.status(404).json({ message: "OIDC login is not configured." });
    }

    const oidcState = createOidcState();
    const stateToken = jwt.sign(oidcState, env.jwtSecret, { expiresIn: "10m" });

    res.cookie("pollpulse_oidc", stateToken, {
      httpOnly: true,
      sameSite: env.isProduction ? "none" : "lax",
      secure: env.isProduction,
      maxAge: 10 * 60 * 1000,
      path: "/"
    });

    const authorizationUrl = client.authorizationUrl({
      scope: "openid email profile",
      state: oidcState.state,
      nonce: oidcState.nonce
    });

    return res.redirect(authorizationUrl);
  } catch (error) {
    return next(error);
  }
});

router.get("/oidc/callback", async (req, res, next) => {
  try {
    const client = await getOidcClient();
    const rawState = req.cookies?.pollpulse_oidc;
    if (!client || !rawState) {
      return res.redirect(`${env.clientUrl}/login?error=oidc`);
    }

    const expected = jwt.verify(rawState, env.jwtSecret);
    const params = client.callbackParams(req);
    const tokenSet = await client.callback(env.oidc.callbackUrl, params, expected);
    const claims = tokenSet.claims();

    const email = claims.email?.toLowerCase();
    if (!email) {
      return res.redirect(`${env.clientUrl}/login?error=email`);
    }

    const name = claims.name || claims.preferred_username || email.split("@")[0];
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = existing
      ? (
          await db
          .update(users)
          .set({ oidcSubject: claims.sub, name })
          .where(eq(users.email, email))
          .returning()
        )[0]
      : (
          await db
          .insert(users)
          .values({
            id: createId(),
            email,
            oidcSubject: claims.sub,
            name,
            createdAt: new Date()
          })
          .returning()
        )[0];

    res.clearCookie("pollpulse_oidc", { path: "/" });
    setSessionCookie(res, user);
    return res.redirect(env.clientUrl);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
