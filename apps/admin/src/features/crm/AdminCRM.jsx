import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CircleDollarSign,
  Headphones,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Star,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { crmApi } from "@tuti/shared/api/client.js";
import { EmptyState } from "@tuti/shared/components/EmptyState.jsx";
import { MetricCard } from "@tuti/shared/components/MetricCard.jsx";
import { PageTitle } from "@tuti/shared/components/PageTitle.jsx";
import { PanelHeader } from "@tuti/shared/components/PanelHeader.jsx";
import { StatusBadge } from "@tuti/shared/components/StatusBadge.jsx";
import { formatCurrency } from "@tuti/shared/utils/money.js";

const riskClass = { Low: "success", Medium: "warning", High: "danger" };

const NOTE_TYPE_LABELS = {
  note:        "Note",
  call:        "Call",
  email:       "Email",
  follow_up:   "Follow-up",
  complaint:   "Complaint",
  compliment:  "Compliment",
};

function CustomerProfile({ customerId, onClose }) {
  const qc = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState("note");
  const [noteError, setNoteError] = useState("");

  const { data: customer, isLoading } = useQuery({
    queryKey: ["crm-customer", customerId],
    queryFn:  () => crmApi.getCustomer(customerId),
    enabled:  Boolean(customerId),
  });

  const addNoteMutation = useMutation({
    mutationFn: (payload) => crmApi.addNote(customerId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-customer", customerId] });
      qc.invalidateQueries({ queryKey: ["crm-customers"] });
      setNoteText("");
      setNoteError("");
    },
    onError: (err) => setNoteError(err?.message || "Failed to save note."),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId) => crmApi.deleteNote(customerId, noteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-customer", customerId] });
    },
  });

  if (isLoading) return <div className="crm-profile-loading">Loading…</div>;
  if (!customer)  return null;

  function submitNote(e) {
    e.preventDefault();
    if (!noteText.trim()) { setNoteError("Note text is required."); return; }
    addNoteMutation.mutate({ text: noteText.trim(), type: noteType });
  }

  return (
    <aside className="crm-profile-panel">
      <div className="crm-profile-head">
        <div className="crm-profile-avatar">{customer.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}</div>
        <div>
          <strong>{customer.name}</strong>
          <span>{customer.segment} · {customer.city}</span>
        </div>
        <button className="icon-button" type="button" onClick={onClose} title="Close"><X size={16} /></button>
      </div>

      <div className="crm-profile-kpis">
        <div><strong>{customer.orders || 0}</strong><span>Orders</span></div>
        <div><strong>{formatCurrency(customer.lifetimeValue || 0)}</strong><span>LTV</span></div>
        <div><strong>{customer.loyaltyPoints || 0}</strong><span>Points</span></div>
        <div><strong className={`risk ${riskClass[customer.risk] || "success"}`}>{customer.risk || "Low"}</strong><span>Risk</span></div>
      </div>

      <div className="crm-profile-contact">
        <span><Mail size={13} /> {customer.email}</span>
        <span><Phone size={13} /> {customer.phone || "—"}</span>
        {customer.lastOrderAt && <span><CalendarClock size={13} /> Last order {customer.lastOrderAt}</span>}
      </div>

      {(customer.tags || []).length > 0 && (
        <div className="crm-profile-tags">
          {customer.tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
      )}

      {customer.notes && <p className="crm-profile-bio">{customer.notes}</p>}

      {/* Add note form */}
      <form className="crm-note-form" onSubmit={submitNote}>
        <div className="crm-note-form-head">
          <select value={noteType} onChange={(e) => setNoteType(e.target.value)}>
            {Object.entries(NOTE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <textarea
          value={noteText}
          onChange={(e) => { setNoteText(e.target.value); setNoteError(""); }}
          placeholder="Add a CRM note, call summary, or follow-up…"
          rows={3}
          maxLength={1000}
        />
        {noteError && <p className="crm-note-error">{noteError}</p>}
        <button
          className="secondary-action compact"
          type="submit"
          disabled={addNoteMutation.isPending || !noteText.trim()}
        >
          {addNoteMutation.isPending ? "Saving…" : "Save note"}
        </button>
      </form>

      {/* Interaction log */}
      <div className="crm-note-log">
        <strong className="crm-note-log-title">Interaction log</strong>
        {!(customer.crmNotes || []).length ? (
          <p className="crm-note-empty">No notes yet.</p>
        ) : (
          (customer.crmNotes || []).map((note) => (
            <div className="crm-note-item" key={note.id}>
              <div className="crm-note-item-head">
                <span className="crm-note-type-badge">{NOTE_TYPE_LABELS[note.type] || note.type}</span>
                <span className="crm-note-by">{note.by}</span>
                <span className="crm-note-at">{note.createdAt ? new Date(note.createdAt).toLocaleDateString() : ""}</span>
                <button
                  className="crm-note-delete"
                  type="button"
                  title="Delete note"
                  onClick={() => deleteNoteMutation.mutate(note.id)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <p>{note.text}</p>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

export function AdminCRM() {
  const qc = useQueryClient();
  const [query,       setQuery]       = useState("");
  const [segment,     setSegment]     = useState("");
  const [riskFilter,  setRiskFilter]  = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page,        setPage]        = useState(1);
  const [selectedId,  setSelectedId]  = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["crm-customers", query, segment, riskFilter, statusFilter, page],
    queryFn:  () => crmApi.listCustomers({ q: query, segment, risk: riskFilter, status: statusFilter, page, limit: 12 }),
    keepPreviousData: true,
  });

  const customers  = data?.customers  || [];
  const total      = data?.total      || 0;
  const totalPages = data?.pages      || 1;

  // Top-level summary stats from first page
  const vipCount    = customers.filter((c) => c.status === "VIP").length;
  const highRisk    = customers.filter((c) => c.risk === "High" || c.openTickets > 0).length;
  const totalLtv    = customers.reduce((s, c) => s + (c.lifetimeValue || 0), 0);
  const openTickets = customers.reduce((s, c) => s + (c.openTickets || 0), 0);

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => crmApi.updateCustomer(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-customers"] });
      if (selectedId) qc.invalidateQueries({ queryKey: ["crm-customer", selectedId] });
    },
  });

  return (
    <main className="workspace">
      <PageTitle
        kicker="CRM"
        title="Customer relationship management"
        description="Manage client profiles, interaction notes, risk, and segment from one place."
      />

      <section className="metric-grid">
        <MetricCard icon={Users}           label="Loaded clients" value={total}                          note="Matched by filter" />
        <MetricCard icon={Star}            label="VIP accounts"   value={vipCount}                       note="This page" />
        <MetricCard icon={CircleDollarSign} label="Lifetime value" value={formatCurrency(totalLtv)}      note="This page" />
        <MetricCard icon={Headphones}      label="Open tickets"   value={openTickets}                    note={highRisk > 0 ? `${highRisk} high-risk` : "All clear"} />
      </section>

      {/* Toolbar */}
      <section className="management-toolbar">
        <label className="management-search">
          <Search size={17} />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search name, email, phone, city…"
          />
        </label>
        <div className="segment-tabs">
          {["", "Low", "Medium", "High"].map((r) => (
            <button key={r || "all-risk"} type="button"
              className={riskFilter === r ? "filter-tab active" : "filter-tab"}
              onClick={() => { setRiskFilter(r); setPage(1); }}
            >
              {r === "" ? "All risk" : `${r} risk`}
            </button>
          ))}
          {["", "Active", "VIP", "Inactive", "Blocked"].map((s) => (
            <button key={s || "all-status"} type="button"
              className={statusFilter === s ? "filter-tab active" : "filter-tab"}
              onClick={() => { setStatusFilter(s); setPage(1); }}
            >
              {s === "" ? "All status" : s}
            </button>
          ))}
        </div>
      </section>

      <div className="crm-workspace">
        {/* Customer grid */}
        <section className="crm-grid-panel">
          {isLoading ? (
            <div className="app-status">Loading customers…</div>
          ) : customers.length === 0 ? (
            <EmptyState icon={Users} text="No customers match." />
          ) : (
            <div className="crm-customer-grid">
              {customers.map((c) => (
                <article
                  key={c.id}
                  className={`crm-customer-card${selectedId === c.id ? " crm-customer-card--active" : ""}`}
                  onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}
                >
                  <div className="crm-card-head">
                    <span className="crm-avatar">{c.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}</span>
                    <div className="crm-card-meta">
                      <strong>{c.name}</strong>
                      <span>{c.segment} · {c.city}</span>
                    </div>
                    <span className={`risk ${riskClass[c.risk] || "success"}`}>{c.risk || "Low"}</span>
                  </div>

                  <div className="crm-card-kpis">
                    <span><strong>{c.orders || 0}</strong> orders</span>
                    <span><strong>{formatCurrency(c.lifetimeValue || 0)}</strong></span>
                    <span><strong>{c.loyaltyPoints || 0}</strong> pts</span>
                  </div>

                  <div className="crm-card-contact">
                    <span><Mail size={12} /> {c.email}</span>
                    {c.phone && <span><Phone size={12} /> {c.phone}</span>}
                  </div>

                  <div className="crm-card-footer">
                    <StatusBadge status={c.status || "Active"} />
                    {(c.crmNotes || []).length > 0 && (
                      <span className="crm-note-count"><MessageSquare size={11} /> {c.crmNotes.length}</span>
                    )}
                    {c.openTickets > 0 && (
                      <span className="crm-ticket-flag"><AlertTriangle size={11} /> {c.openTickets}</span>
                    )}
                  </div>

                  {/* Inline risk/status controls */}
                  <div className="crm-card-controls" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={c.risk || "Low"}
                      onChange={(e) => updateMutation.mutate({ id: c.id, payload: { risk: e.target.value } })}
                      title="Set risk level"
                    >
                      <option value="Low">Low risk</option>
                      <option value="Medium">Medium risk</option>
                      <option value="High">High risk</option>
                    </select>
                    <select
                      value={c.status || "Active"}
                      onChange={(e) => updateMutation.mutate({ id: c.id, payload: { status: e.target.value } })}
                      title="Set status"
                    >
                      <option value="Active">Active</option>
                      <option value="VIP">VIP</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Blocked">Blocked</option>
                    </select>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="crm-pagination">
              <button className="ghost-action compact" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} type="button">
                ← Prev
              </button>
              <span>Page {page} of {totalPages}</span>
              <button className="ghost-action compact" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} type="button">
                Next →
              </button>
            </div>
          )}
        </section>

        {/* Profile panel */}
        {selectedId && (
          <CustomerProfile
            customerId={selectedId}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </main>
  );
}
