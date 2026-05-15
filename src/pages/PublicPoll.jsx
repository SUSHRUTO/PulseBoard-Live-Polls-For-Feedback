import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import { io } from "socket.io-client";
import { CheckCircle2, LockKeyhole, RadioTower, Send } from "lucide-react";
import Loading from "../components/Loading";
import { useAuth } from "../context/AuthContext";
import { SOCKET_BASE, api } from "../lib/api";

function PublishedResults({ analytics }) {
  if (!analytics) return null;
  return (
    <section className="public-results">
      <div className="public-result-summary">
        <strong>{analytics.totals.totalResponses}</strong>
        <span>total responses</span>
      </div>
      {analytics.questions.map((question) => (
        <article className="analytics-card" key={question.id}>
          <div className="analytics-card-head">
            <h2>{question.text}</h2>
            <strong>{question.totalAnswers} answers</strong>
          </div>
          <div className="result-list">
            {question.options.map((option) => (
              <div className="result-row" key={option.id}>
                <div className="result-label">
                  <span>{option.text}</span>
                  <strong>{option.count}</strong>
                </div>
                <div className="bar-track">
                  <span style={{ width: `${option.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}

export default function PublicPoll() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [poll, setPoll] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [liveCount, setLiveCount] = useState(null);

  useEffect(() => {
    api(`/api/public/polls/${slug}`)
      .then((data) => {
        setPoll(data.poll);
        setLiveCount(data.poll.analytics?.totals?.totalResponses ?? null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!slug) return undefined;
    const socket = io(SOCKET_BASE, { withCredentials: true });
    socket.emit("poll:join", { slug });
    socket.on("poll:submitted", (data) => setLiveCount(data.totalResponses));
    return () => {
      socket.emit("poll:leave", { slug });
      socket.disconnect();
    };
  }, [slug]);

  const requiredMissing = useMemo(() => {
    if (!poll) return [];
    return poll.questions.filter((question) => question.mandatory && !answers[question.id]);
  }, [poll, answers]);

  function selectAnswer(questionId, optionId) {
    setAnswers((current) => ({ ...current, [questionId]: optionId }));
  }

  async function submitResponse(event) {
    event.preventDefault();
    setError("");

    if (requiredMissing.length) {
      setError("Please answer every mandatory question.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        answers: Object.entries(answers).map(([questionId, optionId]) => ({ questionId, optionId }))
      };
      const data = await api(`/api/public/polls/${slug}/responses`, {
        method: "POST",
        body: payload
      });
      setLiveCount(data.analytics.totals.totalResponses);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Loading label="Opening poll" />;

  if (!poll) {
    return (
      <main className="public-page">
        <section className="public-card">
          <h1>Poll unavailable</h1>
          <p>{error || "This poll link could not be found."}</p>
        </section>
      </main>
    );
  }

  const isLocked = poll.requiresAuth && !user;
  const isPublished = poll.state === "published";
  const isClosed = poll.state === "expired" && !isPublished;

  return (
    <main className="public-page">
      <header className="public-header">
        <Link className="auth-brand" to="/">
          <span className="brand-mark">
            <RadioTower size={20} />
          </span>
          <span>PollPulse</span>
        </Link>
        {user ? <span className="public-user">{user.name}</span> : <Link className="secondary-button compact" to="/login">Sign in</Link>}
      </header>

      <section className="public-card">
        <div className="public-title">
          <span className={`status-pill state-${poll.state}`}>
            {isPublished ? "Results published" : isClosed ? "Closed" : "Accepting responses"}
          </span>
          <h1>{poll.title}</h1>
          {poll.description ? <p>{poll.description}</p> : null}
          <div className="poll-meta public-meta">
            <span>Expires {format(new Date(poll.expiresAt), "dd MMM yyyy, h:mm a")}</span>
            <span>{poll.requiresAuth ? "Authenticated responses" : "Anonymous responses"}</span>
            {liveCount !== null ? <span>{liveCount} responses</span> : null}
          </div>
        </div>

        {isPublished ? (
          <PublishedResults analytics={poll.analytics} />
        ) : isClosed ? (
          <div className="empty-state small">
            <CheckCircle2 size={34} />
            <h2>This poll has expired.</h2>
            <p>Responses are closed until the creator publishes final results.</p>
          </div>
        ) : success ? (
          <div className="empty-state small">
            <CheckCircle2 size={38} />
            <h2>Response submitted.</h2>
            <p>Your feedback has been recorded.</p>
          </div>
        ) : isLocked ? (
          <div className="empty-state small">
            <LockKeyhole size={36} />
            <h2>Sign in required.</h2>
            <p>The creator requires authenticated responses for this poll.</p>
            <Link className="primary-button" to="/login" state={{ from: `/p/${slug}` }}>
              Sign in to continue
            </Link>
          </div>
        ) : (
          <form className="public-form" onSubmit={submitResponse}>
            {poll.questions.map((question, index) => (
              <fieldset className="response-question" key={question.id}>
                <legend>
                  <span>Question {index + 1}</span>
                  {question.text}
                  {!question.mandatory ? <em>Optional</em> : null}
                </legend>
                <div className="radio-options">
                  {question.options.map((option) => (
                    <label key={option.id} className={answers[question.id] === option.id ? "selected" : ""}>
                      <input
                        type="radio"
                        name={question.id}
                        value={option.id}
                        checked={answers[question.id] === option.id}
                        required={question.mandatory}
                        onChange={() => selectAnswer(question.id, option.id)}
                      />
                      <span>{option.text}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}

            {error ? <div className="form-error">{error}</div> : null}

            <button className="primary-button full" type="submit" disabled={submitting}>
              <Send size={18} />
              {submitting ? "Submitting" : "Submit response"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
