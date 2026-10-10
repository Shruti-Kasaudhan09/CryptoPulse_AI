import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { HeroArt } from "../components/Illustrations";
import { useAuth } from "../lib/auth";

function strength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}
const STRENGTH = [
  ["Too short", "bg-rose-500"], ["Weak", "bg-rose-400"], ["Okay", "bg-amber-400"],
  ["Good", "bg-emerald-400"], ["Strong", "bg-emerald-400"],
];

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-ink2">{label}</span>
      {children}
      {hint}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-line bg-black/30 px-4 py-3.5 text-sm text-ink placeholder:text-muted " +
  "transition focus:border-sky-400/60 focus:bg-black/40 focus:outline-none focus:ring-4 focus:ring-sky-400/10";

export default function AuthPage({ mode }) {
  const isSignup = mode === "signup";
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const edit = (setter) => (e) => { setter(e.target.value); if (error) setError(""); };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (isSignup && !name.trim()) return setError("Please enter your name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("Please enter a valid email address.");
    if (isSignup && password.length < 8) return setError("Password must be at least 8 characters.");
    if (!password) return setError("Please enter your password.");
    setBusy(true);
    try {
      if (isSignup) await signup(name.trim(), email.trim(), password);
      else await login(email.trim(), password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const st = strength(password);

  return (
    <div className="min-h-screen">
      <div className="app-bg" />
      <div className="grid min-h-screen lg:grid-cols-2">
        {/* brand panel */}
        <aside className="relative hidden overflow-hidden border-r border-line bg-black/20 p-12 lg:flex lg:flex-col">
          <div className="pointer-events-none absolute -left-24 top-20 h-80 w-80 rounded-full bg-sky-500/15 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
          <Link to="/" className="relative flex items-center gap-2.5">
            <span className="brand-gradient flex h-10 w-10 items-center justify-center rounded-xl">
              <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden="true">
                <path d="M4 17h6l3-8 5 15 3-7h7" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="font-display text-lg font-bold text-ink">CryptoPulse <span className="text-gradient">AI</span></span>
          </Link>
          <div className="relative my-auto">
            <HeroArt className="mx-auto w-full max-w-[480px]" />
            <h2 className="font-display mt-8 text-3xl font-bold leading-tight text-ink">
              Understand the crypto market,<br /><span className="text-gradient">not just the price.</span>
            </h2>
            <ul className="mt-6 space-y-3 text-sm text-ink2">
              {["Your portfolio saved to your account, on any device",
                "Your Ask-AI conversations remembered",
                "Passwords are securely hashed (bcrypt), never stored as plain text"].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/15 text-xs text-good" aria-hidden="true">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* form */}
        <main className="flex items-center justify-center px-5 py-12 sm:px-10">
          <div className="rise w-full max-w-md">
            <Link to="/" className="mb-10 flex items-center gap-2 text-sm text-muted hover:text-ink lg:hidden">
              ← CryptoPulse AI
            </Link>
            <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">
              {isSignup ? "Create your account" : "Welcome back"}
            </h1>
            <p className="mt-3 text-ink2">
              {isSignup ? "Save your portfolio and AI chats. It's free." : "Sign in to your CryptoPulse account."}
            </p>

            <form onSubmit={submit} noValidate className="mt-9 space-y-6">
              {isSignup && (
                <Field label="Full name">
                  <input value={name} onChange={edit(setName)} autoComplete="name"
                    maxLength={60} placeholder="e.g. Subodh Yadav" className={inputCls} />
                </Field>
              )}
              <Field label="Email">
                <input type="email" value={email} onChange={edit(setEmail)} autoComplete="email"
                  maxLength={254} placeholder="you@example.com" className={inputCls} />
              </Field>
              <Field
                label="Password"
                hint={isSignup && password && (
                  <div className="mt-2.5 flex items-center gap-3">
                    <div className="flex flex-1 gap-1" aria-hidden="true">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full ${i < st ? STRENGTH[st][1] : "bg-white/10"}`} />
                      ))}
                    </div>
                    <span className="text-xs text-muted">{password.length < 8 ? STRENGTH[0][0] : STRENGTH[st][0]}</span>
                  </div>
                )}
              >
                <div className="relative">
                  <input type={show ? "text" : "password"} value={password} onChange={edit(setPassword)}
                    autoComplete={isSignup ? "new-password" : "current-password"} maxLength={128}
                    placeholder={isSignup ? "At least 8 characters" : "Your password"} className={`${inputCls} pr-16`} />
                  <button type="button" onClick={() => setShow((v) => !v)}
                    className="absolute inset-y-0 right-2 my-auto h-8 rounded-lg px-2.5 text-xs text-muted hover:bg-white/5 hover:text-ink"
                    aria-label={show ? "Hide password" : "Show password"}>
                    {show ? "Hide" : "Show"}
                  </button>
                </div>
              </Field>

              {error && (
                <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>
              )}

              <button type="submit" disabled={busy}
                className="brand-gradient w-full rounded-xl py-3.5 text-sm font-semibold text-white shadow-[0_14px_40px_-12px_var(--glow)] transition hover:brightness-110 disabled:opacity-60">
                {busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
              </button>
            </form>

            <div className="my-7 flex items-center gap-4 text-xs text-muted">
              <div className="h-px flex-1 bg-line" /> or <div className="h-px flex-1 bg-line" />
            </div>
            <Link to="/dashboard" className="glass tilt block rounded-xl py-3.5 text-center text-sm font-semibold text-ink">
              Continue as guest →
            </Link>

            <p className="mt-8 text-center text-sm text-ink2">
              {isSignup ? "Already have an account? " : "New to CryptoPulse? "}
              <Link to={`${isSignup ? "/login" : "/signup"}${params.get("next") ? `?next=${encodeURIComponent(next)}` : ""}`}
                className="font-semibold text-accent hover:underline">
                {isSignup ? "Sign in" : "Create an account"}
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
