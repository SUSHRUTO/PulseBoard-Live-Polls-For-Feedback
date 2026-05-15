import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, LockKeyhole, Mail, RadioTower, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { API_BASE, api } from "../lib/api";

export default function Login() {
  const { user, loading, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState("login");
  const [oidcAvailable, setOidcAvailable] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/api/auth/oidc/available")
      .then((data) => setOidcAvailable(data.available))
      .catch(() => setOidcAvailable(false));
  }, []);

  if (!loading && user) {
    return <Navigate to={location.state?.from || "/dashboard"} replace />;
  }

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      if (mode === "login") {
        await login({ email: form.email, password: form.password });
      } else {
        await register(form);
      }
      navigate(location.state?.from || "/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-brand">
          <span className="brand-mark">
            <RadioTower size={22} />
          </span>
          <span>PollPulse</span>
        </div>

        <div className="auth-copy">
          <p className="eyebrow">Full-stack polling workspace</p>
          <h1>Ship polls with live feedback and publishable outcomes.</h1>
        </div>

        <div className="auth-highlights">
          <span>
            <ShieldCheck size={17} />
            Protected creator dashboard
          </span>
          <span>
            <LockKeyhole size={17} />
            Email auth plus optional OIDC
          </span>
          <span>
            <Mail size={17} />
            Public links for respondents
          </span>
        </div>
      </section>

      <section className="auth-card" aria-label="Authentication form">
        <div className="segmented">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="stacked-form">
          {mode === "register" ? (
            <label>
              Name
              <input
                required
                name="name"
                value={form.name}
                onChange={updateField}
                placeholder="Aarav Mehta"
                autoComplete="name"
              />
            </label>
          ) : null}

          <label>
            Email
            <input
              required
              name="email"
              type="email"
              value={form.email}
              onChange={updateField}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          <label>
            Password
            <input
              required
              minLength={mode === "register" ? 8 : 1}
              name="password"
              type="password"
              value={form.password}
              onChange={updateField}
              placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
            />
          </label>

          {error ? <div className="form-error">{error}</div> : null}

          <button className="primary-button full" type="submit" disabled={busy}>
            {busy ? "Working" : mode === "login" ? "Sign in" : "Create account"}
            <ArrowRight size={18} />
          </button>
        </form>

        {oidcAvailable ? (
          <a className="secondary-button full" href={`${API_BASE}/api/auth/oidc/login`}>
            Continue with OIDC
          </a>
        ) : null}

        <p className="auth-footnote">
          Public poll pages stay accessible without an account unless the creator requires
          authenticated responses.
        </p>

        <Link className="subtle-link" to="/">
          Return home
        </Link>
      </section>
    </main>
  );
}
