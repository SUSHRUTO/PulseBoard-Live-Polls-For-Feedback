const { pool, closeDb } = require("./client");

async function initializeDatabase() {
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'response_mode') THEN
        CREATE TYPE response_mode AS ENUM ('ANONYMOUS', 'AUTHENTICATED');
      END IF;
    END
    $$;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT,
      oidc_subject TEXT,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email);
    CREATE UNIQUE INDEX IF NOT EXISTS users_oidc_subject_unique ON users(oidc_subject);

    CREATE TABLE IF NOT EXISTS polls (
      id TEXT PRIMARY KEY NOT NULL,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      response_mode response_mode NOT NULL DEFAULT 'ANONYMOUS',
      expires_at TIMESTAMPTZ NOT NULL,
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS polls_slug_unique ON polls(slug);
    CREATE INDEX IF NOT EXISTS polls_creator_idx ON polls(creator_id);
    CREATE INDEX IF NOT EXISTS polls_expires_idx ON polls(expires_at);

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY NOT NULL,
      poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      mandatory BOOLEAN NOT NULL DEFAULT TRUE,
      position INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS questions_poll_idx ON questions(poll_id);

    CREATE TABLE IF NOT EXISTS options (
      id TEXT PRIMARY KEY NOT NULL,
      question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      position INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS options_question_idx ON options(question_id);

    CREATE TABLE IF NOT EXISTS poll_responses (
      id TEXT PRIMARY KEY NOT NULL,
      poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
      respondent_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      anonymous_id TEXT,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS poll_responses_poll_user_unique
      ON poll_responses(poll_id, respondent_user_id);
    CREATE INDEX IF NOT EXISTS poll_responses_poll_idx ON poll_responses(poll_id);
    CREATE INDEX IF NOT EXISTS poll_responses_created_idx ON poll_responses(created_at);

    CREATE TABLE IF NOT EXISTS answers (
      id TEXT PRIMARY KEY NOT NULL,
      response_id TEXT NOT NULL REFERENCES poll_responses(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      option_id TEXT NOT NULL REFERENCES options(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS answers_response_question_unique
      ON answers(response_id, question_id);
    CREATE INDEX IF NOT EXISTS answers_question_idx ON answers(question_id);
    CREATE INDEX IF NOT EXISTS answers_option_idx ON answers(option_id);
  `);
}

if (require.main === module) {
  initializeDatabase()
    .then(async () => {
      console.log("PostgreSQL database tables are ready.");
      await closeDb();
    })
    .catch(async (error) => {
      console.error(error);
      await closeDb();
      process.exit(1);
    });
}

module.exports = { initializeDatabase };
