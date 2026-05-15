const { Issuer, generators } = require("openid-client");
const env = require("../config/env");

let cachedClient = null;

function isOidcConfigured() {
  return Boolean(
    env.oidc.issuerUrl &&
      env.oidc.clientId &&
      env.oidc.clientSecret &&
      env.oidc.callbackUrl
  );
}

async function getOidcClient() {
  if (!isOidcConfigured()) return null;
  if (cachedClient) return cachedClient;

  const issuer = await Issuer.discover(env.oidc.issuerUrl);
  cachedClient = new issuer.Client({
    client_id: env.oidc.clientId,
    client_secret: env.oidc.clientSecret,
    redirect_uris: [env.oidc.callbackUrl],
    response_types: ["code"]
  });

  return cachedClient;
}

function createOidcState() {
  return {
    state: generators.state(),
    nonce: generators.nonce()
  };
}

module.exports = { isOidcConfigured, getOidcClient, createOidcState };
