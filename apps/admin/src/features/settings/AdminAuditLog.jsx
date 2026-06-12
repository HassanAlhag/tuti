import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Filter, Search, ShieldCheck } from "lucide-react";
import { adminAuditApi } from "@tuti/shared/api/client.js";
import { EmptyState } from "@tuti/shared/components/EmptyState.jsx";
import { PageTitle } from "@tuti/shared/components/PageTitle.jsx";
import { PanelHeader } from "@tuti/shared/components/PanelHeader.jsx";

const ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "product.live", label: "Product approved" },
  { value: "product.rejected", label: "Product rejected" },
  { value: "shop.contract.suspend", label: "Shop suspended" },
  { value: "shop.contract.reactivate", label: "Shop reactivated" },
  { value: "shop.contract.terminate", label: "Shop terminated" },
  { value: "order.status.delivered", label: "Order delivered" },
  { value: "order.status.cancelled", label: "Order cancelled" },
  { value: "payout.completed", label: "Payout completed" },
  { value: "seller_application.converted", label: "Seller converted" },
];

const ENTITY_OPTIONS = [
  { value: "", label: "All entities" },
  { value: "product", label: "Product" },
  { value: "shop", label: "Shop" },
  { value: "order", label: "Order" },
  { value: "payout", label: "Payout" },
  { value: "seller_application", label: "Application" },
];

function downloadCsv(csvText, filename) {
  const blob = new Blob([csvText], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminAuditLog() {
  const [action, setAction]     = useState("");
  const [entityType, setEntity] = useState("");
  const [from, setFrom]         = useState("");
  const [to, setTo]             = useState("");
  const [page, setPage]         = useState(1);
  const [exporting, setExporting] = useState(false);

  const params = { action, entityType, from, to, page, limit: 50 };
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-audit", params],
    queryFn: () => adminAuditApi.list(params),
  });

  const events = data?.data?.events || [];
  const total  = data?.data?.total  || 0;
  const pages  = Math.max(1, Math.ceil(total / 50));

  async function handleExport() {
    setExporting(true);
    try {
      const result = await adminAuditApi.exportCsv({ action, entityType, from, to });
      downloadCsv(typeof result === "string" ? result : JSON.stringify(result), `audit-log-${Date.now()}.csv`);
    } catch {
      // silent — user can retry
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="workspace">
      <PageTitle
        kicker="Audit trail"
        title="System event log"
        description="Every significant platform action is recorded for compliance and review."
      />

      <section className="panel">
        <PanelHeader
          icon={ShieldCheck}
          title="Event log"
          action={
            <button
              className="btn btn-sm btn-outline"
              onClick={handleExport}
              disabled={exporting}
            >
              <Download size={14} style={{ marginRight: 4 }} />
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
          }
        />

        {/* Filter bar */}
        <div className="audit-filters" style={{ display: "flex", gap: 8, padding: "12px 16px", flexWrap: "wrap", borderBottom: "1px solid var(--border)" }}>
          <select
            className="input-sm"
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
          >
            {ACTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <select
            className="input-sm"
            value={entityType}
            onChange={(e) => { setEntity(e.target.value); setPage(1); }}
          >
            {ENTITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <input
            type="date"
            className="input-sm"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            placeholder="From"
          />
          <input
            type="date"
            className="input-sm"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1); }}
            placeholder="To"
          />

          {(action || entityType || from || to) && (
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => { setAction(""); setEntity(""); setFrom(""); setTo(""); setPage(1); }}
            >
              Clear
            </button>
          )}

          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)", alignSelf: "center" }}>
            {total} event{total !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="admin-audit-list">
          {isLoading ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>Loading…</div>
          ) : isError ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--danger)" }}>Failed to load events.</div>
          ) : events.length === 0 ? (
            <EmptyState icon={ShieldCheck} text="No audit events match your filters." />
          ) : (
            events.map((event) => (
              <div className="admin-audit-row" key={event.id}>
                <div className="admin-audit-icon">
                  <ShieldCheck size={15} />
                </div>
                <div className="admin-audit-body">
                  <strong>{event.summary}</strong>
                  <small>
                    <span className="audit-action-badge">{event.action}</span>
                    {" · "}
                    {event.actorName || event.actorId || "system"}
                    {event.actorRole ? ` (${event.actorRole})` : ""}
                    {" · "}
                    {new Date(event.createdAt).toLocaleString()}
                  </small>
                </div>
                <span className="status-badge live">Logged</span>
              </div>
            ))
          )}
        </div>

        {pages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: 12 }}>
            <button className="btn btn-sm btn-ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              ←
            </button>
            <span style={{ fontSize: 13, alignSelf: "center" }}>Page {page} / {pages}</span>
            <button className="btn btn-sm btn-ghost" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}>
              →
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
