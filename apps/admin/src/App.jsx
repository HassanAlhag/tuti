import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { authApi, marketplaceApi } from "@tuti/shared/api/client.js";
import { useAuthStore } from "@tuti/shared/store/authStore.js";
import { AdminConsole } from "./features/shell/AdminConsole.jsx";

const SECTIONS = [
  "overview",
  "operations",
  "payments",
  "payouts",
  "orders",
  "users",
  "seller-pipeline",
  "crm",
  "drivers",
  "clients",
  "shops",
  "analytics",
  "support",
  "support-tickets",
  "roles",
  "sales-reps",
  "audit",
  "merchandising",
];

function getSection() {
  const section = window.location.pathname.split("/")[2] || "overview";
  return SECTIONS.includes(section) ? section : "overview";
}

function AdminLogin() {
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ email: "admin@tuti.dev", password: "password123" });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const result = await authApi.login(form);
      setAuth(result.user, result.accessToken, result.refreshToken);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="admin-app-gate">
      <form className="admin-app-login" onSubmit={submit}>
        <span className="admin-app-login-icon"><ShieldCheck size={22} /></span>
        <div>
          <span className="eyebrow">Admin access</span>
          <h1>Tuti operations</h1>
        </div>
        <label>
          <span>Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </label>
        {error && <p className="admin-app-error">{error}</p>}
        <button className="primary-action" type="submit" disabled={pending}>
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}

export default function App() {
  const { isAuthenticated, isAdmin } = useAuthStore();
  const [section, setSection] = useState(getSection);
  const [adminData, setAdminData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const canAccess = isAuthenticated() && isAdmin();

  async function loadAdminData() {
    setLoadError("");
    const data = await marketplaceApi.getAdmin();
    setAdminData(data);
  }

  useEffect(() => {
    if (!canAccess) {
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    loadAdminData()
      .catch((err) => { if (mounted) setLoadError(err.message); })
      .finally(() => { if (mounted) setLoading(false); });

    function onPopState() { setSection(getSection()); }
    window.addEventListener("popstate", onPopState);
    return () => {
      mounted = false;
      window.removeEventListener("popstate", onPopState);
    };
  }, [canAccess]);

  function goToSection(nextSection) {
    const path = nextSection === "overview" ? "/admin" : `/admin/${nextSection}`;
    window.history.pushState(null, "", path);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setSection(nextSection);
  }

  function goToStore() {
    window.location.href = import.meta.env.VITE_CLIENT_URL || "/";
  }

  async function updateProductStatus(productId, status) {
    await marketplaceApi.updateProductStatus(productId, status);
    await loadAdminData();
  }

  async function updatePayout(payoutId, status) {
    await marketplaceApi.updatePayoutStatus(payoutId, status);
    await loadAdminData();
  }

  async function capturePayment(paymentId) {
    await marketplaceApi.capturePayment(paymentId);
    await loadAdminData();
  }

  // Not authenticated → show login
  if (!loading && !canAccess) return <AdminLogin />;

  // Loading OR authenticated but data not yet fetched (gap between login and first effect run)
  if (loading || !adminData) {
    if (loadError) {
      return (
        <div className="app-status error">
          <strong>Cannot connect to API</strong>
          <span>{loadError}</span>
          <button className="primary-action" onClick={() => window.location.reload()} type="button">Retry</button>
        </div>
      );
    }
    return <div className="app-status">Loading admin console…</div>;
  }

  return (
    <AdminConsole
      activeSection={section}
      adminData={adminData}
      capturePayment={capturePayment}
      goToStore={goToStore}
      setActiveSection={goToSection}
      updatePayout={updatePayout}
      updateProductStatus={updateProductStatus}
    />
  );
}
