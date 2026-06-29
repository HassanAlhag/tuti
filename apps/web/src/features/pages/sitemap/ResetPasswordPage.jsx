import { useState } from "react";
import { CheckCircle2, KeyRound, Mail } from "lucide-react";
import { authApi } from "@tuti/shared/api/client.js";
import { PageHero } from "./sitemapPageShared.jsx";

function getTokenFromUrl() {
  return new URLSearchParams(window.location.search).get("token") || "";
}

export function ResetPasswordPage({ onNavigate }) {
  const initialToken = getTokenFromUrl();
  const [step, setStep] = useState(initialToken ? "new-password" : "request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [devToken, setDevToken] = useState("");

  async function handleRequest(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await authApi.requestPasswordReset(email);
      if (result.devToken) setDevToken(result.devToken);
      setStep("sent");
    } catch (err) {
      setError(err.message || "Could not send reset link. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    setError("");
    try {
      await authApi.confirmPasswordReset(token, password);
      setStep("done");
    } catch (err) {
      setError(err.message || "Reset link is invalid or expired.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell">
      <PageHero
        kicker="Account"
        title="Reset your password"
        text="Enter your email address and we will send you a link to reset your password."
      />

      <section className="order-confirmation-panel">
        {step === "request" && (
          <form className="checkout-form-grid" onSubmit={handleRequest}>
            <label className="checkout-field-wide">
              <span className="reset-password-label">
                <Mail aria-hidden="true" size={15} /> Email address
              </span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>
            {error ? <p className="error-state checkout-error checkout-field-wide">{error}</p> : null}
            <div className="checkout-field-wide reset-password-actions">
              <button className="primary-action compact" disabled={loading} type="submit">
                {loading ? "Sending…" : "Send reset link"}
              </button>
              <button className="ghost-action compact" onClick={() => onNavigate?.("/")} type="button">
                Back to sign in
              </button>
            </div>
          </form>
        )}

        {step === "sent" && (
          <div className="reset-password-step">
            <p>
              If <strong>{email}</strong> has a Tuti account, a password reset link has been sent.
              Check your inbox and follow the link to set a new password.
            </p>
            {devToken ? (
              <div className="checkout-auth-helper">
                <strong>Dev mode — use this token:</strong>{" "}
                <button
                  className="ghost-action compact"
                  onClick={() => { setToken(devToken); setStep("new-password"); }}
                  type="button"
                >
                  Continue to reset form
                </button>
                <code className="reset-password-dev-token">
                  {devToken}
                </code>
              </div>
            ) : null}
            <button className="secondary-action compact reset-password-fit-action" onClick={() => onNavigate?.("/")} type="button">
              Back to home
            </button>
          </div>
        )}

        {step === "new-password" && (
          <form className="checkout-form-grid" onSubmit={handleConfirm}>
            <label className="checkout-field-wide">
              <span className="reset-password-label">
                <KeyRound aria-hidden="true" size={15} /> New password
              </span>
              <input
                required
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                autoComplete="new-password"
              />
            </label>
            <label className="checkout-field-wide">
              Confirm new password
              <input
                required
                type="password"
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat password"
                autoComplete="new-password"
              />
            </label>
            {error ? <p className="error-state checkout-error checkout-field-wide">{error}</p> : null}
            <div className="checkout-field-wide reset-password-actions">
              <button className="primary-action compact" disabled={loading} type="submit">
                {loading ? "Saving…" : "Set new password"}
              </button>
            </div>
          </form>
        )}

        {step === "done" && (
          <div className="reset-password-step">
            <div className="reset-password-success">
              <CheckCircle2 aria-hidden="true" size={20} />
              <strong>Password updated successfully.</strong>
            </div>
            <p>You can now sign in with your new password.</p>
            <button
              className="primary-action compact reset-password-fit-action"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("tuti:open-auth"));
                onNavigate?.("/");
              }}
              type="button"
            >
              Sign in
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
