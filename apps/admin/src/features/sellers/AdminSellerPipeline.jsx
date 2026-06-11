import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  KeyRound,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { sellerApplicationsApi } from "@tuti/shared/api/client.js";
import { EmptyState } from "@tuti/shared/components/EmptyState.jsx";
import { MetricCard } from "@tuti/shared/components/MetricCard.jsx";
import { PageTitle } from "@tuti/shared/components/PageTitle.jsx";
import { PanelHeader } from "@tuti/shared/components/PanelHeader.jsx";
import { StatusBadge } from "@tuti/shared/components/StatusBadge.jsx";
import { formatCurrency } from "@tuti/shared/utils/money.js";

function getSellerAppUrl() {
  return import.meta.env?.VITE_SELLER_URL || "http://localhost:5174";
}

// ── Constants ────────────────────────────────────────────────────────
const STAGES = [
  "Submitted",
  "Contacted",
  "Documents Requested",
  "Terms Negotiation",
  "Agreement Sent",
  "Agreement Signed",
  "Approved for Onboarding",
  "Converted to Seller",
  "Rejected",
  "Paused",
];

const CONTRACT_STATUSES = [
  "Not Started", "Drafting", "Sent", "Signed", "Expired", "Cancelled",
];

const RISK_LEVELS = ["Low", "Medium", "High"];

const CATEGORIES = [
  { value: "perfume",  label: "Perfume" },
  { value: "cake",     label: "Cake" },
  { value: "dessert",  label: "Dessert" },
  { value: "gift_box", label: "Gift Box" },
  { value: "mixed",    label: "Mixed" },
  { value: "other",    label: "Other" },
];

const NOTE_TYPES = ["Note", "Call", "Email", "Follow-up", "Contract", "Document", "Risk"];

const CHECKLIST_LABELS = {
  businessProof:       "Business proof",
  ownerId:             "Owner ID",
  productSamples:      "Product samples",
  priceList:           "Price list",
  deliveryCoverage:    "Delivery coverage",
  codAgreement:        "COD agreement",
  returnRefundTerms:   "Return & refund terms",
  commissionAgreement: "Commission agreement",
  payoutTerms:         "Payout terms",
  contractSigned:      "Contract signed",
  adminApproval:       "Admin approval",
};

const CHECKLIST_KEYS = Object.keys(CHECKLIST_LABELS);

// ── Stage chip colour mapping ─────────────────────────────────────────
const STAGE_TONE = {
  "Submitted":               "sap-stage--neutral",
  "Contacted":               "sap-stage--blue",
  "Documents Requested":     "sap-stage--amber",
  "Terms Negotiation":       "sap-stage--amber",
  "Agreement Sent":          "sap-stage--blue",
  "Agreement Signed":        "sap-stage--green",
  "Approved for Onboarding": "sap-stage--green",
  "Converted to Seller":     "sap-stage--success",
  "Rejected":                "sap-stage--danger",
  "Paused":                  "sap-stage--muted",
};

const RISK_TONE = { Low: "success", Medium: "warning", High: "danger" };

// ── Helper: checklist progress ────────────────────────────────────────
function checklistProgress(checklist) {
  if (!checklist) return { done: 0, total: CHECKLIST_KEYS.length };
  const done = CHECKLIST_KEYS.filter((k) => checklist[k]?.completed).length;
  return { done, total: CHECKLIST_KEYS.length };
}

function conversionReady(app) {
  if (!app) return false;
  return (
    ["Agreement Signed", "Approved for Onboarding"].includes(app.applicationStage) &&
    !app.convertedAt &&
    Boolean(app.checklist?.contractSigned?.completed) &&
    Boolean(app.checklist?.adminApproval?.completed) &&
    Boolean(app.email)
  );
}

function conversionBlockers(app) {
  const blockers = [];
  if (!["Agreement Signed", "Approved for Onboarding"].includes(app.applicationStage)) {
    blockers.push(`Stage must be "Agreement Signed" or "Approved for Onboarding" (currently: ${app.applicationStage})`);
  }
  if (app.convertedAt) blockers.push("Already converted to seller");
  if (!app.checklist?.contractSigned?.completed) blockers.push("Checklist: Contract signed not completed");
  if (!app.checklist?.adminApproval?.completed) blockers.push("Checklist: Admin approval not completed");
  if (!app.email) blockers.push("Email address required for account creation");
  return blockers;
}

// ── Stage summary chip ────────────────────────────────────────────────
function StageSummaryChip({ label, count, active, onClick }) {
  return (
    <button
      type="button"
      className={`sap-summary-chip${active ? " sap-summary-chip--active" : ""}`}
      onClick={onClick}
    >
      <strong>{count}</strong>
      <span>{label}</span>
    </button>
  );
}

// ── Application card ──────────────────────────────────────────────────
function AppCard({ app, isSelected, onClick }) {
  const { done, total } = checklistProgress(app.checklist);
  const pct = Math.round((done / total) * 100);

  return (
    <article
      className={`sap-app-card${isSelected ? " sap-app-card--active" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <div className="sap-app-card-head">
        <div className="sap-app-avatar">
          {app.businessName.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <div className="sap-app-card-meta">
          <strong>{app.businessName}</strong>
          <span>{app.contactName} · {app.city}{app.area ? `, ${app.area}` : ""}</span>
        </div>
        <span className={`risk ${RISK_TONE[app.riskLevel] || "success"}`}>{app.riskLevel}</span>
      </div>

      <div className="sap-app-card-badges">
        <span className={`sap-stage-badge ${STAGE_TONE[app.applicationStage] || "sap-stage--neutral"}`}>
          {app.applicationStage}
        </span>
        <span className="sap-category-badge">{app.category}</span>
        {app.contractStatus !== "Not Started" && (
          <span className="sap-contract-badge">{app.contractStatus}</span>
        )}
      </div>

      <div className="sap-app-card-progress">
        <div className="sap-checklist-bar">
          <div className="sap-checklist-fill" style={{ width: `${pct}%` }} />
        </div>
        <span>{done}/{total} checklist</span>
      </div>

      <div className="sap-app-card-footer">
        {app.email && <span><Mail size={11} /> {app.email}</span>}
        {app.phone && <span><Phone size={11} /> {app.phone}</span>}
        {app.nextFollowUpAt && (
          <span><CalendarClock size={11} /> Follow-up {new Date(app.nextFollowUpAt).toLocaleDateString()}</span>
        )}
        {app.salesRepCode && <span>Rep: {app.salesRepCode}</span>}
      </div>
    </article>
  );
}

// ── Checklist section ─────────────────────────────────────────────────
function ChecklistSection({ app, onUpdate }) {
  const [expandedKey, setExpandedKey] = useState(null);
  const [noteText, setNoteText] = useState("");

  function toggle(key) {
    if (expandedKey === key) { setExpandedKey(null); setNoteText(""); return; }
    setExpandedKey(key);
    setNoteText(app.checklist?.[key]?.note || "");
  }

  function save(key, completed) {
    onUpdate({ key, completed, note: noteText });
    setExpandedKey(null);
    setNoteText("");
  }

  return (
    <div className="sap-checklist">
      {CHECKLIST_KEYS.map((key) => {
        const item   = app.checklist?.[key] || {};
        const isOpen = expandedKey === key;
        return (
          <div key={key} className={`sap-checklist-item${item.completed ? " sap-checklist-item--done" : ""}`}>
            <div className="sap-checklist-row" onClick={() => toggle(key)}>
              <span className="sap-checklist-icon">
                {item.completed ? <CheckCircle2 size={14} /> : <div className="sap-checklist-circle" />}
              </span>
              <span className="sap-checklist-label">{CHECKLIST_LABELS[key]}</span>
              {item.completedBy && <span className="sap-checklist-by">{item.completedBy}</span>}
              {item.completedAt && (
                <span className="sap-checklist-date">{new Date(item.completedAt).toLocaleDateString()}</span>
              )}
              <ChevronDown size={13} className={isOpen ? "sap-chevron-open" : ""} />
            </div>
            {isOpen && (
              <div className="sap-checklist-expand">
                <input
                  type="text"
                  placeholder="Note (optional)"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="sap-checklist-note-input"
                />
                <div className="sap-checklist-actions">
                  {!item.completed ? (
                    <button className="secondary-action compact" type="button" onClick={() => save(key, true)}>
                      <CheckCircle2 size={13} /> Mark complete
                    </button>
                  ) : (
                    <button className="ghost-action compact" type="button" onClick={() => save(key, false)}>
                      <XCircle size={13} /> Mark incomplete
                    </button>
                  )}
                  {noteText !== (app.checklist?.[key]?.note || "") && (
                    <button className="ghost-action compact" type="button" onClick={() => save(key, item.completed)}>
                      Save note
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Notes section ─────────────────────────────────────────────────────
function NotesSection({ app, onAddNote, onDeleteNote }) {
  const [text,    setText]    = useState("");
  const [type,    setType]    = useState("Note");
  const [error,   setError]   = useState("");

  function submit(e) {
    e.preventDefault();
    if (!text.trim()) { setError("Note text is required."); return; }
    onAddNote({ type, text: text.trim() });
    setText(""); setError("");
  }

  return (
    <div className="sap-notes">
      <form className="sap-note-form" onSubmit={submit}>
        <div className="sap-note-form-controls">
          <select value={type} onChange={(e) => setType(e.target.value)} className="sap-note-type-select">
            {NOTE_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setError(""); }}
            placeholder="Add a note, call summary, email, or follow-up…"
            rows={2}
            maxLength={2000}
          />
        </div>
        {error && <p className="sap-note-error">{error}</p>}
        <button className="secondary-action compact" type="submit" disabled={!text.trim()}>
          <Plus size={13} /> Add note
        </button>
      </form>

      <div className="sap-note-log">
        {!(app.notes || []).length ? (
          <p className="sap-note-empty">No notes yet.</p>
        ) : (
          (app.notes || []).map((note) => (
            <div className="sap-note-item" key={note.id}>
              <div className="sap-note-item-head">
                <span className="sap-note-type">{note.type}</span>
                <span className="sap-note-by">{note.createdBy}</span>
                <span className="sap-note-date">{note.createdAt ? new Date(note.createdAt).toLocaleDateString() : ""}</span>
                <button
                  className="sap-note-delete"
                  type="button"
                  onClick={() => onDeleteNote(note.id)}
                  title="Delete note"
                >
                  <Trash2 size={11} />
                </button>
              </div>
              <p className="sap-note-text">{note.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Conversion panel ──────────────────────────────────────────────────
function ConversionPanel({ app, onConvert, isPending, onViewInSellers }) {
  const [showResult, setShowResult] = useState(null);
  const ready    = conversionReady(app);
  const blockers = conversionBlockers(app);

  async function handleConvert() {
    try {
      const result = await onConvert();
      setShowResult(result);
    } catch {
      // error handled in parent
    }
  }

  if (app.convertedAt) {
    return (
      <div className="sap-conversion-panel sap-conversion-panel--done">
        <CheckCircle2 size={16} />
        <div className="sap-conversion-done-body">
          <strong>Converted to seller</strong>
          {app.email && <p>Email: <code>{app.email}</code></p>}
          <p>Shop ID: <code>{app.convertedShopId}</code></p>
          <p>Converted: {new Date(app.convertedAt).toLocaleDateString()}</p>
          <p className="sap-conversion-done-hint">
            Seller signs in at{" "}
            <code>{getSellerAppUrl()}</code>{" "}
            — not via the register form.
          </p>
          {onViewInSellers && (
            <button
              className="ghost-action compact sap-view-sellers-btn"
              type="button"
              onClick={onViewInSellers}
            >
              View in Seller Control Center →
            </button>
          )}
        </div>
      </div>
    );
  }

  if (showResult) {
    const sellerEmail = showResult.application?.email || "";
    return (
      <div className="sap-conversion-result">
        <div className="sap-conversion-result-head">
          <CheckCircle2 size={16} />
          <strong>Seller account created</strong>
        </div>

        <div className="sap-dispatch-instruction">
          Send these credentials to the seller. The seller should
          <strong> sign in</strong> at Seller Central — not register.
        </div>

        <div className="sap-credentials-to-send">
          {sellerEmail && (
            <div className="sap-credential-row">
              <span>Email</span>
              <code>{sellerEmail}</code>
            </div>
          )}
          <div className="sap-credential-row">
            <span>Login URL</span>
            <code>{getSellerAppUrl()}</code>
          </div>
        </div>

        <div className="sap-temp-password-block">
          <span className="sap-temp-password-label">
            <KeyRound size={13} /> Temporary password — copy now, it will not be shown again
          </span>
          <code className="sap-temp-password">{showResult.tempPassword}</code>
        </div>

        <div className="sap-conversion-details">
          <span>Shop ID: <code>{showResult.shopId}</code></span>
        </div>
      </div>
    );
  }

  return (
    <div className="sap-conversion-panel">
      <div className="sap-conversion-panel-head">
        <UserCheck size={15} />
        <strong>Convert to seller</strong>
      </div>
      {ready ? (
        <div className="sap-conversion-ready">
          <p>All required conditions are met. This will create a seller user account and shop.</p>
          <button
            className="primary-action compact"
            type="button"
            onClick={handleConvert}
            disabled={isPending}
          >
            <UserCheck size={13} />
            {isPending ? "Converting…" : "Convert to Seller"}
          </button>
        </div>
      ) : (
        <div className="sap-conversion-blockers">
          <p className="sap-conversion-blockers-label">Not ready — resolve the following:</p>
          <ul>
            {blockers.map((b, i) => (
              <li key={i}><AlertTriangle size={11} /> {b}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Application detail drawer ─────────────────────────────────────────
function AppDrawer({ appId, onClose, onViewInSellers }) {
  const qc = useQueryClient();

  const { data: app, isLoading } = useQuery({
    queryKey: ["seller-application", appId],
    queryFn:  () => sellerApplicationsApi.get(appId),
    enabled:  Boolean(appId),
  });

  const updateMutation = useMutation({
    mutationFn: (payload) => sellerApplicationsApi.update(appId, payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["seller-application", appId] }),
  });

  const checklistMutation = useMutation({
    mutationFn: (payload) => sellerApplicationsApi.updateChecklist(appId, payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["seller-application", appId] }),
  });

  const addNoteMutation = useMutation({
    mutationFn: (payload) => sellerApplicationsApi.addNote(appId, payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["seller-application", appId] }),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId) => sellerApplicationsApi.deleteNote(appId, noteId),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ["seller-application", appId] }),
  });

  const convertMutation = useMutation({
    mutationFn: () => sellerApplicationsApi.convertToSeller(appId),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ["seller-application", appId] });
      qc.invalidateQueries({ queryKey: ["seller-applications"] });
    },
  });

  if (isLoading) return (
    <div className="sap-drawer">
      <div className="sap-drawer-head">
        <strong>Loading…</strong>
        <button className="icon-button" type="button" onClick={onClose}><X size={16} /></button>
      </div>
    </div>
  );
  if (!app) return null;

  const { done, total } = checklistProgress(app.checklist);

  return (
    <div className="sap-drawer">
      {/* Drawer header */}
      <div className="sap-drawer-head">
        <div className="sap-drawer-head-info">
          <strong>{app.businessName}</strong>
          <span>{app.contactName} · {app.city}</span>
        </div>
        <button className="icon-button" type="button" onClick={onClose} title="Close"><X size={16} /></button>
      </div>

      <div className="sap-drawer-body">
        {/* Contact info */}
        <section className="sap-drawer-section">
          <span className="sap-section-label">Contact</span>
          <div className="sap-contact-grid">
            {app.email    && <span><Mail size={12} /> {app.email}</span>}
            {app.phone    && <span><Phone size={12} /> {app.phone}</span>}
            {app.whatsapp && app.whatsapp !== app.phone && <span><Phone size={12} /> WA: {app.whatsapp}</span>}
            {app.instagram && <span>IG: {app.instagram}</span>}
            {app.website   && <span>Web: {app.website}</span>}
            <span>City: {app.city}{app.area ? `, ${app.area}` : ""}</span>
            <span>Category: {app.category}</span>
            {app.expectedProductCount > 0 && <span>Products: ~{app.expectedProductCount}</span>}
          </div>
        </section>

        {/* Pipeline controls */}
        <section className="sap-drawer-section">
          <span className="sap-section-label">Pipeline</span>
          <div className="sap-pipeline-controls">
            <label className="sap-control-field">
              <span>Stage</span>
              <select
                value={app.applicationStage}
                onChange={(e) => updateMutation.mutate({ applicationStage: e.target.value })}
              >
                {STAGES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="sap-control-field">
              <span>Contract</span>
              <select
                value={app.contractStatus}
                onChange={(e) => updateMutation.mutate({ contractStatus: e.target.value })}
              >
                {CONTRACT_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="sap-control-field">
              <span>Risk</span>
              <select
                value={app.riskLevel}
                onChange={(e) => updateMutation.mutate({ riskLevel: e.target.value })}
              >
                {RISK_LEVELS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
            <label className="sap-control-field">
              <span>Assigned to</span>
              <input
                defaultValue={app.assignedTo || ""}
                onBlur={(e) => { if (e.target.value !== (app.assignedTo || "")) updateMutation.mutate({ assignedTo: e.target.value }); }}
                placeholder="Name or email"
              />
            </label>
          </div>
        </section>

        {/* Commercial terms */}
        <section className="sap-drawer-section">
          <span className="sap-section-label">Commercial terms</span>
          <div className="sap-terms-grid">
            {app.deliveryMethod       && <div><strong>Delivery</strong><span>{app.deliveryMethod.replace(/_/g, " ")}</span></div>}
            {app.codHandling          && <div><strong>COD handling</strong><span>{app.codHandling}</span></div>}
            {app.commissionPlan       && <div><strong>Commission plan</strong><span>{app.commissionPlan}</span></div>}
            {app.proposedCommissionRate != null && <div><strong>Commission rate</strong><span>{app.proposedCommissionRate}%</span></div>}
            {app.payoutTerms          && <div><strong>Payout terms</strong><span>{app.payoutTerms}</span></div>}
            {app.salesRepCode         && <div><strong>Sales rep</strong><span>{app.salesRepCode}</span></div>}
          </div>
        </section>

        {/* Checklist */}
        <section className="sap-drawer-section">
          <span className="sap-section-label">Checklist <em>{done}/{total}</em></span>
          <ChecklistSection
            app={app}
            onUpdate={(payload) => checklistMutation.mutate(payload)}
          />
        </section>

        {/* Documents */}
        <section className="sap-drawer-section">
          <span className="sap-section-label">Documents</span>
          {!(app.documents || []).length ? (
            <p className="sap-empty-sub">No documents yet. Document upload will be available in a future phase.</p>
          ) : (
            <div className="sap-docs-list">
              {app.documents.map((doc) => (
                <div className="sap-doc-row" key={doc.id}>
                  <FileText size={13} />
                  <span>{doc.name || doc.type}</span>
                  <span className={`sap-doc-status sap-doc-status--${doc.status?.toLowerCase()}`}>{doc.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Conversion */}
        <section className="sap-drawer-section">
          <span className="sap-section-label">Conversion</span>
          <ConversionPanel
            app={app}
            onConvert={async () => {
              const result = await convertMutation.mutateAsync();
              return result;
            }}
            isPending={convertMutation.isPending}
            onViewInSellers={onViewInSellers}
          />
          {convertMutation.isError && (
            <p className="sap-error-banner">
              <AlertTriangle size={13} /> {convertMutation.error?.message || "Conversion failed."}
            </p>
          )}
        </section>

        {/* Notes */}
        <section className="sap-drawer-section">
          <span className="sap-section-label">Notes & interactions</span>
          <NotesSection
            app={app}
            onAddNote={(payload) => addNoteMutation.mutate(payload)}
            onDeleteNote={(noteId) => deleteNoteMutation.mutate(noteId)}
          />
        </section>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────
export function AdminSellerPipeline({ onViewInSellers = null }) {
  const [query,          setQuery]          = useState("");
  const [stageFilter,    setStageFilter]    = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [riskFilter,     setRiskFilter]     = useState("");
  const [page,           setPage]           = useState(1);
  const [selectedId,     setSelectedId]     = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["seller-applications", query, stageFilter, categoryFilter, riskFilter, page],
    queryFn:  () => sellerApplicationsApi.list({
      q:        query,
      stage:    stageFilter,
      category: categoryFilter,
      risk:     riskFilter,
      page,
      limit: 24,
    }),
    keepPreviousData: true,
  });

  const applications = data?.applications || [];
  const total        = data?.total        || 0;
  const totalPages   = data?.pages        || 1;

  // Stage counts from current full result for summary chips
  const stageCounts = useMemo(() => {
    const counts = {};
    STAGES.forEach((s) => { counts[s] = 0; });
    applications.forEach((a) => { if (counts[a.applicationStage] !== undefined) counts[a.applicationStage]++; });
    return counts;
  }, [applications]);

  // Key pipeline metrics
  const active    = applications.filter((a) => !["Converted to Seller", "Rejected", "Paused"].includes(a.applicationStage)).length;
  const agreeSent = applications.filter((a) => a.applicationStage === "Agreement Sent").length;
  const needsAction = applications.filter((a) =>
    a.applicationStage !== "Converted to Seller" &&
    a.applicationStage !== "Rejected" &&
    a.applicationStage !== "Paused" &&
    a.riskLevel === "High"
  ).length;

  return (
    <main className="workspace">
      <PageTitle
        kicker="Vendor pipeline"
        title="Seller applications"
        description="Manage pre-seller applications, agreements, and conversions. Separate from the live Seller Control Center."
      />

      {/* KPI strip */}
      <section className="metric-grid">
        <MetricCard icon={Users}          label="Total applications" value={total}       note="All time" />
        <MetricCard icon={ClipboardCheck} label="Active pipeline"    value={active}      note="Not closed/converted" />
        <MetricCard icon={FileText}       label="Agreement sent"     value={agreeSent}   note="Awaiting signature" />
        <MetricCard icon={AlertTriangle}  label="High risk"          value={needsAction} note="Needs attention" />
      </section>

      {/* Stage summary chips */}
      <div className="sap-summary-strip">
        <StageSummaryChip
          label="All"
          count={applications.length}
          active={stageFilter === ""}
          onClick={() => { setStageFilter(""); setPage(1); }}
        />
        {STAGES.map((s) => (
          <StageSummaryChip
            key={s}
            label={s}
            count={stageCounts[s] || 0}
            active={stageFilter === s}
            onClick={() => { setStageFilter(stageFilter === s ? "" : s); setPage(1); }}
          />
        ))}
      </div>

      {/* Toolbar */}
      <section className="management-toolbar">
        <label className="management-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search business, contact, email, phone…"
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
          {CATEGORIES.map((c) => (
            <button key={c.value} type="button"
              className={categoryFilter === c.value ? "filter-tab active" : "filter-tab"}
              onClick={() => { setCategoryFilter(categoryFilter === c.value ? "" : c.value); setPage(1); }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      {/* Main split: list + drawer */}
      <div className={`sap-workspace${selectedId ? " sap-workspace--split" : ""}`}>
        {/* Application list */}
        <div className="sap-app-list">
          {isLoading ? (
            <div className="app-status">Loading applications…</div>
          ) : applications.length === 0 ? (
            <EmptyState icon={Building2} text="No applications match your filters." />
          ) : (
            <>
              <div className="sap-app-grid">
                {applications.map((app) => (
                  <AppCard
                    key={app.id}
                    app={app}
                    isSelected={selectedId === app.id}
                    onClick={() => setSelectedId(selectedId === app.id ? null : app.id)}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="sap-pagination">
                  <button
                    className="ghost-action compact"
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    ← Prev
                  </button>
                  <span>Page {page} of {totalPages} · {total} total</span>
                  <button
                    className="ghost-action compact"
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail drawer */}
        {selectedId && (
          <AppDrawer
            appId={selectedId}
            onClose={() => setSelectedId(null)}
            onViewInSellers={onViewInSellers}
          />
        )}
      </div>

      {/* Distinction note */}
      <p className="sap-distinction-note">
        <ShieldCheck size={13} />
        Seller Pipeline manages pre-seller agreements and applications only.
        Approved sellers appear in the <strong>Sellers</strong> section of the admin console.
      </p>
    </main>
  );
}
