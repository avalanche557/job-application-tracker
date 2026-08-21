import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { user, login, loginError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate("/");
    } catch {
      // loginError from context already surfaces the message
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm space-y-5 p-8">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-ink font-mono text-[11px] font-semibold text-paper">
            JT
          </span>
          <h1 className="font-mono text-sm font-medium text-ink">Job Tracker</h1>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-ink">Welcome back</h2>
          <p className="mt-1 text-sm text-ink-soft">Log in to your account</p>
        </div>

        {loginError && (
          <p className="rounded-[5px] border border-rust/40 bg-rust-soft px-3 py-2 text-sm text-rust-ink">{loginError}</p>
        )}

        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </div>
        <button type="submit" disabled={submitting} className="btn btn-primary w-full">
          {submitting ? "Logging in…" : "Log in"}
        </button>
        <p className="text-center text-sm text-ink-soft">
          No account?{" "}
          <Link to="/signup" className="text-ink underline decoration-line-strong underline-offset-2 hover:text-accent-ink">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}
