/**
 * Customer auth modal — sign in (any role) or create a customer account.
 * Seller registration is ONLY available at the seller portal (apps/seller).
 */

import { useState } from "react";
import { User, X } from "lucide-react";
import { authApi }      from "@tuti/shared/api/client.js";
import { useAuthStore } from "@tuti/shared/store/authStore.js";

export function AuthModal({ initialMode = "login", onClose }) {
  const [mode,    setMode]    = useState(initialMode);
  const [form,    setForm]    = useState({ name: "", email: "", password: "" });
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();

  function update(key, value) {
    setForm(f => ({ ...f, [key]: value }));
    setError("");
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      let result;
      if (mode === "login") {
        result = await authApi.login({ email: form.email, password: form.password });
      } else {
        result = await authApi.register({
          name:     form.name,
          email:    form.email,
          password: form.password,
          role:     "customer",
        });
      }
      setAuth(result.user, result.accessToken, result.refreshToken);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="modal-head">
          <div>
            <h2>{mode === "login" ? "Sign in" : "Create account"}</h2>
            <p>
              {mode === "login"
                ? "Welcome back to Tuti."
                : "New to Tuti? Join for free."}
            </p>
          </div>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-tabs">
          <button
            className={mode === "login" ? "modal-tab active" : "modal-tab"}
            onClick={() => setMode("login")} type="button"
          >
            Sign in
          </button>
          <button
            className={mode === "register" ? "modal-tab active" : "modal-tab"}
            onClick={() => setMode("register")} type="button"
          >
            Create account
          </button>
        </div>

        <form className="modal-form" onSubmit={submit}>
          {mode === "register" && (
            <label>
              Full name
              <input
                required autoComplete="name"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Your full name"
              />
            </label>
          )}

          <label>
            Email address
            <input
              required type="email" autoComplete="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label>
            Password
            <input
              required type="password"
              minLength={mode === "register" ? 8 : 1}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder={mode === "register" ? "Min 8 characters" : "Your password"}
            />
          </label>

          {error && <p className="error-note">{error}</p>}

          <button className="primary-action full-width" type="submit" disabled={loading}>
            <User size={15} />
            {loading
              ? "Please wait…"
              : mode === "login" ? "Sign in" : "Create my account"}
          </button>

          {mode === "register" && (
            <p className="modal-hint" style={{ marginTop: 0 }}>
              Want to sell on Tuti?{" "}
              <a href={import.meta.env.VITE_SELLER_URL || "http://localhost:5174"} target="_blank" rel="noreferrer">
                Open Seller Central
              </a>
            </p>
          )}
        </form>

        {mode === "login" && (
          <p className="modal-hint">
            Demo — admin@tuti.dev · seller@tuti.dev · customer@tuti.dev · Password: password123
          </p>
        )}
      </div>
    </div>
  );
}
