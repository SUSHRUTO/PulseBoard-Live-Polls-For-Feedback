const express = require("express");
const { and, asc, eq, inArray } = require("drizzle-orm");
const { z } = require("zod");
const { db } = require("../db/client");
const {
  answers,
  polls,
  pollOptions,
  pollQuestions,
  pollResponses
} = require("../db/schema");
const validate = require("../middleware/validate");
const { pollSubmissionLimiter } = require("../middleware/rateLimit");
const { anonymousId, createId } = require("../services/slug");
const { computePollAnalytics, pollState } = require("../services/analytics");

const router = express.Router();

const responseSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        optionId: z.string().min(1)
      })
    )
    .max(20)
});

async function getPollWithQuestionsBySlug(slug) {
  const [poll] = await db.select().from(polls).where(eq(polls.slug, slug)).limit(1);
  if (!poll) return null;

  const questionRows = await db
    .select()
    .from(pollQuestions)
    .where(eq(pollQuestions.pollId, poll.id))
    .orderBy(asc(pollQuestions.position));

  const optionRows = questionRows.length
    ? await db
        .select()
        .from(pollOptions)
        .where(inArray(pollOptions.questionId, questionRows.map((question) => question.id)))
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

function publicPollShape(poll, analytics = null) {
  const state = pollState(poll);
  return {
    id: poll.id,
    slug: poll.slug,
    title: poll.title,
    description: poll.description,
    responseMode: poll.responseMode,
    expiresAt: poll.expiresAt,
    publishedAt: poll.publishedAt,
    state,
    canRespond: state === "active",
    requiresAuth: poll.responseMode === "AUTHENTICATED",
    questions: poll.questions.map((question) => ({
      id: question.id,
      text: question.text,
      mandatory: question.mandatory,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text
      }))
    })),
    analytics: state === "published" ? analytics : null
  };
}

router.get("/:slug", async (req, res, next) => {
  try {
    const poll = await getPollWithQuestionsBySlug(req.params.slug);

    if (!poll) {
      return res.status(404).json({ message: "Poll not found." });
    }

    const analytics = poll.publishedAt ? await computePollAnalytics(poll.id) : null;
    return res.json({ poll: publicPollShape(poll, analytics) });
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/:slug/responses",
  pollSubmissionLimiter(),
  validate(responseSchema),
  async (req, res, next) => {
    try {
      const poll = await getPollWithQuestionsBySlug(req.params.slug);

      if (!poll) {
        return res.status(404).json({ message: "Poll not found." });
      }

      const state = pollState(poll);
      if (state !== "active") {
        return res.status(409).json({ message: "This poll is no longer accepting responses." });
      }

      if (poll.responseMode === "AUTHENTICATED" && !req.user) {
        return res.status(401).json({ message: "Please sign in before submitting this poll." });
      }

      const answersByQuestion = new Map(
        req.body.answers.map((answer) => [answer.questionId, answer.optionId])
      );

      const errors = [];
      const answerCreates = [];

      for (const question of poll.questions) {
        const selectedOptionId = answersByQuestion.get(question.id);
        if (!selectedOptionId) {
          if (question.mandatory) errors.push(`${question.text} is required.`);
          continue;
        }

        const validOption = question.options.some((option) => option.id === selectedOptionId);
        if (!validOption) {
          errors.push(`Invalid option selected for ${question.text}.`);
          continue;
        }

        answerCreates.push({
          questionId: question.id,
          optionId: selectedOptionId
        });
      }

      if (errors.length) {
        return res.status(400).json({ message: "Please fix the response.", errors });
      }

      if (poll.responseMode === "AUTHENTICATED" && req.user) {
        const [existing] = await db
          .select({ id: pollResponses.id })
          .from(pollResponses)
          .where(
            and(
              eq(pollResponses.pollId, poll.id),
              eq(pollResponses.respondentUserId, req.user.id)
            )
          )
          .limit(1);

        if (existing) {
          return res.status(409).json({ message: "You have already submitted this poll." });
        }
      }

      const responseId = createId();
      await db.transaction(async (tx) => {
        await tx
          .insert(pollResponses)
          .values({
            id: responseId,
            pollId: poll.id,
            respondentUserId: req.user?.id || null,
            anonymousId: req.user ? null : anonymousId(),
            createdAt: new Date()
          });

        for (const answer of answerCreates) {
          await tx
            .insert(answers)
            .values({
              id: createId(),
              responseId,
              questionId: answer.questionId,
              optionId: answer.optionId
            });
        }
      });

      const analytics = await computePollAnalytics(poll.id);
      req.app.get("io")?.to(`poll:${poll.id}`).emit("poll:analytics", analytics);
      req.app.get("io")?.to(`public:${poll.slug}`).emit("poll:submitted", {
        pollId: poll.id,
        slug: poll.slug,
        totalResponses: analytics.totals.totalResponses
      });

      return res.status(201).json({ responseId, analytics });
    } catch (error) {
      return next(error);
    }
  }
);

module.exports = router;
