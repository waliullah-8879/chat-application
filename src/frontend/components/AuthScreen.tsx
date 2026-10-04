import { useState, type FormEvent } from "react";
import { LockKeyhole, MessageCircleMore, ShieldCheck, UserRound } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

export function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const message =
      mode === "login"
        ? await login(email, password)
        : await register(username, email, password);

    if (message) setError(message);
    setIsSubmitting(false);
  }

  return (
    <main className="auth-shell">
      <section className="auth-showcase">
        <div className="brand-mark large"><MessageCircleMore size={30} /></div>
        <p className="eyebrow">ENCODERX · REAL-TIME SYSTEMS</p>
        <h1>Conversations that feel instant.</h1>
        <p className="auth-copy">
          Nexus Chat combines secure sessions, authenticated WebSocket handshakes,
          private rooms, persistent history and live presence in one production-style project.
        </p>

        <div className="feature-stack">
          <div><ShieldCheck size={20} /><span>Server-verified identity and room access</span></div>
          <div><MessageCircleMore size={20} /><span>Persistent real-time messaging</span></div>
          <div><LockKeyhole size={20} /><span>HttpOnly refresh sessions</span></div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="mobile-brand"><div className="brand-mark"><MessageCircleMore size={22} /></div>Nexus</div>
          <p className="eyebrow">{mode === "login" ? "WELCOME BACK" : "CREATE ACCOUNT"}</p>
          <h2>{mode === "login" ? "Sign in to your workspace" : "Start chatting securely"}</h2>
          <p className="muted">Use two browser sessions to demonstrate real-time messaging.</p>

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === "register" && (
              <label>
                Username
                <div className="input-wrap"><UserRound size={17} /><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="muhammad.haris" autoComplete="username" required /></div>
              </label>
            )}

            <label>
              Email
              <div className="input-wrap"><span>@</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required /></div>
            </label>

            <label>
              Password
              <div className="input-wrap"><LockKeyhole size={17} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 10 characters" autoComplete={mode === "login" ? "current-password" : "new-password"} required /></div>
            </label>

            {mode === "register" && (
              <p className="password-hint">Use 10+ characters with uppercase, lowercase and a number.</p>
            )}

            {error && <div className="form-error" role="alert">{error}</div>}

            <button className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <button className="text-button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
            {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </div>
      </section>
    </main>
  );
}
