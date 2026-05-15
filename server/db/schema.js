const {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex
} = require("drizzle-orm/pg-core");

const responseModeEnum = pgEnum("response_mode", ["ANONYMOUS", "AUTHENTICATED"]);

const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    oidcSubject: text("oidc_subject"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    uniqueIndex("users_email_unique").on(table.email),
    uniqueIndex("users_oidc_subject_unique").on(table.oidcSubject)
  ]
);

const polls = pgTable(
  "polls",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    responseMode: responseModeEnum("response_mode").notNull().default("ANONYMOUS"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    creatorId: text("creator_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
  },
  (table) => [
    uniqueIndex("polls_slug_unique").on(table.slug),
    index("polls_creator_idx").on(table.creatorId),
    index("polls_expires_idx").on(table.expiresAt)
  ]
);

const pollQuestions = pgTable(
  "questions",
  {
    id: text("id").primaryKey(),
    pollId: text("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    mandatory: boolean("mandatory").notNull().default(true),
    position: integer("position").notNull()
  },
  (table) => [index("questions_poll_idx").on(table.pollId)]
);

const pollOptions = pgTable(
  "options",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id")
      .notNull()
      .references(() => pollQuestions.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    position: integer("position").notNull()
  },
  (table) => [index("options_question_idx").on(table.questionId)]
);

const pollResponses = pgTable(
  "poll_responses",
  {
    id: text("id").primaryKey(),
    pollId: text("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    respondentUserId: text("respondent_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    anonymousId: text("anonymous_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull()
  },
  (table) => [
    uniqueIndex("poll_responses_poll_user_unique").on(table.pollId, table.respondentUserId),
    index("poll_responses_poll_idx").on(table.pollId),
    index("poll_responses_created_idx").on(table.createdAt)
  ]
);

const answers = pgTable(
  "answers",
  {
    id: text("id").primaryKey(),
    responseId: text("response_id")
      .notNull()
      .references(() => pollResponses.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => pollQuestions.id, { onDelete: "cascade" }),
    optionId: text("option_id")
      .notNull()
      .references(() => pollOptions.id, { onDelete: "cascade" })
  },
  (table) => [
    uniqueIndex("answers_response_question_unique").on(table.responseId, table.questionId),
    index("answers_question_idx").on(table.questionId),
    index("answers_option_idx").on(table.optionId)
  ]
);

module.exports = {
  responseModeEnum,
  users,
  polls,
  pollQuestions,
  pollOptions,
  pollResponses,
  answers
};
