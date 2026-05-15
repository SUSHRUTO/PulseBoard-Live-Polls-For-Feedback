const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");
const env = require("../config/env");
const schema = require("./schema");

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined
});

const db = drizzle(pool, { schema });

async function closeDb() {
  await pool.end();
}

module.exports = { db, pool, closeDb };
