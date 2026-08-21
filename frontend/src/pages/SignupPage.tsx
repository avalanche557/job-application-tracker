import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function SignupPage() {
  const { user, signup, signupError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signup({ email, password });
      navigate("/");
    } catch {
      // signupError from context already surfaces the message
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
          <h2 className="text-xl font-semibold text-ink">Create an account</h2>
          <p className="mt-1 text-sm text-ink-soft">Start tracking your job applications</p>
        </div>

        {signupError && (
          <p className="rounded-[5px] border border-rust/40 bg-rust-soft px-3 py-2 text-sm text-rust-ink">{signupError}</p>
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
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
          <p className="mt-1.5 font-mono text-[11px] text-ink-soft">At least 8 characters</p>
        </div>
        <button type="submit" disabled={submitting} className="btn btn-primary w-full">
          {submitting ? "Creating account…" : "Sign up"}
        </button>
        <p className="text-center text-sm text-ink-soft">
          Already have an account?{" "}
          <Link to="/login" className="text-ink underline decoration-line-strong underline-offset-2 hover:text-accent-ink">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
