const { asc, count, desc, eq, inArray } = require("drizzle-orm");
const { db } = require("../db/client");
const {
  answers,
  polls,
  pollOptions,
  pollQuestions,
  pollResponses
} = require("../db/schema");

function pollState(poll) {
  const now = new Date();
  if (poll.publishedAt) return "published";
  if (new Date(poll.expiresAt) <= now) return "expired";
  return "active";
}

async function computePollAnalytics(pollId) {
  const [poll] = await db.select().from(polls).where(eq(polls.id, pollId)).limit(1);
  if (!poll) return null;

  const questionRows = await db
    .select()
    .from(pollQuestions)
    .where(eq(pollQuestions.pollId, pollId))
    .orderBy(asc(pollQuestions.position));

  const optionRows = questionRows.length
    ? await db
        .select()
        .from(pollOptions)
        .where(inArray(pollOptions.questionId, questionRows.map((question) => question.id)))
        .orderBy(asc(pollOptions.questionId), asc(pollOptions.position))
    : [];

  const responseRows = await db
    .select({
      id: pollResponses.id,
      respondentUserId: pollResponses.respondentUserId,
      anonymousId: pollResponses.anonymousId,
      createdAt: pollResponses.createdAt
    })
    .from(pollResponses)
    .where(eq(pollResponses.pollId, pollId))
    .orderBy(desc(pollResponses.createdAt));

  const answerCounts = questionRows.length
    ? await db
        .select({
          optionId: answers.optionId,
          value: count(answers.id)
        })
        .from(answers)
        .innerJoin(pollQuestions, eq(answers.questionId, pollQuestions.id))
        .where(eq(pollQuestions.pollId, pollId))
        .groupBy(answers.optionId)
    : [];

  const countByOption = new Map(answerCounts.map((row) => [row.optionId, row.value]));
  const optionsByQuestion = optionRows.reduce((map, option) => {
    const current = map.get(option.questionId) || [];
    current.push(option);
    map.set(option.questionId, current);
    return map;
  }, new Map());

  const totalResponses = responseRows.length;
  const authenticatedResponses = responseRows.filter((response) => response.respondentUserId).length;
  const anonymousResponses = totalResponses - authenticatedResponses;
  const latestResponseAt = responseRows[0]?.createdAt || null;

  const questions = questionRows.map((question) => {
    const options = optionsByQuestion.get(question.id) || [];
    const totalAnswers = options.reduce(
      (sum, option) => sum + (countByOption.get(option.id) || 0),
      0
    );

    return {
      id: question.id,
      text: question.text,
      mandatory: question.mandatory,
      totalAnswers,
      skipped: Math.max(totalResponses - totalAnswers, 0),
      options: options.map((option) => {
        const optionCount = countByOption.get(option.id) || 0;
        return {
          id: option.id,
          text: option.text,
          count: optionCount,
          percentage: totalAnswers ? Math.round((optionCount / totalAnswers) * 100) : 0
        };
      })
    };
  });

  return {
    poll: {
      id: poll.id,
      slug: poll.slug,
      title: poll.title,
      description: poll.description,
      responseMode: poll.responseMode,
      expiresAt: poll.expiresAt,
      publishedAt: poll.publishedAt,
      createdAt: poll.createdAt,
      state: pollState(poll)
    },
    totals: {
      totalResponses,
      authenticatedResponses,
      anonymousResponses,
      latestResponseAt,
      completionRate: questionRows.length
        ? Math.round(
            (questions.reduce((sum, question) => sum + question.totalAnswers, 0) /
              (questions.length * Math.max(totalResponses, 1))) *
              100
          )
        : 0
    },
    questions
  };
}

module.exports = { computePollAnalytics, pollState };
