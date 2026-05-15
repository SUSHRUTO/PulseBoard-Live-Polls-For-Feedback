const { eq } = require("drizzle-orm");
const { db } = require("../db/client");
const { users } = require("../db/schema");
const { cookieName, verifySession } = require("../services/tokens");

async function attachUser(req, _res, next) {
  try {
    const token = req.cookies?.[cookieName];
    if (!token) {
      req.user = null;
      return next();
    }

    const payload = verifySession(token);
    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        createdAt: users.createdAt
      })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    req.user = user || null;
    return next();
  } catch (_error) {
    req.user = null;
    return next();
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required." });
  }
  return next();
}

module.exports = { attachUser, requireAuth };
