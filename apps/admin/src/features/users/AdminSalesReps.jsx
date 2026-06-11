import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BadgeDollarSign,
  BarChart2,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Clock,
  CreditCard,
  Crown,
  Eye,
  FileText,
  Headphones,
  LayoutDashboard,
  LockKeyhole,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  PauseCircle,
  Phone,
  ReceiptText,
  Search,
  ShieldCheck,
  ShoppingBag,
  Settings2,
  SlidersHorizontal,
  Star,
  Ticket,
  Truck,
  UserCheck,
  UserCog,
  UserCircle,
  Users,
  WalletCards,
  Warehouse,
  XCircle,
} from "lucide-react";
import { marketplaceApi, ordersApi } from "@tuti/shared/api/client.js";
import { NotificationBell } from "@tuti/shared/components/NotificationBell.jsx";
import { brand } from "@tuti/shared/brand.js";
import { BottleArt } from "@tuti/shared/components/BottleArt.jsx";
import { EmptyState } from "@tuti/shared/components/EmptyState.jsx";
import { MetricCard } from "@tuti/shared/components/MetricCard.jsx";
import { PageTitle } from "@tuti/shared/components/PageTitle.jsx";
import { PanelHeader } from "@tuti/shared/components/PanelHeader.jsx";
import { StatusBadge } from "@tuti/shared/components/StatusBadge.jsx";
import { formatCurrency } from "@tuti/shared/utils/money.js";
import { computeSellerHealth } from "@tuti/shared/utils/sellerHealth.js";
import { DEFAULT_COMMISSION_PLANS } from "@tuti/shared/constants/commission.js";
import { getAllowedOrderActions, getAllowedProductActions } from "@tuti/shared/workflows";
import { AdminUsers } from "../users/AdminUsers.jsx";
import { AdminCRM } from "../crm/AdminCRM.jsx";
import { AdminDrivers } from "../drivers/AdminDrivers.jsx";
import { AdminOperationsDashboard } from "../operations/AdminOperationsDashboard.jsx";
import { AdminPayouts } from "../payouts/AdminPayouts.jsx";
import { AdminSellerPipeline } from "../sellers/AdminSellerPipeline.jsx";
import { AdminSupportTickets } from "../support-tickets/AdminSupportTickets.jsx";
import {
  CONTRACT_ACTIONS,
  FlowStep,
  PRODUCT_ACTION_META,
  RuleControl,
  SellerPaymentRulesPanel,
  TimelineItem,
  formatCaseStatusLabel,
  getContractControlActions,
  getSellerHealth,
  managementRiskClass,
  riskClass,
} from "../shared/adminConsoleShared.jsx";

const SR_REPS_FALLBACK = [
  { id: "REP-001", name: "Hassan Al Haj", code: "HASSAN-AE", email: "hassan@tuti.example", phone: "+971 50 123 4567", plan: "Premium",  status: "Active",  referrals: 7, activeShops: 5, totalGmv: 42800, pendingCommission: 2140, paidCommission: 3800 },
  { id: "REP-002", name: "Lina Khalil",   code: "LINA-KW",   email: "lina@tuti.example",   phone: "+965 99 876 543", plan: "Standard", status: "Active",  referrals: 3, activeShops: 3, totalGmv: 18500, pendingCommission:  555, paidCommission:  890 },
  { id: "REP-003", name: "Omar Farouq",   code: "OMAR-BH",   email: "omar@tuti.example",   phone: "+973 39 112 233", plan: "Starter",  status: "Pending", referrals: 1, activeShops: 0, totalGmv:     0, pendingCommission:    0, paidCommission:    0 },
];

const SR_REFERRALS_FALLBACK = [
  { id: "REF-001", repCode: "HASSAN-AE", shopName: "Oud Palace",         status: "Active",     gmv: 18400, firstSaleDate: "2026-01-25" },
  { id: "REF-002", repCode: "HASSAN-AE", shopName: "Rose Garden Cakes",  status: "Active",     gmv: 12600, firstSaleDate: "2026-02-08" },
  { id: "REF-003", repCode: "HASSAN-AE", shopName: "Desert Bloom Gifts", status: "Registered", gmv:     0, firstSaleDate: null },
  { id: "REF-004", repCode: "LINA-KW",   shopName: "Amber Night",        status: "Active",     gmv:  9800, firstSaleDate: "2026-03-05" },
  { id: "REF-005", repCode: "LINA-KW",   shopName: "Sweet Layers",       status: "First Sale", gmv:  4200, firstSaleDate: "2026-04-12" },
  { id: "REF-006", repCode: "OMAR-BH",   shopName: "Crystal Oud",        status: "Referred",   gmv:     0, firstSaleDate: null },
];

const SR_LEDGER_FALLBACK = [
  { id: "COM-001", repName: "Hassan Al Haj", repCode: "HASSAN-AE", type: "GMV Commission",   shop: "Oud Palace",        amount:  552, status: "Paid",    date: "2026-03-01" },
  { id: "COM-002", repName: "Hassan Al Haj", repCode: "HASSAN-AE", type: "Signup Bonus",     shop: "Rose Garden Cakes", amount:  100, status: "Paid",    date: "2026-02-02" },
  { id: "COM-003", repName: "Hassan Al Haj", repCode: "HASSAN-AE", type: "First Sale Bonus", shop: "Rose Garden Cakes", amount:  250, status: "Paid",    date: "2026-02-09" },
  { id: "COM-004", repName: "Hassan Al Haj", repCode: "HASSAN-AE", type: "GMV Commission",   shop: "Rose Garden Cakes", amount:  378, status: "Pending", date: "2026-05-01" },
  { id: "COM-005", repName: "Lina Khalil",   repCode: "LINA-KW",   type: "Signup Bonus",     shop: "Amber Night",       amount:   50, status: "Paid",    date: "2026-03-01" },
  { id: "COM-006", repName: "Lina Khalil",   repCode: "LINA-KW",   type: "GMV Commission",   shop: "Amber Night",       amount:  294, status: "Pending", date: "2026-05-01" },
];

export function AdminSalesReps() {
  const [selectedRepId, setSelectedRepId] = useState(null);
  const [isCreateRepOpen, setIsCreateRepOpen] = useState(false);
  const [createRepForm, setCreateRepForm] = useState({
    name: "",
    email: "",
    phone: "",
    code: "",
    plan: "Standard",
    status: "Active",
  });
  const [createRepError, setCreateRepError] = useState("");
  const qc = useQueryClient();
  const repsQuery = useQuery({
    queryKey: ["admin-sales-reps"],
    queryFn: marketplaceApi.listSalesReps,
  });
  const referralsQuery = useQuery({
    queryKey: ["admin-referrals"],
    queryFn: marketplaceApi.listReferrals,
  });
  const entriesQuery = useQuery({
    queryKey: ["admin-commission-entries"],
    queryFn: marketplaceApi.listCommissionEntries,
  });
  const plansQuery = useQuery({
    queryKey: ["admin-commission-plans"],
    queryFn: marketplaceApi.getCommissionPlans,
  });
  const createRepMutation = useMutation({
    mutationFn: marketplaceApi.createSalesRep,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-sales-reps"] });
      setIsCreateRepOpen(false);
      setCreateRepError("");
      setCreateRepForm({
        name: "",
        email: "",
        phone: "",
        code: "",
        plan: "Standard",
        status: "Active",
      });
    },
    onError: (error) => {
      setCreateRepError(error?.message || "Unable to create sales rep.");
    },
  });

  const reps = repsQuery.data?.length ? repsQuery.data : SR_REPS_FALLBACK;
  const referrals = referralsQuery.data?.length ? referralsQuery.data : SR_REFERRALS_FALLBACK;
  const ledger = entriesQuery.data?.length ? entriesQuery.data : SR_LEDGER_FALLBACK;
  const commissionPlans = plansQuery.data?.length ? plansQuery.data : Object.values(DEFAULT_COMMISSION_PLANS);

  const totalPending = reps.reduce((s, r) => s + Number(r.pendingCommission || 0), 0);
  const totalPaid    = reps.reduce((s, r) => s + Number(r.paidCommission || 0), 0);
  const activeReps   = reps.filter((r) => r.status === "Active").length;
  const activeRefs   = referrals.filter((r) => String(r.status || "").toLowerCase() === "active").length;

  const selectedRep  = reps.find((r) => r.id === selectedRepId) || null;
  const repReferrals = selectedRep ? referrals.filter((r) => r.repCode === selectedRep.code) : [];
  const isLiveData = Boolean(repsQuery.data?.length || referralsQuery.data?.length || entriesQuery.data?.length);

  const labelReferralStatus = (status) => {
    const normalized = String(status || "").replace(/_/g, " ").toLowerCase();
    if (!normalized) return "Unknown";
    return normalized
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  function updateCreateRepField(field, value) {
    setCreateRepForm((current) => ({ ...current, [field]: value }));
  }

  function handleCreateRepSubmit(event) {
    event.preventDefault();
    setCreateRepError("");
    createRepMutation.mutate({
      name: createRepForm.name.trim(),
      email: createRepForm.email.trim(),
      phone: createRepForm.phone.trim(),
      code: createRepForm.code.trim(),
      plan: createRepForm.plan,
      status: createRepForm.status,
    });
  }

  return (
    <main className="workspace">
      <PageTitle
        kicker="Sales rep program"
        title="Rep network &amp; commissions"
        description="Sales rep directory, commission plans, ledger, and referral pipeline."
      />

      <div className="sr-foundation-notice">
        <ShieldCheck size={14} />
        <span>
          {isLiveData ? (
            <><strong>Live API data.</strong> Sales reps, referrals, and commission entries load from backend endpoints.</>
          ) : (
            <><strong>Demo fallback data.</strong> No live sales rep records were returned, so demo rows are shown.</>
          )}
        </span>
      </div>

      <section className="metric-grid">
        <MetricCard icon={Award}           label="Active reps"        value={activeReps}                   note={`${reps.length} total`} />
        <MetricCard icon={BadgeDollarSign} label="Pending commission" value={formatCurrency(totalPending)} note="Awaiting release" />
        <MetricCard icon={CheckCircle2}    label="Paid commission"    value={formatCurrency(totalPaid)}    note="All-time demo" />
        <MetricCard icon={Users}           label="Active referrals"   value={activeRefs}                   note="Live-selling shops" />
      </section>

      {/* Rep directory */}
      <section className="panel">
        <div className="sr-directory-head">
          <PanelHeader icon={Award} title="Rep directory" action={`${reps.length} reps`} />
          <button className="secondary-action compact" onClick={() => setIsCreateRepOpen(true)} type="button">
            <Award size={16} />
            Create Rep
          </button>
        </div>
        <div className="sr-rep-list">
          {reps.map((rep) => (
            <article
              className={`sr-rep-row${selectedRepId === rep.id ? " sr-rep-row--selected" : ""}`}
              key={rep.id}
              onClick={() => setSelectedRepId(selectedRepId === rep.id ? null : rep.id)}
            >
              <div className="sr-rep-avatar">
                {rep.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
              </div>
              <div className="sr-rep-info">
                <strong>{rep.name}</strong>
                <span><code className="sr-rep-code">{rep.code}</code> · {rep.plan} plan</span>
              </div>
              <div className="sr-rep-kpis">
                <div><strong>{rep.referrals}</strong><span>Referrals</span></div>
                <div><strong>{rep.activeShops}</strong><span>Active</span></div>
                <div><strong>{formatCurrency(rep.totalGmv)}</strong><span>GMV</span></div>
              </div>
              <span className={`seller-health-badge ${rep.status === "Active" ? "success" : "warning"}`}>{rep.status}</span>
              <span className="sr-rep-pending-badge">{formatCurrency(rep.pendingCommission)} pending</span>
            </article>
          ))}
        </div>

        {selectedRep && (
          <div className="sr-rep-detail">
            <div className="sr-rep-detail-head">
              <strong>{selectedRep.name}</strong>
              <code className="sr-rep-code">{selectedRep.code}</code>
              <span className={`seller-health-badge ${selectedRep.status === "Active" ? "success" : "warning"}`}>{selectedRep.status}</span>
            </div>
            <div className="sr-rep-detail-contact">
              <span><Mail size={13} />{selectedRep.email}</span>
              <span><Phone size={13} />{selectedRep.phone}</span>
            </div>
            {repReferrals.length > 0 && (
              <div className="sr-referral-pipeline">
                <strong>Referral pipeline ({repReferrals.length})</strong>
                {repReferrals.map((ref) => (
                  <div className="sr-referral-row" key={ref.id}>
                    <span className="sr-referral-status-pill">{labelReferralStatus(ref.status)}</span>
                    <span className="sr-referral-shop">{ref.shopName}</span>
                    <span>{formatCurrency(ref.gmv || 0)} GMV</span>
                    <span className="muted-label">{ref.firstSaleDate ? `First sale ${ref.firstSaleDate}` : "No sales yet"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Commission plans */}
      <div>
        <PanelHeader icon={BadgeDollarSign} title="Commission plans" action={`${commissionPlans.length} plans`} />
        <div className="sr-plans-grid">
          {commissionPlans.map((plan) => (
            <article className="sr-plan-card" key={plan.id}>
              <div className="sr-plan-name">{plan.name}</div>
              <div className="sr-plan-stat"><span>Signup bonus</span><strong>{formatCurrency(plan.signupBonus)}</strong></div>
              <div className="sr-plan-stat"><span>First sale bonus</span><strong>{formatCurrency(plan.firstSaleBonus)}</strong></div>
              <div className="sr-plan-stat"><span>Base GMV rate</span><strong>{(plan.gmvRate * 100).toFixed(1)}%</strong></div>
              {plan.tierThresholds.length > 0 && (
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
      </div>

      {/* Commission ledger */}
      <section className="panel">
        <PanelHeader icon={ReceiptText} title="Commission ledger" action={`${ledger.length} entries`} />
        <div className="sr-ledger-list">
          {ledger.map((entry) => (
            <div className="sr-ledger-row" key={entry.id}>
              <span className="muted-label">{entry.id}</span>
              <div>
                <strong>{entry.repName || entry.repCode}</strong>
                <span>{entry.type} · {entry.shop || entry.shopName}</span>
              </div>
              <strong>{formatCurrency(entry.amount)}</strong>
              <span className={`seller-health-badge ${entry.status === "Paid" ? "success" : "warning"}`}>{entry.status}</span>
              <span className="muted-label">{entry.date ? String(entry.date).slice(0, 10) : ""}</span>
            </div>
          ))}
        </div>
      </section>

      {isCreateRepOpen ? (
        <div className="admin-contract-modal-backdrop" role="dialog" aria-modal="true">
          <form className="admin-contract-modal sr-create-modal" onSubmit={handleCreateRepSubmit}>
            <div className="admin-contract-modal-head">
              <strong>Create Sales Rep</strong>
              <button className="ghost-action compact" onClick={() => setIsCreateRepOpen(false)} type="button">
                Close
              </button>
            </div>
            <p className="admin-contract-modal-sub">Rep code is used in referral links, e.g. /sell?rep=HASSAN-AE</p>
            <label className="admin-contract-field">
              <span>Name</span>
              <input
                value={createRepForm.name}
                onChange={(event) => updateCreateRepField("name", event.target.value)}
                placeholder="Rep full name"
                required
              />
            </label>
            <label className="admin-contract-field">
              <span>Email</span>
              <input
                type="email"
                value={createRepForm.email}
                onChange={(event) => updateCreateRepField("email", event.target.value)}
                placeholder="rep@tuti.example"
                required
              />
            </label>
            <label className="admin-contract-field">
              <span>Phone (optional)</span>
              <input
                value={createRepForm.phone}
                onChange={(event) => updateCreateRepField("phone", event.target.value)}
                placeholder="+971..."
              />
            </label>
            <label className="admin-contract-field">
              <span>Rep code</span>
              <input
                value={createRepForm.code}
                onChange={(event) => updateCreateRepField("code", event.target.value.toUpperCase())}
                placeholder="HASSAN-AE"
              />
            </label>
            <div className="sr-create-row">
              <label className="admin-contract-field">
                <span>Plan</span>
                <select value={createRepForm.plan} onChange={(event) => updateCreateRepField("plan", event.target.value)}>
                  <option value="Starter">Starter</option>
                  <option value="Standard">Standard</option>
                  <option value="Premium">Premium</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              </label>
              <label className="admin-contract-field">
                <span>Status</span>
                <select value={createRepForm.status} onChange={(event) => updateCreateRepField("status", event.target.value)}>
                  <option value="Active">Active</option>
                  <option value="Pending">Pending</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>
            </div>
            {createRepError ? <p className="admin-contract-error">{createRepError}</p> : null}
            <div className="admin-contract-modal-actions">
              <button className="ghost-action compact" onClick={() => setIsCreateRepOpen(false)} type="button">
                Cancel
              </button>
              <button className="secondary-action compact" disabled={createRepMutation.isPending} type="submit">
                {createRepMutation.isPending ? "Creating..." : "Create rep"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
