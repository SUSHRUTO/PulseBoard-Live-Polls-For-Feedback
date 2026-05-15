const express = require("express");
const { and, asc, count, desc, eq, inArray } = require("drizzle-orm");
const { z } = require("zod");
const { db } = require("../db/client");
const { polls, pollQuestions, pollOptions, pollResponses } = require("../db/schema");
const validate = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { createId, createSlug } = require("../services/slug");
const { computePollAnalytics, pollState } = require("../services/analytics");

const router = express.Router();

const optionSchema = z.object({
  text: z.string().trim().min(1).max(180)
});

const questionSchema = z.object({
  text: z.string().trim().min(3).max(240),
  mandatory: z.boolean().default(true),
  options: z.array(optionSchema).min(2).max(8)
});

const createPollSchema = z.object({
  title: z.string().trim().min(4).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  responseMode: z.enum(["ANONYMOUS", "AUTHENTICATED"]),
  expiresAt: z.coerce.date().refine((value) => value > new Date(), {
    message: "Expiry must be in the future."
  }),
  questions: z.array(questionSchema).min(1).max(20)
});

async function attachQuestions(client, poll) {
  const questionRows = await client
    .select()
    .from(pollQuestions)
    .where(eq(pollQuestions.pollId, poll.id))
    .orderBy(asc(pollQuestions.position));

  const optionRows = questionRows.length
    ? await client
        .select()
        .from(pollOptions)
        .where(
          inArray(
            pollOptions.questionId,
            questionRows.map((question) => question.id)
          )
        )
        .orderBy(asc(pollOptions.questionId), asc(pollOptions.position))
    : [];

  const optionsByQuestion = optionRows.reduce((map, option) => {
    const current = map.get(option.questionId) || [];
    current.push(option);
    map.set(option.questionId, current);
    return map;
  }, new Map());

  return {
    ...poll,
    questions: questionRows.map((question) => ({
      ...question,
      options: optionsByQuestion.get(question.id) || []
    }))
  };
}

async function countRows(client, table, condition) {
  const [row] = await client.select({ value: count() }).from(table).where(condition);
  return row?.value || 0;
}

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const ownedPolls = await db
      .select()
      .from(polls)
      .where(eq(polls.creatorId, req.user.id))
      .orderBy(desc(polls.createdAt));

    const pollSummaries = await Promise.all(
      ownedPolls.map(async (poll) => ({
        id: poll.id,
        slug: poll.slug,
        title: poll.title,
        description: poll.description,
        responseMode: poll.responseMode,
        expiresAt: poll.expiresAt,
        publishedAt: poll.publishedAt,
        createdAt: poll.createdAt,
        state: pollState(poll),
        responseCount: await countRows(db, pollResponses, eq(pollResponses.pollId, poll.id)),
        questionCount: await countRows(db, pollQuestions, eq(pollQuestions.pollId, poll.id))
      }))
    );

    res.json({
      polls: pollSummaries
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", validate(createPollSchema), async (req, res, next) => {
  try {
    const { title, description, responseMode, expiresAt, questions } = req.body;
    const now = new Date();
    const pollId = createId();

    const poll = await db.transaction(async (tx) => {
      await tx
        .insert(polls)
        .values({
          id: pollId,
          title,
          description: description || null,
          responseMode,
          expiresAt,
          slug: createSlug(title),
          creatorId: req.user.id,
          createdAt: now,
          updatedAt: now
        });

      for (const [questionIndex, question] of questions.entries()) {
        const questionId = createId();
        await tx
          .insert(pollQuestions)
          .values({
            id: questionId,
            pollId,
            text: question.text,
            mandatory: question.mandatory,
            position: questionIndex
          });

        for (const [optionIndex, option] of question.options.entries()) {
          await tx
            .insert(pollOptions)
            .values({
              id: createId(),
              questionId,
              text: option.text,
              position: optionIndex
            });
        }
      }

      const [created] = await tx.select().from(polls).where(eq(polls.id, pollId)).limit(1);
      return attachQuestions(tx, created);
    });

    res.status(201).json({ poll });
  } catch (error) {
    next(error);
  }
});

router.get("/:pollId", async (req, res, next) => {
  try {
    const [poll] = await db
      .select()
      .from(polls)
      .where(and(eq(polls.id, req.params.pollId), eq(polls.creatorId, req.user.id)))
      .limit(1);

    if (!poll) {
      return res.status(404).json({ message: "Poll not found." });
    }

    const fullPoll = await attachQuestions(db, poll);
    return res.json({
      poll: {
        ...fullPoll,
        state: pollState(poll),
        responseCount: await countRows(db, pollResponses, eq(pollResponses.pollId, poll.id))
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/:pollId/analytics", async (req, res, next) => {
  try {
    const [poll] = await db
      .select({ id: polls.id })
      .from(polls)
      .where(and(eq(polls.id, req.params.pollId), eq(polls.creatorId, req.user.id)))
      .limit(1);

    if (!poll) {
      return res.status(404).json({ message: "Poll not found." });
    }

    const analytics = await computePollAnalytics(poll.id);
    return res.json({ analytics });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:pollId/publish", async (req, res, next) => {
  try {
    const [poll] = await db
      .select()
      .from(polls)
      .where(and(eq(polls.id, req.params.pollId), eq(polls.creatorId, req.user.id)))
      .limit(1);

    if (!poll) {
      return res.status(404).json({ message: "Poll not found." });
    }

    const [updated] = await db
      .update(polls)
      .set({
        publishedAt: poll.publishedAt || new Date(),
        updatedAt: new Date()
      })
      .where(eq(polls.id, poll.id))
      .returning();

    const analytics = await computePollAnalytics(updated.id);
    req.app.get("io")?.to(`poll:${updated.id}`).emit("poll:analytics", analytics);
    return res.json({ poll: { ...updated, state: pollState(updated) }, analytics });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
