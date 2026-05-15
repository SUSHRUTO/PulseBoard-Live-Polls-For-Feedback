import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { ClipboardList, Clock, FilePlus2, RadioTower, Share2, Users } from "lucide-react";
import Loading from "../components/Loading";
import StatCard from "../components/StatCard";
import { api, publicPollUrl } from "../lib/api";

function stateLabel(state) {
  if (state === "published") return "Published";
  if (state === "expired") return "Expired";
  return "Live";
}

export default function Dashboard() {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/polls")
      .then((data) => setPolls(data.polls))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const totals = useMemo(
    () => ({
      polls: polls.length,
      responses: polls.reduce((sum, poll) => sum + poll.responseCount, 0),
      active: polls.filter((poll) => poll.state === "active").length,
      published: polls.filter((poll) => poll.state === "published").length
    }),
    [polls]
  );

  if (loading) return <Loading label="Loading dashboard" />;

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Creator console</p>
          <h1>Dashboard</h1>
        </div>
        <Link className="primary-button" to="/polls/new">
          <FilePlus2 size={18} />
          New poll
        </Link>
      </div>

      {error ? <div className="form-error">{error}</div> : null}

      <section className="stats-grid" aria-label="Workspace summary">
        <StatCard label="Polls" value={totals.polls} detail="created" icon={ClipboardList} />
        <StatCard label="Responses" value={totals.responses} detail="collected" icon={Users} tone="coral" />
        <StatCard label="Live" value={totals.active} detail="accepting answers" icon={RadioTower} tone="green" />
        <StatCard label="Published" value={totals.published} detail="public results" icon={Share2} tone="indigo" />
      </section>

      <section className="list-section">
        <div className="section-title">
          <h2>Your polls</h2>
        </div>

        {polls.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={38} />
            <h3>No polls yet</h3>
            <p>Create your first poll and share the public link with respondents.</p>
            <Link className="primary-button" to="/polls/new">
              <FilePlus2 size={18} />
              Create poll
            </Link>
          </div>
        ) : (
          <div className="poll-list">
            {polls.map((poll) => (
              <article className="poll-row" key={poll.id}>
                <div className="poll-main">
                  <span className={`status-pill state-${poll.state}`}>{stateLabel(poll.state)}</span>
                  <h3>{poll.title}</h3>
                  <p>{poll.description || "No description provided."}</p>
                  <div className="poll-meta">
                    <span>
                      <Clock size={15} />
                      Expires {formatDistanceToNowStrict(new Date(poll.expiresAt), { addSuffix: true })}
                    </span>
                    <span>{poll.questionCount} questions</span>
                    <span>{poll.responseMode === "AUTHENTICATED" ? "Authenticated" : "Anonymous"} mode</span>
                  </div>
                </div>
                <div className="poll-actions">
                  <strong>{poll.responseCount}</strong>
                  <span>responses</span>
                  <Link className="secondary-button compact" to={`/polls/${poll.id}`}>
                    Analytics
                  </Link>
                  <a className="ghost-link" href={publicPollUrl(poll.slug)} target="_blank" rel="noreferrer">
                    Public link
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
