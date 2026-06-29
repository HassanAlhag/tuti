import { useState } from "react";
import { ArrowRight, LogIn, ShieldCheck } from "lucide-react";
import { authApi } from "@tuti/shared/api/client.js";
import { useAuthStore } from "@tuti/shared/store/authStore.js";
import { useSeoMeta } from "@tuti/shared/hooks/useSeoMeta.js";
import { getPortalUrls, ROLE_LABELS } from "@tuti/shared/utils/portalUrls.js";
import { brand } from "@tuti/shared/brand.js";

const PORTALS = [
  { role: "seller",    label: "Seller Central",    key: "VITE_SELLER_URL",  port: 5174 },
  { role: "admin",     label: "Admin Console",      key: "VITE_ADMIN_URL",   port: 5175 },
  { role: "driver",    label: "Driver Portal",      key: "VITE_DRIVER_URL",  port: 5176 },
  { role: "sales_rep", label: "Sales Rep Portal",   key: "VITE_SR_URL",      port: 5177 },
];

function rolePortalUrl(role) {
  const urls = getPortalUrls(import.meta.env);
  return urls[role] || null;
}

export function LoginPage({ onNavigate }) {
  useSeoMeta({
    title: "Sign In — Tuti",
    description: "Sign in to Tuti. Customers, sellers, admins, drivers, and sales reps all use one entry point.",
    canonical: "https://tuti.ae/login",
  });

  const { setAuth } = useAuthStore();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [redirecting, setRedirecting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await authApi.login({ email: email.trim(), password });
      const { user, accessToken, refreshToken } = result;
      const role = user?.role;

      if (role === "customer") {
        setAuth(user, accessToken, refreshToken);
        onNavigate?.("/");
        return;
      }

      const portalUrl = rolePortalUrl(role);
      if (portalUrl) {
        setAuth(user, accessToken, refreshToken);
        setRedirecting(true);
        // Short delay so the user sees the redirect message
        setTimeout(() => { window.location.href = portalUrl; }, 800);
        return;
      }

      // Unknown role — still store auth and let them browse the storefront
      setAuth(user, accessToken, refreshToken);
      onNavigate?.("/");
    } catch (err) {
      setError(err.message || "Sign in failed. Check your email and password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-mark">{brand.mark}</span>
          <div>
            <h1>{brand.name}</h1>
            <p>One sign-in for all roles</p>
          </div>
        </div>

        {redirecting ? (
          <div className="login-redirect-notice">
            <ArrowRight size={20} aria-hidden="true" />
            <div>
              <strong>Redirecting you to your portal…</strong>
              <p>If nothing happens, check that the portal app is running.</p>
            </div>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            <label>
              Email address
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="Your password"
              />
            </label>

            {error && (
              <div className="login-error" role="alert">
                <ShieldCheck size={14} aria-hidden="true" />
                {error}
              </div>
            )}

            <button className="primary-action full-width" type="submit" disabled={loading}>
              <LogIn size={15} aria-hidden="true" />
              {loading ? "Signing in…" : "Sign in"}
            </button>

            <button
              className="ghost-action compact"
              onClick={() => onNavigate?.("/reset-password")}
              type="button"
            >
              Forgot password?
            </button>
          </form>
        )}

        <div className="login-portals-note">
          <p>After sign in you are automatically sent to your portal:</p>
          <ul>
            {PORTALS.map((p) => (
              <li key={p.role}>
                <strong>{p.label}</strong>
                <span> — {ROLE_LABELS[p.role]}</span>
              </li>
            ))}
            <li>
              <strong>Customer</strong>
              <span> — stays on this site</span>
            </li>
          </ul>
        </div>

        <div className="login-demo-hint">
          <p>
            Demo — <code>admin@tuti.dev</code> · <code>seller@tuti.dev</code> ·{" "}
            <code>customer@tuti.dev</code> · password: <code>password123</code>
          </p>
        </div>
      </div>
    </main>
  );
}
