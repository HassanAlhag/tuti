import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeDollarSign,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  WalletCards,
  X,
  XCircle,
} from "lucide-react";
import { adminPayoutsApi, marketplaceApi } from "@tuti/shared/api/client.js";
import { EmptyState }  from "@tuti/shared/components/EmptyState.jsx";
import { MetricCard }  from "@tuti/shared/components/MetricCard.jsx";
import { PageTitle }   from "@tuti/shared/components/PageTitle.jsx";
import { PanelHeader } from "@tuti/shared/components/PanelHeader.jsx";
import { formatCurrency } from "@tuti/shared/utils/money.js";

const STATUS_TONE = {
  pending:    "warning",
  processing: "brand",
  completed:  "success",
  failed:     "danger",
  cancelled:  "muted",
};

const ALLOWED_TRANSITIONS = {
  pending:    ["processing", "cancelled"],
  processing: ["completed", "failed"],
  failed:     ["pending"],
};

const METHOD_LABELS = {
  bank_transfer: "Bank transfer",
  wallet:        "Wallet",
  manual:        "Manual",
};

function formatDate(val) {
  if (!val) return "—";
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? "—"
    : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
}

export function AdminPayouts() {
  const qc = useQueryClient();
  const [selectedShopId, setSelectedShopId] = useState("");
  const [createModal,    setCreateModal]    = useState(false);
  const [releaseModal,   setReleaseModal]   = useState(false);
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [createMethod,   setCreateMethod]   = useState("bank_transfer");
  const [createNotes,    setCreateNotes]    = useState("");
  const [createError,    setCreateError]    = useState("");
  const [releaseForce,   setReleaseForce]   = useState(false);
  const [releaseNotes,   setReleaseNotes]   = useState("");
  const [releaseError,   setReleaseError]   = useState("");
  const [releaseResult,  setReleaseResult]  = useState(null);

  // ── Data ─────────────────────────────────────────────────────────────────────
  const { data: adminData } = useQuery({
    queryKey: ["admin-data"],
    queryFn:  () => marketplaceApi.getAdminData(),
  });

  const { data: payoutsData, isLoading: payoutsLoading } = useQuery({
    queryKey: ["admin-payouts", selectedShopId || "all"],
    queryFn:  () => adminPayoutsApi.list(selectedShopId ? { shopId: selectedShopId } : {}),
  });

  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: ["payout-preview", selectedShopId],
    queryFn:  () => adminPayoutsApi.getPreview(selectedShopId),
    enabled:  Boolean(selectedShopId) && createModal,
  });

  const { data: releasePreviewData, isLoading: releasePreviewLoading } = useQuery({
    queryKey: ["payout-release-preview", selectedShopId],
    queryFn:  () => adminPayoutsApi.getReleasePreview(selectedShopId),
    enabled:  Boolean(selectedShopId) && releaseModal,
  });

  const shops   = adminData?.shops   || [];
  const payouts = Array.isArray(payoutsData) ? payoutsData : [];
  const preview = previewData;      // request() already unwraps payload.data
  const candidates = preview?.eligibleOrders || [];

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: () => adminPayoutsApi.create({
      shopId:   selectedShopId,
      orderIds: [...selectedOrders],
      method:   createMethod,
      notes:    createNotes,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
      qc.invalidateQueries({ queryKey: ["payout-preview", selectedShopId] });
      setCreateModal(false);
      setSelectedOrders(new Set());
      setCreateNotes("");
      setCreateError("");
    },
    onError: (err) => setCreateError(err?.message || "Failed to create payout."),
  });

  const releaseMutation = useMutation({
    mutationFn: () => adminPayoutsApi.releaseEarnings(selectedShopId, {
      releaseAllEligible: true,
      force: releaseForce,
      notes: releaseNotes,
    }),
    onSuccess: (data) => {
      setReleaseResult(data);
      setReleaseError("");
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
      qc.invalidateQueries({ queryKey: ["admin-data"] });
      qc.invalidateQueries({ queryKey: ["payout-preview", selectedShopId] });
      qc.invalidateQueries({ queryKey: ["payout-release-preview", selectedShopId] });
    },
    onError: (err) => setReleaseError(err?.message || "Failed to release earnings."),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, reason }) => adminPayoutsApi.updateStatus(id, status, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payouts"] });
      qc.invalidateQueries({ queryKey: ["payout-preview", selectedShopId] });
    },
  });

  // ── Derived ──────────────────────────────────────────────────────────────────
  const selectedTotal = candidates
    .filter((c) => selectedOrders.has(c.orderId))
    .reduce((s, c) => s + c.amount, 0);

  const totalPending   = payouts.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const totalCompleted = payouts.filter((p) => p.status === "completed").reduce((s, p) => s + p.amount, 0);

  return (
    <main className="workspace">
      <PageTitle
        kicker="Finance"
        title="Payout Management"
        description="Review available seller earnings, create payouts, and track status. Admin-initiated only."
      />

      <section className="metric-grid">
        <MetricCard icon={WalletCards}      label="Payouts pending"   value={payouts.filter((p) => p.status === "pending").length}   note={formatCurrency(totalPending)} />
        <MetricCard icon={CircleDollarSign} label="Completed payouts" value={payouts.filter((p) => p.status === "completed").length} note={formatCurrency(totalCompleted)} />
        <MetricCard icon={Clock}            label="In processing"     value={payouts.filter((p) => p.status === "processing").length} note="Awaiting confirmation" />
        <MetricCard icon={XCircle}          label="Failed / cancelled" value={payouts.filter((p) => ["failed","cancelled"].includes(p.status)).length} note="" />
      </section>

      {/* Shop filter */}
      <div className="drivers-toolbar">
        <div className="drivers-toolbar-filters">
          <label className="drivers-filter-select">
            <span>Shop</span>
            <select value={selectedShopId} onChange={(e) => setSelectedShopId(e.target.value)}>
              <option value="">All shops</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          {selectedShopId && (
            <>
              <button
                className="secondary-action compact"
                type="button"
                onClick={() => {
                  setReleaseModal(true);
                  setReleaseForce(false);
                  setReleaseNotes("");
                  setReleaseError("");
                  setReleaseResult(null);
                }}
              >
                <AlertTriangle size={14} /> Release earnings
              </button>
              <button
                className="primary-action compact"
                type="button"
                onClick={() => { setSelectedOrders(new Set()); setCreateNotes(""); setCreateError(""); setCreateModal(true); }}
              >
                <BadgeDollarSign size={14} /> New payout
              </button>
            </>
          )}
        </div>
      </div>

      {/* Payout list */}
      <section className="panel">
        <PanelHeader icon={WalletCards} title="Payout history" action={`${payouts.length} record${payouts.length !== 1 ? "s" : ""}`} />
        {payoutsLoading ? (
          <div className="app-status">Loading payouts…</div>
        ) : payouts.length === 0 ? (
          <EmptyState icon={WalletCards} text="No payouts yet. Select a shop and create the first payout from eligible earnings." />
        ) : (
          <div className="payout-list">
            {payouts.map((p) => (
              <div className="payout-row" key={p.id}>
                <div className="payout-ref">
                  <strong>{p.id}</strong>
                  <span>{p.shopId}</span>
                </div>
                <div className="payout-details">
                  <strong>{formatCurrency(p.amount)}</strong>
                  <span>{METHOD_LABELS[p.method] || p.method}</span>
                  <span>{p.orderIds?.length || 0} order{p.orderIds?.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="payout-dates">
                  <span>Created {formatDate(p.createdAt)}</span>
                  {p.completedAt && <span>Completed {formatDate(p.completedAt)}</span>}
                  {p.failedAt    && <span className="payout-fail-reason">Failed: {p.failureReason || "—"}</span>}
                </div>
                <span className={`status-badge status-badge--${STATUS_TONE[p.status] || "muted"}`}>
                  {p.status}
                </span>
                <div className="payout-actions">
                  {(ALLOWED_TRANSITIONS[p.status] || []).map((next) => (
                    <button
                      key={next}
                      type="button"
                      className={next === "completed" ? "primary-action compact" : next === "cancelled" || next === "failed" ? "ghost-action compact" : "secondary-action compact"}
                      disabled={statusMutation.isPending}
                      onClick={() => {
                        if (next === "completed") {
                          if (!window.confirm("Mark as completed only after the transfer has been sent. Continue?")) return;
                        }
                        statusMutation.mutate({ id: p.id, status: next });
                      }}
                    >
                      {next === "processing" ? "Mark processing" :
                       next === "completed"  ? "Mark completed"  :
                       next === "cancelled"  ? "Cancel"          :
                       next === "failed"     ? "Mark failed"     :
                       next === "pending"    ? "Retry"           : next}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create payout modal */}
      {createModal && (
        <div className="drivers-modal-overlay">
          <div className="drivers-modal drivers-modal--wide">
            <div className="drivers-modal-head">
              <strong>New payout — {shops.find((s) => s.id === selectedShopId)?.name || selectedShopId}</strong>
              <button className="icon-button" type="button" onClick={() => setCreateModal(false)}><X size={16} /></button>
            </div>
            <div className="drivers-assign-form">
              <p className="drivers-remit-note">
                <AlertTriangle size={13} />
                Only complete after the bank transfer or wallet credit has been sent.
              </p>
              {previewLoading ? (
                <p className="drivers-empty-inline">Loading eligible earnings…</p>
              ) : candidates.length === 0 ? (
                <p className="drivers-empty-inline">No eligible released earnings for this shop.</p>
              ) : (
                <>
                  {preview?.balances && (
                    <div className="payout-balance-strip">
                      <span>Available: <strong>{formatCurrency(preview.balances.availableBalance)}</strong></span>
                      <span>Pending: <strong>{formatCurrency(preview.balances.pendingBalance)}</strong></span>
                      {preview.balances.holdBalance > 0 && (
                        <span className="payout-hold-flag">On hold: <strong>{formatCurrency(preview.balances.holdBalance)}</strong></span>
                      )}
                    </div>
                  )}
                  <div className="drivers-settle-list">
                    {candidates.map((c) => (
                      <label key={c.orderId} className="drivers-settle-row">
                        <input
                          type="checkbox"
                          checked={selectedOrders.has(c.orderId)}
                          onChange={(e) => {
                            const next = new Set(selectedOrders);
                            e.target.checked ? next.add(c.orderId) : next.delete(c.orderId);
                            setSelectedOrders(next);
                          }}
                        />
                        <div className="drivers-settle-detail">
                          <strong>{c.orderId}</strong>
                          <span className="drivers-settle-shops">{c.shopIds?.join(", ")}</span>
                        </div>
                        <div className="drivers-settle-amounts">
                          <strong>{formatCurrency(c.amount)}</strong>
                        </div>
                      </label>
                    ))}
                  </div>
                  {selectedOrders.size > 0 && (
                    <div className="drivers-settle-summary">
                      <span>{selectedOrders.size} order{selectedOrders.size !== 1 ? "s" : ""} selected</span>
                      <strong>Total payout: {formatCurrency(selectedTotal)}</strong>
                    </div>
                  )}
                  <label className="admin-contract-field">
                    <span>Method</span>
                    <select value={createMethod} onChange={(e) => setCreateMethod(e.target.value)}>
                      <option value="bank_transfer">Bank transfer</option>
                      <option value="wallet">Wallet</option>
                      <option value="manual">Manual</option>
                    </select>
                  </label>
                  <label className="admin-contract-field">
                    <span>Notes (optional)</span>
                    <input type="text" value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} placeholder="e.g. June batch" />
                  </label>
                </>
              )}
              {createError && <p className="admin-contract-error">{createError}</p>}
              <div className="admin-contract-modal-actions">
                <button className="ghost-action compact" type="button" onClick={() => setCreateModal(false)}>Cancel</button>
                <button
                  className="primary-action compact"
                  type="button"
                  disabled={selectedOrders.size === 0 || createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                >
                  {createMutation.isPending ? "Creating…" : `Create payout (${formatCurrency(selectedTotal)})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {releaseModal && (
        <div className="drivers-modal-overlay">
          <div className="drivers-modal drivers-modal--wide">
            <div className="drivers-modal-head">
              <strong>Release earnings — {shops.find((s) => s.id === selectedShopId)?.name || selectedShopId}</strong>
              <button className="icon-button" type="button" onClick={() => setReleaseModal(false)}><X size={16} /></button>
            </div>
            <div className="drivers-assign-form">
              <p className="drivers-remit-note">
                <AlertTriangle size={13} />
                This moves matured pending earnings into Available balance for payout.
              </p>
              {releasePreviewLoading ? (
                <p className="drivers-empty-inline">Loading release preview…</p>
              ) : (
                <>
                  {releasePreviewData?.balances && (
                    <div className="payout-balance-strip">
                      <span>Pending: <strong>{formatCurrency(releasePreviewData.balances.pendingBalance)}</strong></span>
                      <span>Available: <strong>{formatCurrency(releasePreviewData.balances.availableBalance)}</strong></span>
                      <span>On hold: <strong>{formatCurrency(releasePreviewData.balances.holdBalance)}</strong></span>
                      <span>Paid: <strong>{formatCurrency(releasePreviewData.balances.paidBalance)}</strong></span>
                    </div>
                  )}
                  {releasePreviewData && (
                    <div className="payout-balance-strip">
                      <span>Eligible now: <strong>{releasePreviewData.eligibleOrders?.length || 0}</strong></span>
                      <span>Maturing later: <strong>{releasePreviewData.notYetMatureOrders?.length || 0}</strong></span>
                      <span>Skipped: <strong>{releasePreviewData.skippedOrders?.length || 0}</strong></span>
                      <span>Total releasable: <strong>{formatCurrency(releasePreviewData.eligibleTotal || 0)}</strong></span>
                    </div>
                  )}

                  <div className="drivers-assign-stack">
                    <strong>Eligible now</strong>
                    {releasePreviewData?.eligibleOrders?.length ? (
                      <div className="drivers-settle-list">
                        {releasePreviewData.eligibleOrders.map((item) => (
                          <div key={item.orderId} className="drivers-settle-row">
                            <div className="drivers-settle-detail">
                              <strong>{item.orderId}</strong>
                              <span>{item.creditType === "cod_credit" ? "COD settled earning" : "Delivery earning"}</span>
                            </div>
                            <div className="drivers-settle-amounts">
                              <strong>{formatCurrency(item.amount)}</strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="drivers-empty-inline">No matured earnings are ready for release.</p>
                    )}
                  </div>

                  <div className="drivers-assign-stack">
                    <strong>Not yet mature</strong>
                    {releasePreviewData?.notYetMatureOrders?.length ? (
                      <div className="drivers-settle-list">
                        {releasePreviewData.notYetMatureOrders.map((item) => (
                          <div key={item.orderId} className="drivers-settle-row">
                            <div className="drivers-settle-detail">
                              <strong>{item.orderId}</strong>
                              <span>Matures on {formatDate(item.eligibleAt)}</span>
                            </div>
                            <div className="drivers-settle-amounts">
                              <strong>{formatCurrency(item.amount)}</strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="drivers-empty-inline">No pending earnings are waiting on the hold period.</p>
                    )}
                  </div>

                  <div className="drivers-assign-stack">
                    <strong>Skipped</strong>
                    {releasePreviewData?.skippedOrders?.length ? (
                      <div className="drivers-settle-list">
                        {releasePreviewData.skippedOrders.map((item) => (
                          <div key={item.orderId} className="drivers-settle-row">
                            <div className="drivers-settle-detail">
                              <strong>{item.orderId}</strong>
                              <span>{item.reason.replace(/_/g, " ")}</span>
                            </div>
                            <div className="drivers-settle-amounts">
                              <strong>{formatCurrency(item.amount || 0)}</strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="drivers-empty-inline">No skipped earnings for this shop.</p>
                    )}
                  </div>
                </>
              )}
              <label className="admin-contract-field">
                <span>Notes (optional)</span>
                <input
                  type="text"
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                  placeholder="e.g. Release after manual review"
                />
              </label>
              <label className="drivers-modal-check">
                <input
                  type="checkbox"
                  checked={releaseForce}
                  onChange={(e) => setReleaseForce(e.target.checked)}
                />
                <span>Force release immature earnings</span>
              </label>
              <p className="drivers-cod-note">
                <AlertTriangle size={13} />
                Force release only bypasses the hold period. Disputed, refunded, cancelled, unsettled COD, and already paid earnings stay blocked.
              </p>
              {releaseResult && (
                <div className="payout-balance-strip">
                  <span>Released orders: <strong>{releaseResult.releasedOrders?.length || 0}</strong></span>
                  <span>Skipped: <strong>{releaseResult.skippedOrders?.length || 0}</strong></span>
                  <span>Total released: <strong>{formatCurrency(releaseResult.totalReleasedAmount || 0)}</strong></span>
                </div>
              )}
              {releaseError && <p className="admin-contract-error">{releaseError}</p>}
              <div className="admin-contract-modal-actions">
                <button className="ghost-action compact" type="button" onClick={() => setReleaseModal(false)}>Close</button>
                <button
                  className="primary-action compact"
                  type="button"
                  disabled={
                    releaseMutation.isPending
                    || !(releasePreviewData?.eligibleOrders?.length || (releaseForce && releasePreviewData?.notYetMatureOrders?.length))
                  }
                  onClick={() => releaseMutation.mutate()}
                >
                  {releaseMutation.isPending ? "Releasing…" : "Release eligible earnings"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
