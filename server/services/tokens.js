const jwt = require("jsonwebtoken");
const env = require("../config/env");

const cookieName = "pollpulse_session";
const cookieOptions = {
  httpOnly: true,
  sameSite: env.isProduction ? "none" : "lax",
  secure: env.isProduction,
  maxAge: 1000 * 60 * 60 * 24 * 7,
  path: "/"
};

function signSession(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name
    },
    env.jwtSecret,
    { expiresIn: "7d" }
  );
}

function verifySession(token) {
  return jwt.verify(token, env.jwtSecret);
}

function setSessionCookie(res, user) {
  res.cookie(cookieName, signSession(user), cookieOptions);
}

function clearSessionCookie(res) {
  res.clearCookie(cookieName, { ...cookieOptions, maxAge: undefined });
}

module.exports = {
  cookieName,
  cookieOptions,
  signSession,
  verifySession,
  setSessionCookie,
  clearSessionCookie
};
