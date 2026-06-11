/**
 * Seller-specific login/register screen.
 * Shown when someone visits the seller app without being authenticated
 * as a seller. No access to the customer storefront from here.
 *
 * Gate logic:
 *   ?mode=register&internal=1  → show full register form (internal/admin use)
 *   ?mode=register (no internal) → show "apply first" gated panel
 *   anything else              → show login (default)
 *
 * Rep codes are stored for attribution but no longer auto-open register mode.
 */

import { useEffect, useMemo, useState } from "react";
import { Lock, ShieldCheck, Store, User, Users } from "lucide-react";
import { brand } from "@tuti/shared/brand.js";
import { authApi } from "@tuti/shared/api/client.js";
import { useAuthStore } from "@tuti/shared/store/authStore.js";

function getStoredRepCode() {
  try {
    const raw = localStorage.getItem("tuti_rep_code");
    if (!raw) return null;
    const { code, expiry } = JSON.parse(raw);
    if (Date.now() > expiry) {
      localStorage.removeItem("tuti_rep_code");
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

function storeRepCode(code) {
  if (!code) return;
  const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
  try {
    localStorage.setItem("tuti_rep_code", JSON.stringify({ code, expiry }));
  } catch {}
}

function getRepCodeFromUrl() {
  try {
    const rep = new URLSearchParams(window.location.search).get("rep");
    if (!rep) return "";
    return rep.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32);
  } catch {
    return "";
  }
}

// Returns true only when ?internal=1 is in the URL — for admin/team use.
function isInternalMode() {
  try {
    return new URLSearchParams(window.location.search).get("internal") === "1";
  } catch {
    return false;
  }
}

function getInitialMode() {
  try {
    const params = new URLSearchParams(window.location.search);
    const mode   = params.get("mode");

    // Internal/admin direct registration: ?mode=register&internal=1
    if (mode === "register" && params.get("internal") === "1") return "register";

    // Public attempt to register directly → gated — must apply first
    if (mode === "register") return "gated";

    // Rep code alone no longer auto-opens register; it's stored for attribution.
    // Referred sellers who have been approved log in with provided credentials.
    return "login";
  } catch {
    return "login";
  }
}

function getWebAppUrl() {
  return import.meta.env?.VITE_CLIENT_URL || "http://localhost:5173";
}

const SHOP_CATEGORY_OPTIONS = [
  { id: "perfume",  label: "Perfume" },
  { id: "cake",     label: "Cake" },
  { id: "dessert",  label: "Dessert" },
  { id: "gift_box", label: "Gift Box" },
  { id: "bundle",   label: "Bundle" },
];

export function SellerLogin() {
  const { setAuth } = useAuthStore();
  const DEMO_EMAIL    = "seller@tuti.dev";
  const DEMO_PASSWORD = "password123";

  const [mode,           setMode]           = useState(() => getInitialMode());
  const [email,          setEmail]          = useState("");
  const [password,       setPassword]       = useState("");
  const [name,           setName]           = useState("");
  const [shopName,       setShopName]       = useState("");
  const [shopCity,       setShopCity]       = useState("");
  const [shopCategories, setShopCategories] = useState(["perfume"]);
  const [statusNote,     setStatusNote]     = useState("");
  const [error,          setError]          = useState("");
  const [loading,        setLoading]        = useState(false);
  const [repCode,        setRepCode]        = useState(
    () => getRepCodeFromUrl() || getStoredRepCode() || ""
  );

  // Fixed at mount — true only when ?internal=1 is in the URL.
  const [isInternal] = useState(() => isInternalMode());

  const isRegister = mode === "register";
  const isGated    = mode === "gated";

  useEffect(() => {
    const urlRep = getRepCodeFromUrl();
    if (urlRep) {
      storeRepCode(urlRep);
      setRepCode(urlRep);
    }
  }, []);

  const normalizedShopCategories = useMemo(() => {
    const mapped = shopCategories.map((item) =>
      item === "bundle" ? "gift_box" : item
    );
    return [...new Set(mapped)].slice(0, 5);
  }, [shopCategories]);

  function toggleShopCategory(value) {
    setShopCategories((current) => {
      if (current.includes(value)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== value);
      }
      return [...current, value].slice(0, 5);
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setStatusNote("");
    setLoading(true);
    try {
      if (isRegister) {
        const data = await authApi.register({
          role:           "seller",
          name:           name.trim(),
          email:          email.trim(),
          password,
          shopName:       shopName.trim(),
          shopCity:       shopCity.trim(),
          shopCategories: normalizedShopCategories,
          repCode:        repCode || undefined,
        });
        if (data?.accessToken && data?.refreshToken && data?.user) {
          setAuth(data.user, data.accessToken, data.refreshToken);
          return;
        }
        setStatusNote("Seller registration submitted. You can now sign in.");
        setMode("login");
        setPassword("");
      } else {
        const data = await authApi.login({ email, password });
        if (data.user.role !== "seller" && data.user.role !== "admin") {
          setError(
            "This account does not have seller access. Visit the store to browse as a customer."
          );
          return;
        }
        setAuth(data.user, data.accessToken, data.refreshToken);
      }
    } catch (err) {
      setError(
        err.message || (isRegister ? "Registration failed." : "Login failed.")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sl-screen">
      <div className="sl-card">

        {/* Brand header */}
        <div className="sl-card-brand">
          <span className="sl-brand-mark">{brand.mark}</span>
          <div>
            <strong>Seller Central</strong>
            <span>Manage your shop on Tuti</span>
          </div>
        </div>

        {/* Rep code badge */}
        {repCode && (
          <div className="sl-referral-badge">
            <Users size={13} />
            <span>Referred by Tuti partner</span>
            <code>{repCode}</code>
          </div>
        )}

        {/* ── Gated state ──────────────────────────────────────────── */}
        {isGated ? (
          <div className="sl-gated">
            <ShieldCheck size={28} />
            <h3>Application required</h3>
            <p>
              Seller accounts are created after your application is reviewed and
              an agreement is signed. Submit an application and our team will
              contact you to complete the onboarding process.
            </p>
            <a
              className="primary-action full-width sl-gated-apply-btn"
              href={`${getWebAppUrl()}/sell`}
            >
              <Store size={16} />
              Apply to sell on Tuti
            </a>
            <p className="sl-gated-signin-hint">
              Already approved?{" "}
              <button
                className="sl-link-button"
                type="button"
                onClick={() => setMode("login")}
              >
                Sign in with your credentials →
              </button>
            </p>
          </div>
        ) : (
          <>
            {/* ── Mode tabs (Register tab only shown for internal use) ── */}
            <div className="sl-mode-tabs" role="tablist" aria-label="Seller auth mode">
              <button
                className={mode === "login" ? "sl-mode-tab active" : "sl-mode-tab"}
                onClick={() => setMode("login")}
                type="button"
              >
                Sign in
              </button>
              {isInternal && (
                <button
                  className={mode === "register" ? "sl-mode-tab active" : "sl-mode-tab"}
                  onClick={() => setMode("register")}
                  type="button"
                >
                  Register
                </button>
              )}
            </div>

            {/* ── Demo credentials (login mode only) ─────────────────── */}
            {!isRegister && (
              <div className="sl-demo-credentials">
                <strong>Seller demo</strong>
                <span>email: {DEMO_EMAIL}</span>
                <span>password: {DEMO_PASSWORD}</span>
                <button
                  className="ghost-action compact"
                  onClick={() => {
                    setEmail(DEMO_EMAIL);
                    setPassword(DEMO_PASSWORD);
                  }}
                  type="button"
                >
                  Use demo credentials
                </button>
              </div>
            )}

            {/* ── Form ─────────────────────────────────────────────── */}
            <form className="sl-form" onSubmit={handleSubmit}>
              {isRegister && (
                <>
                  <label className="sl-field">
                    <span>Full name</span>
                    <div className="sl-input-wrap">
                      <User size={15} />
                      <input
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                      />
                    </div>
                  </label>
                  <label className="sl-field">
                    <span>Shop name</span>
                    <div className="sl-input-wrap">
                      <Store size={15} />
                      <input
                        required
                        value={shopName}
                        onChange={(e) => setShopName(e.target.value)}
                        placeholder="Your shop name"
                      />
                    </div>
                  </label>
                  <label className="sl-field">
                    <span>Shop city</span>
                    <div className="sl-input-wrap">
                      <Store size={15} />
                      <input
                        required
                        value={shopCity}
                        onChange={(e) => setShopCity(e.target.value)}
                        placeholder="Dubai, Abu Dhabi, etc."
                      />
                    </div>
                  </label>
                  <fieldset className="sl-category-field">
                    <legend>Shop categories</legend>
                    <div className="sl-category-grid">
                      {SHOP_CATEGORY_OPTIONS.map((option) => (
                        <label key={option.id} className="sl-category-option">
                          <input
                            checked={shopCategories.includes(option.id)}
                            onChange={() => toggleShopCategory(option.id)}
                            type="checkbox"
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </>
              )}

              <label className="sl-field">
                <span>Email</span>
                <div className="sl-input-wrap">
                  <User size={15} />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seller@example.com"
                  />
                </div>
              </label>

              <label className="sl-field">
                <span>Password</span>
                <div className="sl-input-wrap">
                  <Lock size={15} />
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                  />
                </div>
              </label>

              {statusNote && <p className="sl-success">{statusNote}</p>}
              {error      && <p className="sl-error">{error}</p>}

              <button
                className="primary-action full-width sl-submit"
                type="submit"
                disabled={loading}
              >
                <Store size={15} />
                {loading
                  ? isRegister ? "Creating seller account…" : "Signing in…"
                  : isRegister ? "Create seller account"   : "Sign in to Seller Central"}
              </button>
            </form>

            {/* ── Hint below form ───────────────────────────────────── */}
            <p className="sl-hint">
              {isRegister ? (
                <>
                  Already have an account?{" "}
                  <button
                    className="sl-link-button"
                    onClick={() => setMode("login")}
                    type="button"
                  >
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  If your seller application was approved, sign in with the
                  credentials provided by Tuti.{" "}
                  {!isInternal && (
                    <a
                      className="sl-link-button"
                      href={`${getWebAppUrl()}/sell`}
                    >
                      Apply to sell →
                    </a>
                  )}
                </>
              )}
            </p>
          </>
        )}

      </div>
    </div>
  );
}
