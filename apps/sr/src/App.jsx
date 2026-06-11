import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BadgeDollarSign,
  CheckCircle2,
  Clock3,
  LogOut,
  Mail,
  MessageSquare,
  Phone,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  Ticket,
  TrendingUp,
  Users,
} from "lucide-react";
import { brand } from "@tuti/shared/brand.js";
import { authApi, srPortalApi, supportTicketsApi } from "@tuti/shared/api/client.js";
import { EmptyState } from "@tuti/shared/components/EmptyState.jsx";
import { useAuthStore } from "@tuti/shared/store/authStore.js";
import { formatCurrency } from "@tuti/shared/utils/money.js";
import { DEFAULT_COMMISSION_PLANS } from "@tuti/shared/constants/commission.js";

const LOGIN_COPY = "Sign in with the credentials provided by your account manager.";

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(date);
}

function referralStatusTone(status = "") {
  const s = String(status).toLowerCase().replace(/_/g, " ");
  if (s === "active") return "success";
  if (s === "pending approval") return "warning";
  if (s === "inactive" || s === "rejected") return "neutral";
  return "brand";
}

function commissionStatusTone(status = "") {
  if (status === "Paid") return "success";
  if (status === "Pending") return "warning";
  return "neutral";
}

function labelStatus(status = "") {
  return String(status).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getSectionFromQuery() {
  return new URLSearchParams(window.location.search).get("section") || "overview";
}

function getSafeLoginError(message) {
  if (!message) return "Sign in failed.";
  if (String(message).toLowerCase().includes("sales_rep") || String(message).toLowerCase().includes("rep access")) {
    return "This account does not have SR access.";
  }
  return message;
}

function StatCard({ icon: Icon, label, value, note }) {
  return (
    <article className="sr-stat">
      <span className="sr-stat-icon"><Icon size={18} /></span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

function ReferralRow({ referral }) {
  const tone = referralStatusTone(referral.status);
  return (
    <article className="sr-referral-card">
      <div className="sr-referral-head">
        <div>
          <strong>{referral.shopName || "Unnamed shop"}</strong>
          <span>{referral.shopId}</span>
        </div>
        <span className={`sr-pill ${tone}`}>{labelStatus(referral.status)}</span>
      </div>
      <div className="sr-referral-meta">
        <span><ReceiptText size={12} />GMV: {formatCurrency(referral.gmv || 0)}</span>
        <span><Clock3 size={12} />Referred {formatDate(referral.createdAt)}</span>
        {referral.firstSaleDate ? <span><CheckCircle2 size={12} />First sale {formatDate(referral.firstSaleDate)}</span> : null}
        {referral.approvedAt ? <span><CheckCircle2 size={12} />Approved {formatDate(referral.approvedAt)}</span> : null}
      </div>
    </article>
  );
}

function CommissionRow({ entry }) {
  const tone = commissionStatusTone(entry.status);
  return (
    <div className="sr-ledger-row">
      <span className="sr-ledger-id">{entry.id}</span>
      <div className="sr-ledger-info">
        <strong>{entry.type}</strong>
        <span>{entry.shop || "—"}</span>
      </div>
      <strong className="sr-ledger-amount">{formatCurrency(entry.amount || 0)}</strong>
      <span className={`sr-pill ${tone}`}>{entry.status}</span>
      <span className="sr-ledger-date">{formatDate(entry.date || entry.createdAt)}</span>
    </div>
  );
}

const SUPPORT_STATUS_OPTIONS = ["all", "Open", "In Progress", "Waiting for Customer", "Waiting for Seller", "Resolved", "Closed"];
const SUPPORT_PRIORITY_OPTIONS = ["all", "low", "normal", "high", "urgent"];
const SR_SUPPORT_CATEGORY_OPTIONS = [
  { value: "all", label: "All categories" },
  { value: "account_access", label: "Account access" },
  { value: "commission_query", label: "Commission query" },
  { value: "referral_help", label: "Referral help" },
  { value: "app_issue", label: "App issue" },
  { value: "other", label: "Other" },
];

function formatSupportCategory(value) {
  const map = {
    account_access: "Account access",
    commission_query: "Commission query",
    referral_help: "Referral help",
    app_issue: "App issue",
    other: "Other",
  };
  return map[value] || String(value || "General help").replace(/_/g, " ");
}

function supportStatusTone(status) {
  switch (status) {
    case "Open": return "warning";
    case "In Progress": return "brand";
    case "Waiting for Customer":
    case "Waiting for Seller": return "neutral";
    case "Resolved": return "success";
    case "Closed": return "neutral";
    default: return "neutral";
  }
}

function supportPriorityTone(priority) {
  if (priority === "urgent" || priority === "high") return "warning";
  if (priority === "normal") return "brand";
  return "neutral";
}

function SupportPill({ value, kind = "status" }) {
  const tone = kind === "priority" ? supportPriorityTone(value) : supportStatusTone(value);
  return <span className={`sr-support-pill ${tone}`}>{value}</span>;
}

function SupportTicketRow({ ticket, active, onSelect }) {
  return (
    <button type="button" className={active ? "sr-support-row active" : "sr-support-row"} onClick={() => onSelect(ticket.id || ticket.ticketNumber)}>
      <div className="sr-support-row-main">
        <div className="sr-support-row-head">
          <strong>{ticket.ticketNumber}</strong>
          <span>{ticket.subject}</span>
        </div>
        <p>{ticket.description}</p>
        <div className="sr-support-row-meta">
          <span>{formatSupportCategory(ticket.category)}</span>
          <span>Updated {formatDateTime(ticket.updatedAt)}</span>
        </div>
      </div>
      <div className="sr-support-row-side">
        <SupportPill value={ticket.status || "Open"} />
        <SupportPill kind="priority" value={ticket.priority || "normal"} />
        <span className="sr-support-row-ref">Created {formatDateTime(ticket.createdAt)}</span>
      </div>
    </button>
  );
}

function SupportTicketDetail({ ticket, replyDraft, setReplyDraft, replySaving, replyError, onReply, loading, loadError }) {
  const messages = Array.isArray(ticket?.messages) ? ticket.messages : [];
  return (
    <aside className="sr-support-detail">
      {loadError ? (
        <EmptyState icon={Ticket} text={loadError || "Failed to load support ticket."} />
      ) : loading && !ticket ? (
        <EmptyState icon={Ticket} text="Loading support ticket…" />
      ) : !ticket ? (
        <EmptyState icon={Ticket} text="Select a support ticket to view the thread and reply." />
      ) : (
        <>
          <div className="sr-support-detail-head">
            <span className="eyebrow">Support ticket</span>
            <h2>{ticket.ticketNumber}</h2>
            <p>{ticket.subject}</p>
            <div className="sr-support-detail-meta">
              <span><strong>Category</strong>{formatSupportCategory(ticket.category)}</span>
              <span><strong>Priority</strong><SupportPill kind="priority" value={ticket.priority || "normal"} /></span>
              <span><strong>Status</strong><SupportPill value={ticket.status || "Open"} /></span>
              <span><strong>Created</strong>{formatDateTime(ticket.createdAt)}</span>
              <span><strong>Updated</strong>{formatDateTime(ticket.updatedAt)}</span>
            </div>
          </div>

          <section className="sr-support-thread">
            <span className="sr-support-thread-head"><MessageSquare size={14} />Conversation</span>
            {messages.length ? (
              messages.map((message) => (
                <article className="sr-support-message" key={message.id}>
                  <div className="sr-support-message-head">
                    <strong>{message.by || "System"}</strong>
                    <span>{message.role || "system"} · {formatDateTime(message.createdAt)}</span>
                  </div>
                  <p>{message.body}</p>
                </article>
              ))
            ) : (
              <EmptyState icon={MessageSquare} text="No messages yet." />
            )}
          </section>

          <section className="sr-support-reply">
            <span className="sr-support-thread-head"><MessageSquare size={14} />Reply</span>
            <textarea rows="4" value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} placeholder="Write your reply here" />
            {replyError ? <small className="sr-form-error">{replyError}</small> : null}
            <div className="sr-support-reply-actions">
              <button className="primary-action" type="button" disabled={replySaving || !replyDraft.trim()} onClick={onReply}>
                {replySaving ? "Sending…" : "Send reply"}
              </button>
            </div>
          </section>
        </>
      )}
    </aside>
  );
}

const DEMO_EMAIL    = "afrid@exp.ae";
const DEMO_PASSWORD = "Inf-123*";

export default function App() {
  const queryClient = useQueryClient();
  const { user, accessToken, isAuthenticated, setAuth, clearAuth } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [section, setSection] = useState(getSectionFromQuery);
  const [notice, setNotice] = useState("");
  const [supportSearch, setSupportSearch] = useState("");
  const [supportStatus, setSupportStatus] = useState("all");
  const [supportPriority, setSupportPriority] = useState("all");
  const [supportCategory, setSupportCategory] = useState("all");
  const [selectedSupportId, setSelectedSupportId] = useState("");
  const [supportCreateForm, setSupportCreateForm] = useState({
    subject: "", description: "", category: "account_access", priority: "normal",
  });
  const [supportCreateError, setSupportCreateError] = useState("");
  const [supportReplyDraft, setSupportReplyDraft] = useState("");
  const [supportReplyError, setSupportReplyError] = useState("");

  const isSRSession = isAuthenticated() && user?.role === "sales_rep" && Boolean(accessToken);
  const nonSRSession = isAuthenticated() && user && user.role !== "sales_rep";
  const repKey = user?.sub || "guest";

  const profileQuery = useQuery({
    queryKey: ["sr", "me", repKey],
    queryFn: () => srPortalApi.me(),
    enabled: isSRSession,
  });

  const referralsQuery = useQuery({
    queryKey: ["sr", "referrals", repKey],
    queryFn: () => srPortalApi.referrals(),
    enabled: isSRSession,
  });

  const commissionsQuery = useQuery({
    queryKey: ["sr", "commissions", repKey],
    queryFn: () => srPortalApi.commissions(),
    enabled: isSRSession,
  });

  const plansQuery = useQuery({
    queryKey: ["sr", "commission-plans"],
    queryFn: () => srPortalApi.commissionPlans(),
    enabled: isSRSession,
  });

  const supportQuery = useQuery({
    queryKey: ["sr", "support", repKey, supportStatus, supportPriority, supportCategory, supportSearch],
    queryFn: () => supportTicketsApi.list({
      q: supportSearch.trim(),
      status: supportStatus === "all" ? "" : supportStatus,
      priority: supportPriority === "all" ? "" : supportPriority,
      category: supportCategory === "all" ? "" : supportCategory,
      limit: 100,
    }),
    enabled: isSRSession,
    keepPreviousData: true,
  });

  const profile = profileQuery.data || null;
  const referrals = Array.isArray(referralsQuery.data) ? referralsQuery.data : [];
  const commissions = Array.isArray(commissionsQuery.data) ? commissionsQuery.data : [];
  const plans = Array.isArray(plansQuery.data) ? plansQuery.data : Object.values(DEFAULT_COMMISSION_PLANS);
  const supportTickets = Array.isArray(supportQuery.data?.tickets) ? supportQuery.data.tickets : [];

  const activeReferrals = referrals.filter((r) => String(r.status || "").toLowerCase() === "active").length;
  const pendingCommission = commissions.filter((e) => e.status === "Pending").reduce((s, e) => s + Number(e.amount || 0), 0);
  const paidCommission = commissions.filter((e) => e.status === "Paid").reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalGmv = referrals.reduce((s, r) => s + Number(r.gmv || 0), 0);

  const visibleSupportTickets = useMemo(() => {
    const q = supportSearch.trim().toLowerCase();
    if (!q) return supportTickets;
    return supportTickets.filter((ticket) => {
      const haystack = [ticket.ticketNumber, ticket.subject, ticket.description, ticket.category, ticket.status].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [supportSearch, supportTickets]);

  const selectedSupportTicketQuery = useQuery({
    queryKey: ["sr", "support-ticket", repKey, selectedSupportId],
    queryFn: () => supportTicketsApi.get(selectedSupportId),
    enabled: isSRSession && Boolean(selectedSupportId),
  });

  const selectedSupportTicket = selectedSupportTicketQuery.data
    || visibleSupportTickets.find((t) => t.id === selectedSupportId || t.ticketNumber === selectedSupportId)
    || null;

  useEffect(() => {
    if (!visibleSupportTickets.length) { if (selectedSupportId) setSelectedSupportId(""); return; }
    const exists = selectedSupportId ? visibleSupportTickets.some((t) => t.id === selectedSupportId || t.ticketNumber === selectedSupportId) : false;
    if (!selectedSupportId || !exists) setSelectedSupportId(visibleSupportTickets[0].id || visibleSupportTickets[0].ticketNumber);
  }, [selectedSupportId, visibleSupportTickets]);

  useEffect(() => {
    if (!selectedSupportId) return;
    setSupportReplyError("");
  }, [selectedSupportId]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = window.setTimeout(() => setNotice(""), 2400);
    return () => window.clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    function sync() { setSection(getSectionFromQuery()); }
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const supportCreateMutation = useMutation({
    mutationFn: (payload) => supportTicketsApi.create(payload),
    onSuccess: async (created) => {
      setSupportCreateError("");
      setNotice("Support ticket created.");
      setSupportCreateForm({ subject: "", description: "", category: "account_access", priority: "normal" });
      await supportQuery.refetch();
      if (created?.id || created?.ticketNumber) setSelectedSupportId(created.id || created.ticketNumber);
      setSection("support");
    },
    onError: (err) => setSupportCreateError(err?.message || "Unable to create support ticket."),
  });

  const supportReplyMutation = useMutation({
    mutationFn: ({ ticketId, message }) => supportTicketsApi.reply(ticketId, { message }),
    onSuccess: async () => {
      setSupportReplyDraft("");
      setSupportReplyError("");
      setNotice("Reply sent.");
      await Promise.all([
        supportQuery.refetch(),
        selectedSupportId ? selectedSupportTicketQuery.refetch() : Promise.resolve(),
      ]);
    },
    onError: (err) => setSupportReplyError(err?.message || "Unable to send reply."),
  });

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    try {
      const result = await authApi.login({ email: email.trim(), password });
      if (result?.user?.role !== "sales_rep") {
        setLoginError("This account does not have SR access.");
        return;
      }
      setAuth(result.user, result.accessToken, result.refreshToken);
      setPassword("");
    } catch (err) {
      setLoginError(getSafeLoginError(err?.message));
    }
  }

  async function handleLogout() {
    try { await authApi.logout(); } catch { /* local sign-out still happens */ } finally {
      clearAuth();
      queryClient.removeQueries({ queryKey: ["sr"] });
      setLoginError("");
      setSupportSearch("");
      setSupportStatus("all");
      setSupportPriority("all");
      setSupportCategory("all");
      setSelectedSupportId("");
      setSupportCreateError("");
      setSupportReplyError("");
      setSupportReplyDraft("");
      setSupportCreateForm({ subject: "", description: "", category: "account_access", priority: "normal" });
      setSection("overview");
    }
  }

  async function refreshAll() {
    await Promise.all([
      profileQuery.refetch(),
      referralsQuery.refetch(),
      commissionsQuery.refetch(),
      supportQuery.refetch(),
    ]);
  }

  if (!isSRSession) {
    return (
      <main className="sr-gate">
        <section className="sr-gate-card">
          <div className="sr-gate-brand">
            <span className="sr-mark">{brand.mark}</span>
            <div>
              <span className="eyebrow">SR Portal</span>
              <h1>Sales Rep dashboard</h1>
            </div>
          </div>

          <p className="sr-gate-copy">{LOGIN_COPY}</p>

          {nonSRSession ? (
            <div className="sr-gate-warning">
              <AlertTriangle size={16} />
              <span>This account does not have SR access.</span>
            </div>
          ) : null}

          <div className="sr-demo-credentials">
            <strong>SR demo</strong>
            <span>email: {DEMO_EMAIL}</span>
            <span>password: {DEMO_PASSWORD}</span>
            <button
              className="ghost-action compact"
              type="button"
              onClick={() => { setEmail(DEMO_EMAIL); setPassword(DEMO_PASSWORD); }}
            >
              Use demo credentials
            </button>
          </div>

          <form className="sr-login-form" onSubmit={handleLogin}>
            <label className="sr-field">
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="rep@tuti.example" autoComplete="email" required />
            </label>
            <label className="sr-field">
              <span>Password</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your assigned password" autoComplete="current-password" required />
            </label>
            {loginError ? <p className="sr-form-error">{loginError}</p> : null}
            <button className="primary-action full-width" type="submit">
              <ShieldCheck size={16} />
              Sign in
            </button>
          </form>
        </section>
      </main>
    );
  }

  if (profileQuery.isError) {
    return (
      <main className="sr-error-screen">
        <section className="sr-error-card">
          <AlertTriangle size={22} />
          <h1>Could not load SR profile</h1>
          <p>{profileQuery.error?.message || "Unable to load your sales rep profile."}</p>
          <div className="sr-error-actions">
            <button className="secondary-action" type="button" onClick={() => window.location.reload()}>
              <RefreshCw size={16} />
              Retry
            </button>
            <button className="ghost-action" type="button" onClick={handleLogout}>
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="sr-shell">
      <header className="sr-topbar">
        <div className="sr-topbar-brand">
          <span className="sr-mark small">{brand.mark}</span>
          <div>
            <span className="eyebrow">SR Portal</span>
            <strong>{profile?.name || user?.name || "Sales Rep"}</strong>
          </div>
        </div>

        <div className="sr-topbar-actions">
          <div className="sr-topbar-tabs" role="tablist" aria-label="SR sections">
            {[
              { id: "overview", icon: TrendingUp, label: "Overview" },
              { id: "referrals", icon: Users, label: "Referrals" },
              { id: "commissions", icon: BadgeDollarSign, label: "Commissions" },
              { id: "support", icon: MessageSquare, label: "Support" },
            ].map(({ id, icon: Icon, label }) => (
              <button key={id} className={section === id ? "sr-tab active" : "sr-tab"} type="button" onClick={() => setSection(id)}>
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
          <button className="secondary-action compact" type="button" onClick={refreshAll} disabled={profileQuery.isFetching}>
            <RefreshCw size={14} />
            Refresh
          </button>
          <button className="ghost-action compact" type="button" onClick={handleLogout}>
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </header>

      {notice ? (
        <div className="sr-banner success">
          <CheckCircle2 size={14} />
          <span>{notice}</span>
        </div>
      ) : null}

      {/* ── OVERVIEW ── */}
      {section === "overview" && (
        <>
          <section className="sr-hero">
            <div className="sr-hero-copy">
              <span className="eyebrow">Welcome back</span>
              <h1>Good to see you, {profile?.name || user?.name || "rep"}.</h1>
              <p>Your referral pipeline, commission earnings, and account info are all here.</p>
              <div className="sr-hero-chips">
                <span><Award size={14} />{profile?.code || "—"}</span>
                <span><BadgeDollarSign size={14} />{profile?.plan || "Standard"} plan</span>
                <span className={`sr-chip-status ${profile?.status === "Active" ? "success" : "warning"}`}>
                  {profile?.status || "Active"}
                </span>
              </div>
            </div>

            <aside className="sr-profile-card">
              <div className="sr-profile-head">
                <span className="sr-profile-badge">Your profile</span>
                <strong>{profile?.name || "—"}</strong>
              </div>
              <dl>
                <div><dt>Rep code</dt><dd><code className="sr-code">{profile?.code || "—"}</code></dd></div>
                <div><dt>Plan</dt><dd>{profile?.plan || "Standard"}</dd></div>
                <div><dt><Mail size={12} />Email</dt><dd>{profile?.email || user?.email || "—"}</dd></div>
                <div><dt><Phone size={12} />Phone</dt><dd>{profile?.phone || "—"}</dd></div>
                <div><dt>Status</dt><dd className="sr-profile-status">{profile?.status || "Active"}</dd></div>
              </dl>
            </aside>
          </section>

          <section className="sr-stats-grid">
            <StatCard icon={Users} label="Referrals" value={referrals.length} note={`${activeReferrals} active`} />
            <StatCard icon={TrendingUp} label="Total GMV" value={formatCurrency(totalGmv)} note="All-time referral volume" />
            <StatCard icon={BadgeDollarSign} label="Pending commission" value={formatCurrency(pendingCommission)} note="Awaiting release" />
            <StatCard icon={CheckCircle2} label="Paid commission" value={formatCurrency(paidCommission)} note="All-time earnings" />
          </section>

          {/* Commission plans */}
          <section className="sr-panel">
            <div className="sr-panel-head">
              <div>
                <span className="eyebrow">Your earnings structure</span>
                <h2>Commission plans</h2>
              </div>
              <span className="sr-panel-meta">{plans.length} plans available</span>
            </div>
            <div className="sr-plans-grid">
              {plans.map((plan) => (
                <article className={`sr-plan-card${plan.name === profile?.plan ? " sr-plan-card--active" : ""}`} key={plan.id}>
                  <div className="sr-plan-name">
                    {plan.name}
                    {plan.name === profile?.plan ? <span className="sr-plan-badge">Your plan</span> : null}
                  </div>
                  <div className="sr-plan-stat"><span>Signup bonus</span><strong>{formatCurrency(plan.signupBonus)}</strong></div>
                  <div className="sr-plan-stat"><span>First sale bonus</span><strong>{formatCurrency(plan.firstSaleBonus)}</strong></div>
                  <div className="sr-plan-stat"><span>Base GMV rate</span><strong>{(plan.gmvRate * 100).toFixed(1)}%</strong></div>
                  {plan.tierThresholds?.length > 0 && (
                    <div className="sr-plan-tiers">
                      {plan.tierThresholds.map((t, i) => (
                        <span key={i}>≥ {formatCurrency(t.minMonthlyGmv)} → {(t.rate * 100).toFixed(1)}%</span>
                      ))}
                    </div>
                  )}
                  <div className="sr-plan-flags">
                    {plan.pauseOnAtRisk && <span>Pauses at risk</span>}
                    {plan.reverseOnRefund && <span>Reversal on refund</span>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      {/* ── REFERRALS ── */}
      {section === "referrals" && (
        <>
          <section className="sr-hero-flat">
            <div>
              <span className="eyebrow">Your pipeline</span>
              <h1>Referral shops</h1>
              <p>Shops you brought onto the platform via your rep code.</p>
            </div>
            <aside className="sr-hero-aside">
              <span className="sr-profile-badge">Rep code</span>
              <code className="sr-code large">{profile?.code || "—"}</code>
              <p>Share this code with sellers to link referrals to your account.</p>
            </aside>
          </section>

          <section className="sr-panel">
            <div className="sr-panel-head">
              <div>
                <span className="eyebrow">Pipeline</span>
                <h2>{referrals.length ? `${referrals.length} referral${referrals.length === 1 ? "" : "s"}` : "No referrals yet"}</h2>
              </div>
              <span className="sr-panel-meta">{activeReferrals} active</span>
            </div>

            {referralsQuery.isLoading ? (
              <div className="sr-loading">Loading referrals…</div>
            ) : referrals.length ? (
              <div className="sr-referral-list">
                {referrals.map((referral) => (
                  <ReferralRow key={referral.id} referral={referral} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Users}
                text="No referrals yet. Share your rep code with sellers to start tracking your pipeline."
              />
            )}
          </section>
        </>
      )}

      {/* ── COMMISSIONS ── */}
      {section === "commissions" && (
        <>
          <section className="sr-hero-flat">
            <div>
              <span className="eyebrow">Your earnings</span>
              <h1>Commission ledger</h1>
              <p>Every commission entry linked to your rep code.</p>
            </div>
            <aside className="sr-hero-aside">
              <span className="sr-profile-badge">Summary</span>
              <strong className="sr-hero-amount">{formatCurrency(pendingCommission + paidCommission)}</strong>
              <p>Total commission · {formatCurrency(pendingCommission)} pending</p>
            </aside>
          </section>

          <section className="sr-panel">
            <div className="sr-panel-head">
              <div>
                <span className="eyebrow">Ledger</span>
                <h2>{commissions.length ? `${commissions.length} entr${commissions.length === 1 ? "y" : "ies"}` : "No entries"}</h2>
              </div>
            </div>

            {commissionsQuery.isLoading ? (
              <div className="sr-loading">Loading commissions…</div>
            ) : commissions.length ? (
              <div className="sr-ledger-list">
                {commissions.map((entry) => (
                  <CommissionRow key={entry.id} entry={entry} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={ReceiptText}
                text="No commission entries yet. Entries appear once your referred shops generate sales."
              />
            )}
          </section>
        </>
      )}

      {/* ── SUPPORT ── */}
      {section === "support" && (
        <>
          <section className="sr-support-hero">
            <div className="sr-support-hero-copy">
              <span className="eyebrow">Help &amp; Support</span>
              <h1>Support for account, commission, and referral help.</h1>
              <p>Use Support for account access, commission queries, or referral issues. Tickets stay private to your account.</p>
            </div>
            <div className="sr-support-hero-card">
              <span className="sr-support-hero-label">SR scope</span>
              <strong>Private to you</strong>
              <p>Your tickets are linked to your SR account and the support team handling them.</p>
            </div>
          </section>

          <section className="sr-support-board">
            <article className="sr-panel sr-support-list-panel">
              <div className="sr-panel-head">
                <div>
                  <span className="eyebrow">Create ticket</span>
                  <h2>Support tickets</h2>
                </div>
              </div>

              <form className="sr-support-form" onSubmit={(e) => {
                e.preventDefault();
                setSupportCreateError("");
                const subject = supportCreateForm.subject.trim();
                const description = supportCreateForm.description.trim();
                const category = supportCreateForm.category.trim();
                if (!subject || !description || !category) {
                  setSupportCreateError("Subject, category, and description are required.");
                  return;
                }
                supportCreateMutation.mutate({ subject, description, category, priority: supportCreateForm.priority });
              }}>
                <div className="sr-support-grid">
                  <label className="sr-field wide">
                    <span>Subject</span>
                    <input value={supportCreateForm.subject} onChange={(e) => setSupportCreateForm((c) => ({ ...c, subject: e.target.value }))} placeholder="What do you need help with?" />
                  </label>
                  <label className="sr-field">
                    <span>Category</span>
                    <select value={supportCreateForm.category} onChange={(e) => setSupportCreateForm((c) => ({ ...c, category: e.target.value }))}>
                      {SR_SUPPORT_CATEGORY_OPTIONS.filter((o) => o.value !== "all").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                  <label className="sr-field">
                    <span>Priority</span>
                    <select value={supportCreateForm.priority} onChange={(e) => setSupportCreateForm((c) => ({ ...c, priority: e.target.value }))}>
                      {SUPPORT_PRIORITY_OPTIONS.filter((v) => v !== "all").map((v) => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                    </select>
                  </label>
                  <label className="sr-field wide">
                    <span>Description</span>
                    <textarea rows="4" value={supportCreateForm.description} onChange={(e) => setSupportCreateForm((c) => ({ ...c, description: e.target.value }))} placeholder="Describe the issue in a few clear sentences." />
                  </label>
                </div>
                {supportCreateError ? <p className="sr-form-error">{supportCreateError}</p> : null}
                <button className="primary-action full-width" type="submit" disabled={supportCreateMutation.isPending}>
                  <Ticket size={16} />
                  {supportCreateMutation.isPending ? "Creating…" : "Create ticket"}
                </button>
              </form>

              <div className="sr-support-filters">
                <label className="sr-field">
                  <span>Search</span>
                  <div className="sr-support-search">
                    <Search size={14} />
                    <input value={supportSearch} onChange={(e) => setSupportSearch(e.target.value)} placeholder="Search tickets…" />
                  </div>
                </label>
                <label className="sr-field">
                  <span>Status</span>
                  <select value={supportStatus} onChange={(e) => setSupportStatus(e.target.value)}>
                    {SUPPORT_STATUS_OPTIONS.map((v) => <option key={v} value={v}>{v === "all" ? "All" : v}</option>)}
                  </select>
                </label>
                <label className="sr-field">
                  <span>Priority</span>
                  <select value={supportPriority} onChange={(e) => setSupportPriority(e.target.value)}>
                    {SUPPORT_PRIORITY_OPTIONS.map((v) => <option key={v} value={v}>{v === "all" ? "All" : v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                  </select>
                </label>
              </div>

              {supportQuery.isError ? (
                <div className="sr-banner error"><AlertTriangle size={14} /><span>{supportQuery.error?.message || "Unable to load support tickets."}</span></div>
              ) : null}

              {supportQuery.isLoading && !supportTickets.length ? (
                <div className="sr-loading">Loading support tickets…</div>
              ) : visibleSupportTickets.length ? (
                <div className="sr-support-list">
                  {visibleSupportTickets.map((ticket) => (
                    <SupportTicketRow
                      key={ticket.id || ticket.ticketNumber}
                      ticket={ticket}
                      active={selectedSupportId === ticket.id || selectedSupportId === ticket.ticketNumber}
                      onSelect={setSelectedSupportId}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState icon={Ticket} text={supportSearch || supportStatus !== "all" || supportPriority !== "all" ? "No support tickets match your filters." : "No support tickets yet."} />
              )}
            </article>

            <SupportTicketDetail
              ticket={selectedSupportTicket}
              replyDraft={supportReplyDraft}
              setReplyDraft={setSupportReplyDraft}
              replySaving={supportReplyMutation.isPending}
              replyError={supportReplyError}
              onReply={() => {
                if (!selectedSupportId || !supportReplyDraft.trim()) return;
                supportReplyMutation.mutate({ ticketId: selectedSupportId, message: supportReplyDraft.trim() });
              }}
              loading={selectedSupportTicketQuery.isLoading}
              loadError={selectedSupportTicketQuery.error?.message || ""}
            />
          </section>
        </>
      )}
    </main>
  );
}
