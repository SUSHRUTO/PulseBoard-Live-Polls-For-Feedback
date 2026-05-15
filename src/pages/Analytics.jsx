import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format, formatDistanceToNowStrict } from "date-fns";
import { io } from "socket.io-client";
import { CheckCircle2, Copy, Eye, RadioTower, Send, Users } from "lucide-react";
import Loading from "../components/Loading";
import StatCard from "../components/StatCard";
import { SOCKET_BASE, api, publicPollUrl } from "../lib/api";

function ResultBars({ question }) {
  return (
    <div className="result-list">
      {question.options.map((option) => (
        <div className="result-row" key={option.id}>
          <div className="result-label">
            <span>{option.text}</span>
            <strong>{option.count}</strong>
          </div>
          <div className="bar-track" aria-label={`${option.percentage}%`}>
            <span style={{ width: `${option.percentage}%` }} />
          </div>
        </div>
      ))}
      {!question.mandatory && question.skipped > 0 ? (
        <div className="skip-note">{question.skipped} respondents skipped this optional question.</div>
      ) : null}
    </div>
  );
}

export default function Analytics() {
  const { pollId } = useParams();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    api(`/api/polls/${pollId}/analytics`)
      .then((data) => setAnalytics(data.analytics))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [pollId]);

  useEffect(() => {
    if (!pollId) return undefined;
    const socket = io(SOCKET_BASE, { withCredentials: true });
    socket.emit("poll:join", { pollId });
    socket.on("poll:analytics", (data) => setAnalytics(data));
    return () => {
      socket.emit("poll:leave", { pollId });
      socket.disconnect();
    };
  }, [pollId]);

  const link = useMemo(() => (analytics ? publicPollUrl(analytics.poll.slug) : ""), [analytics]);

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function publishResults() {
    setPublishing(true);
    setError("");
    try {
      const data = await api(`/api/polls/${pollId}/publish`, { method: "PATCH" });
      setAnalytics(data.analytics);
    } catch (err) {
      setError(err.message);
    } finally {
      setPublishing(false);
    }
  }

  if (loading) return <Loading label="Loading analytics" />;
  if (error && !analytics) return <div className="form-error">{error}</div>;
  if (!analytics) return null;

  const { poll, totals, questions } = analytics;

  return (
    <div className="page">
      <div className="page-heading analytics-heading">
        <div>
          <p className="eyebrow">Live analytics</p>
          <h1>{poll.title}</h1>
          <p className="page-subtitle">{poll.description}</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-button" type="button" onClick={copyLink}>
            <Copy size={18} />
            {copied ? "Copied" : "Copy link"}
          </button>
          <a className="secondary-button" href={link} target="_blank" rel="noreferrer">
            <Eye size={18} />
            Preview
          </a>
          <button
            className="primary-button"
            type="button"
            onClick={publishResults}
            disabled={Boolean(poll.publishedAt) || publishing}
          >
            <Send size={18} />
            {poll.publishedAt ? "Published" : publishing ? "Publishing" : "Publish results"}
          </button>
        </div>
      </div>

      {error ? <div className="form-error">{error}</div> : null}

      <section className="stats-grid">
        <StatCard label="Responses" value={totals.totalResponses} detail="live total" icon={Users} />
        <StatCard
          label="Completion"
          value={`${totals.completionRate}%`}
          detail="answered fields"
          icon={CheckCircle2}
          tone="green"
        />
        <StatCard
          label="Anonymous"
          value={totals.anonymousResponses}
          detail="responses"
          icon={RadioTower}
          tone="coral"
        />
        <StatCard
          label="Authenticated"
          value={totals.authenticatedResponses}
          detail="responses"
          icon={Users}
          tone="indigo"
        />
      </section>

      <section className="analytics-meta">
        <span className={`status-pill state-${poll.state}`}>
          {poll.state === "active" ? "Live" : poll.state === "published" ? "Published" : "Expired"}
        </span>
        <span>Expires {formatDistanceToNowStrict(new Date(poll.expiresAt), { addSuffix: true })}</span>
        <span>{poll.responseMode === "AUTHENTICATED" ? "Authenticated responses" : "Anonymous responses"}</span>
        {totals.latestResponseAt ? (
          <span>Latest response {format(new Date(totals.latestResponseAt), "dd MMM yyyy, h:mm a")}</span>
        ) : (
          <span>No responses yet</span>
        )}
      </section>

      <section className="question-results">
        {questions.map((question, index) => (
          <article className="analytics-card" key={question.id}>
            <div className="analytics-card-head">
              <div>
                <span>Question {index + 1}</span>
                <h2>{question.text}</h2>
              </div>
              <strong>{question.totalAnswers} answers</strong>
            </div>
            <ResultBars question={question} />
          </article>
        ))}
      </section>

      <div className="bottom-nav">
        <Link className="secondary-button" to="/dashboard">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
