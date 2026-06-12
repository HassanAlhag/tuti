import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeDollarSign,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Download,
  Headphones,
  Play,
  RefreshCw,
  RotateCcw,
  Truck,
  WalletCards,
} from "lucide-react";
import { adminCodSettlementApi, adminReportsApi } from "@tuti/shared/api/client.js";
import { EmptyState } from "@tuti/shared/components/EmptyState.jsx";
import { formatCurrency } from "@tuti/shared/utils/money.js";

function formatDate(v) {
  if (!v) return "—";
  return new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(v));
}

function MetricTile({ icon: Icon, label, value, sub, tone = "neutral" }) {
  const toneClass = tone === "danger" ? "fin-tile--danger" : tone === "warn" ? "fin-tile--warn" : "";
  return (
    <article className={`fin-tile ${toneClass}`}>
      <span className="fin-tile-icon"><Icon size={16} /></span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {sub ? <small>{sub}</small> : null}
      </div>
    </article>
  );
}

// ── COD Settlement ────────────────────────────────────────────────────────────

function CodSettlementPanel() {
  const qc = useQueryClient();
  const [driverId, setDriverId] = useState("");
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [lastResult, setLastResult] = useState(null);
  const [settleNote, setSettleNote] = useState("");

  const candidatesQuery = useQuery({
    queryKey: ["fin", "cod-candidates", driverId],
    queryFn: () => adminCodSettlementApi.candidates(driverId),
    enabled: Boolean(driverId),
  });

  const settleMutation = useMutation({
    mutationFn: ({ dId, orderIds, notes }) => adminCodSettlementApi.settle(dId, { orderIds, notes }),
    onSuccess: (data) => {
      setLastResult(data);
      setSelectedOrders(new Set());
      setSettleNote("");
      qc.invalidateQueries({ queryKey: ["fin", "cod-candidates", driverId] });
      qc.invalidateQueries({ queryKey: ["fin", "reconciliation"] });
    },
  });

  const candidates = Array.isArray(candidatesQuery.data?.candidates) ? candidatesQuery.data.candidates : [];
  const allSelected = candidates.length > 0 && candidates.every((o) => selectedOrders.has(o.orderId));

  function toggleAll() {
    if (allSelected) setSelectedOrders(new Set());
    else setSelectedOrders(new Set(candidates.map((o) => o.orderId)));
  }

  function toggleOne(orderId) {
    setSelectedOrders((prev) => {
      const next = new Set(prev);
      next.has(orderId) ? next.delete(orderId) : next.add(orderId);
      return next;
    });
  }

  const selectedTotal = candidates
    .filter((o) => selectedOrders.has(o.orderId))
    .reduce((s, o) => s + Number(o.codAmount || 0), 0);

  return (
    <section className="panel fin-section">
      <div className="fin-section-head">
        <Truck size={16} />
        <div>
          <span className="eyebrow">COD cash reconciliation</span>
          <h2>Driver COD settlement</h2>
          <p>Settle collected cash from a driver and credit the seller's pending balance.</p>
        </div>
      </div>

      <div className="fin-driver-lookup">
        <label className="fin-field">
          <span>Driver ID</span>
          <input
            value={driverId}
            onChange={(e) => { setDriverId(e.target.value); setSelectedOrders(new Set()); setLastResult(null); }}
            placeholder="e.g. drv-abc123"
          />
        </label>
        <button
          className="secondary-action compact"
          type="button"
          disabled={!driverId || candidatesQuery.isFetching}
          onClick={() => qc.invalidateQueries({ queryKey: ["fin", "cod-candidates", driverId] })}
        >
          <RefreshCw size={13} />
          Load
        </button>
      </div>

      {candidatesQuery.isError && (
        <div className="fin-banner error"><AlertTriangle size={14} />{candidatesQuery.error?.message || "Failed to load."}</div>
      )}

      {lastResult && (
        <div className="fin-banner success">
          <CheckCircle2 size={14} />
          Settled {lastResult.settledOrders?.length || 0} orders · {formatCurrency(lastResult.totalCashAmount)} · Ref: {lastResult.settlementRef}
          · Driver balance after: {formatCurrency(lastResult.driverCodBalanceAfter)}
        </div>
      )}

      {candidatesQuery.data && (
        <div className="fin-cod-summary">
          <span>Driver: <strong>{candidatesQuery.data.driverName || driverId}</strong></span>
          <span>COD balance: <strong>{formatCurrency(candidatesQuery.data.codBalance || 0)}</strong></span>
          <span>Eligible orders: <strong>{candidatesQuery.data.totalEligible || 0}</strong></span>
          <span>Eligible cash: <strong>{formatCurrency(candidatesQuery.data.totalCash || 0)}</strong></span>
        </div>
      )}

      {candidates.length > 0 && (
        <>
          <div className="fin-cod-table">
            <div className="fin-cod-head">
              <label><input type="checkbox" checked={allSelected} onChange={toggleAll} /> All</label>
              <span>Order</span>
              <span>Customer</span>
              <span>COD amount</span>
              <span>Delivered</span>
            </div>
            {candidates.map((o) => (
              <label className="fin-cod-row" key={o.orderId}>
                <input type="checkbox" checked={selectedOrders.has(o.orderId)} onChange={() => toggleOne(o.orderId)} />
                <strong>{o.orderId}</strong>
                <span>{o.customerName || "—"}</span>
                <strong>{formatCurrency(o.codAmount || 0)}</strong>
                <span>{formatDate(o.deliveredAt)}</span>
              </label>
            ))}
          </div>

          <div className="fin-cod-actions">
            <label className="fin-field">
              <span>Settlement note</span>
              <input value={settleNote} onChange={(e) => setSettleNote(e.target.value)} placeholder="Cash received, receipt #…" />
            </label>
            <button
              className="primary-action"
              type="button"
              disabled={selectedOrders.size === 0 || settleMutation.isPending}
              onClick={() => settleMutation.mutate({ dId: driverId, orderIds: [...selectedOrders], notes: settleNote })}
            >
              <CircleDollarSign size={14} />
              {settleMutation.isPending ? "Settling…" : `Settle ${selectedOrders.size} orders (${formatCurrency(selectedTotal)})`}
            </button>
          </div>
          {settleMutation.isError && (
            <div className="fin-banner error"><AlertTriangle size={14} />{settleMutation.error?.message}</div>
          )}
        </>
      )}

      {candidatesQuery.data && candidates.length === 0 && !candidatesQuery.isError && (
        <EmptyState icon={CheckCircle2} text="No unsettled COD orders for this driver." />
      )}

      {!driverId && <EmptyState icon={Truck} text="Enter a driver ID above to load their unsettled COD orders." />}
    </section>
  );
}

// ── Commission Run ────────────────────────────────────────────────────────────

function CommissionRunPanel() {
  const qc = useQueryClient();
  const [dryRun, setDryRun] = useState(true);
  const [lastResult, setLastResult] = useState(null);

  const runMutation = useMutation({
    mutationFn: () => adminReportsApi.runCommissions(dryRun),
    onSuccess: (data) => {
      setLastResult(data);
      if (!dryRun) {
        qc.invalidateQueries({ queryKey: ["fin", "reconciliation"] });
      }
    },
  });

  return (
    <section className="panel fin-section">
      <div className="fin-section-head">
        <BadgeDollarSign size={16} />
        <div>
          <span className="eyebrow">SR commission automation</span>
          <h2>Commission calculation</h2>
          <p>Scans all active referrals and creates pending GMV commission entries for delivered orders not yet accounted for.</p>
        </div>
      </div>

      <div className="fin-commission-controls">
        <label className="fin-toggle">
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
          <span>Dry run (preview only — no entries created)</span>
        </label>
        <button
          className={dryRun ? "secondary-action" : "primary-action"}
          type="button"
          disabled={runMutation.isPending}
          onClick={() => runMutation.mutate()}
        >
          <Play size={14} />
          {runMutation.isPending ? "Running…" : dryRun ? "Preview calculation" : "Run calculation"}
        </button>
      </div>

      {runMutation.isError && (
        <div className="fin-banner error"><AlertTriangle size={14} />{runMutation.error?.message}</div>
      )}

      {lastResult && (
        <div className="fin-commission-result">
          <div className="fin-commission-summary">
            <span><strong>{lastResult.created}</strong> entries {lastResult.dryRun ? "would be created" : "created"}</span>
            <span><strong>{lastResult.skipped}</strong> skipped (duplicates / zero subtotal)</span>
            {lastResult.dryRun && <span className="fin-dry-run-badge">Dry run — no changes made</span>}
          </div>
          {lastResult.dryRun && lastResult.entries?.length > 0 && (
            <div className="fin-commission-preview">
              <div className="fin-commission-preview-head">
                <span>Rep code</span><span>Shop</span><span>Order</span><span>Amount</span><span>Rate</span>
              </div>
              {lastResult.entries.slice(0, 20).map((e, i) => (
                <div className="fin-commission-preview-row" key={i}>
                  <span>{e.repCode}</span>
                  <span>{e.shopId}</span>
                  <span>{e.orderId}</span>
                  <strong>{formatCurrency(e.amount)}</strong>
                  <span>{((e.rate || 0) * 100).toFixed(1)}%</span>
                </div>
              ))}
              {lastResult.entries.length > 20 && (
                <p className="fin-preview-more">+ {lastResult.entries.length - 20} more</p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ── Reconciliation ────────────────────────────────────────────────────────────

function ReconciliationPanel() {
  const qc = useQueryClient();

  const recoQuery = useQuery({
    queryKey: ["fin", "reconciliation"],
    queryFn: () => adminReportsApi.reconciliation(),
    refetchInterval: 5 * 60 * 1000,
  });

  const data = recoQuery.data;

  return (
    <section className="panel fin-section">
      <div className="fin-section-head">
        <RotateCcw size={16} />
        <div>
          <span className="eyebrow">Open obligations</span>
          <h2>Financial reconciliation</h2>
          <p>All open financial items that need admin attention before books are balanced.</p>
        </div>
        <button className="ghost-action compact fin-refresh" type="button" onClick={() => qc.invalidateQueries({ queryKey: ["fin", "reconciliation"] })}>
          <RefreshCw size={13} />Refresh
        </button>
      </div>

      {recoQuery.isError && (
        <div className="fin-banner error"><AlertTriangle size={14} />{recoQuery.error?.message || "Failed to load."}</div>
      )}

      {recoQuery.isLoading ? (
        <div className="app-status">Loading reconciliation…</div>
      ) : data ? (
        <>
          <div className="fin-reco-grid">
            <MetricTile
              icon={WalletCards}
              label="Unsettled COD"
              value={formatCurrency(data.unsettledCod?.total || 0)}
              sub={`${data.unsettledCod?.count || 0} orders`}
              tone={data.unsettledCod?.count > 0 ? "warn" : "neutral"}
            />
            <MetricTile
              icon={CircleDollarSign}
              label="Pending payouts"
              value={formatCurrency(data.pendingPayouts?.total || 0)}
              sub={`${data.pendingPayouts?.count || 0} payout requests`}
              tone={data.pendingPayouts?.count > 0 ? "warn" : "neutral"}
            />
            <MetricTile
              icon={Headphones}
              label="Active disputes"
              value={data.activeDisputes || 0}
              sub="orders in Disputed status"
              tone={data.activeDisputes > 0 ? "danger" : "neutral"}
            />
            <MetricTile
              icon={BadgeDollarSign}
              label="Pending commissions"
              value={formatCurrency(data.pendingCommissions?.total || 0)}
              sub={`${data.pendingCommissions?.count || 0} entries awaiting confirmation`}
              tone="neutral"
            />
          </div>

          {data.unsettledCod?.byDriver?.length > 0 && (
            <div className="fin-reco-drivers">
              <h3>Unsettled COD by driver</h3>
              {data.unsettledCod.byDriver.map((d) => (
                <div className="fin-reco-driver-row" key={d.driverId}>
                  <Truck size={13} />
                  <span>{d.driverId}</span>
                  <span>{d.count} orders</span>
                  <strong>{formatCurrency(d.total)}</strong>
                </div>
              ))}
            </div>
          )}

          <p className="fin-reco-ts">Last updated: {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : "—"}</p>
        </>
      ) : null}
    </section>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const TABS = [
  { id: "reconciliation", label: "Reconciliation" },
  { id: "cod",            label: "COD Settlement" },
  { id: "commissions",    label: "Commission run" },
];

export function AdminFinance() {
  const [tab, setTab] = useState("reconciliation");

  return (
    <main className="admin-main">
      <div className="fin-header">
        <span className="eyebrow">Financial operations</span>
        <h1>Finance</h1>
        <p>Settle COD cash, trigger commission calculations, and review open financial obligations.</p>
      </div>

      <div className="segment-tabs fin-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "filter-tab active" : "filter-tab"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "reconciliation" && <ReconciliationPanel />}
      {tab === "cod"            && <CodSettlementPanel />}
      {tab === "commissions"    && <CommissionRunPanel />}
    </main>
  );
}
