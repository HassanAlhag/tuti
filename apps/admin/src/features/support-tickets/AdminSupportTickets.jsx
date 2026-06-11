import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Clock,
  MessageSquare,
  Paperclip,
  Search,
  ShieldCheck,
  Ticket,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { supportTicketsApi, usersApi } from "@tuti/shared/api/client.js";
import { EmptyState } from "@tuti/shared/components/EmptyState.jsx";
import { MetricCard } from "@tuti/shared/components/MetricCard.jsx";
import { PageTitle } from "@tuti/shared/components/PageTitle.jsx";
import { PanelHeader } from "@tuti/shared/components/PanelHeader.jsx";

const STATUS_OPTIONS = [
  "Open",
  "In Progress",
  "Waiting for Customer",
  "Waiting for Seller",
  "Waiting for Driver",
  "Resolved",
  "Closed",
];

const PRIORITY_OPTIONS = ["all", "low", "normal", "high", "urgent"];
const ROLE_OPTIONS = ["all", "customer", "seller", "driver", "admin", "support"];
const ASSIGNMENT_OPTIONS = ["all", "assigned", "unassigned"];
const CONVERSION_ISSUE_OPTIONS = [
  { value: "delivery_issue", label: "Delivery issue" },
  { value: "payment_issue", label: "Payment issue" },
  { value: "refund_issue", label: "Refund issue" },
  { value: "order_issue", label: "Order issue" },
  { value: "other", label: "Other" },
];

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function normalize(value) {
  return String(value || "").toLowerCase().trim();
}

function getTicketFromQuery() {
  return new URLSearchParams(window.location.search).get("ticket") || "";
}

function ticketTone(status) {
  switch (status) {
    case "Open":
      return "warning";
    case "In Progress":
      return "brand";
    case "Waiting for Customer":
    case "Waiting for Seller":
    case "Waiting for Driver":
      return "amber";
    case "Resolved":
      return "success";
    case "Closed":
      return "muted";
    default:
      return "brand";
  }
}

function priorityTone(priority) {
  if (priority === "urgent" || priority === "high") return "danger";
  if (priority === "normal") return "brand";
  return "muted";
}

function requesterLabel(ticket) {
  const name = ticket.requesterName || "Unknown requester";
  const email = ticket.requesterEmail || "No email";
  return `${name} · ${email}`;
}

function contextLabel(ticket) {
  if (ticket.orderId) return `Order ${ticket.orderId}`;
  if (ticket.shopId && ticket.driverId) return `${ticket.shopId} · ${ticket.driverId}`;
  if (ticket.shopId) return ticket.shopId;
  if (ticket.driverId) return ticket.driverId;
  return "No linked context";
}

function TicketStatusPill({ status }) {
  const tone = ticketTone(status);
  return <span className={`ticket-admin-pill ticket-admin-pill--${tone}`}>{status}</span>;
}

function TicketPriorityPill({ priority }) {
  const tone = priorityTone(priority);
  return <span className={`ticket-admin-pill ticket-admin-pill--${tone}`}>{priority}</span>;
}

function SupportTicketDrawer({ ticket, users, onClose, onStatusSave, onAssign, onAddNote, onConvert, onFetch, statusSaving, assignSaving, noteSaving, convertSaving, statusError, assignError, noteError, convertError }) {
  const [statusDraft, setStatusDraft] = useState(ticket?.status || "Open");
  const [assigneeDraft, setAssigneeDraft] = useState(ticket?.assignedToUserId || "");
  const [noteDraft, setNoteDraft] = useState("");
  const [issueTypeDraft, setIssueTypeDraft] = useState("delivery_issue");
  const [conversionNoteDraft, setConversionNoteDraft] = useState("");
  const [priorityEscalationDraft, setPriorityEscalationDraft] = useState(false);
  const [overrideClosedDraft, setOverrideClosedDraft] = useState(false);

  useEffect(() => {
    setStatusDraft(ticket?.status || "Open");
    setAssigneeDraft(ticket?.assignedToUserId || "");
    setNoteDraft("");
    setIssueTypeDraft(ticket?.convertedIssueType || "delivery_issue");
    setConversionNoteDraft(ticket?.convertedNote || "");
    setPriorityEscalationDraft(false);
    setOverrideClosedDraft(false);
  }, [ticket?.id, ticket?.status, ticket?.assignedToUserId]);

  if (!ticket) return null;

  const assignees = users.filter((user) => ["admin", "support"].includes(user.role));
  const canConvert = Boolean(ticket.orderId) && !ticket.convertedAt && !ticket.convertedOrderId && !ticket.convertedDisputeRef;
  const conversionBlocked = !ticket.orderId ? "Link an order before converting this ticket." : "";

  return (
    <aside className="ticket-admin-drawer sap-drawer">
      <div className="sap-drawer-head">
        <div className="sap-drawer-head-info">
          <strong>{ticket.ticketNumber}</strong>
          <span>{ticket.subject}</span>
        </div>
        <button className="icon-button" type="button" onClick={onClose} title="Close ticket detail">
          <X size={16} />
        </button>
      </div>

      <div className="sap-drawer-body">
        <section className="sap-drawer-section">
          <span className="sap-section-label">
            <Ticket size={12} />
            Ticket overview
          </span>
          <div className="ticket-admin-detail-grid">
            <div>
              <strong>Requester</strong>
              <p>{requesterLabel(ticket)}</p>
              <small>{ticket.requesterRole || "customer"} · {ticket.requesterUserId}</small>
            </div>
            <div>
              <strong>Context</strong>
              <p>{contextLabel(ticket)}</p>
              <small>{ticket.category || "uncategorized"}</small>
            </div>
            <div>
              <strong>Priority</strong>
              <p><TicketPriorityPill priority={ticket.priority || "normal"} /></p>
              <small>Created {formatDateTime(ticket.createdAt)}</small>
            </div>
            <div>
              <strong>Status</strong>
              <p><TicketStatusPill status={ticket.status || "Open"} /></p>
              <small>Updated {formatDateTime(ticket.updatedAt)}</small>
            </div>
          </div>
          <div className="ticket-admin-description">
            <strong>Description</strong>
            <p>{ticket.description}</p>
          </div>
        </section>

        <section className="sap-drawer-section">
          <span className="sap-section-label">
            <MessageSquare size={12} />
            Conversation
          </span>
          {Array.isArray(ticket.messages) && ticket.messages.length > 0 ? (
            <div className="ticket-admin-thread">
              {ticket.messages.map((message) => (
                <article className="ticket-admin-message" key={message.id}>
                  <div className="ticket-admin-message-head">
                    <strong>{message.by || "System"}</strong>
                    <span>{message.role || "system"} · {formatDateTime(message.createdAt)}</span>
                  </div>
                  <p>{message.body}</p>
                  {(message.attachments || []).length > 0 ? (
                    <div className="ticket-admin-attachments">
                      {message.attachments.map((attachment, index) => (
                        <span key={`${message.id}-att-${index}`} className="ticket-admin-attachment">
                          <Paperclip size={12} />
                          {typeof attachment === "string" ? attachment : attachment?.name || "Attachment"}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState icon={MessageSquare} text="No messages yet." />
          )}
        </section>

        <section className="sap-drawer-section">
          <span className="sap-section-label">
            <Users size={12} />
            Assignment &amp; status
          </span>
          <div className="ticket-admin-controls">
            <label className="ticket-admin-field">
              <span>Status</span>
              <select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)}>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
            <button className="secondary-action compact" type="button" disabled={statusSaving} onClick={() => onStatusSave(ticket.id, statusDraft)}>
              {statusSaving ? "Saving..." : "Update status"}
            </button>
            <label className="ticket-admin-field">
              <span>Assign to admin/support user</span>
              <select value={assigneeDraft} onChange={(event) => setAssigneeDraft(event.target.value)}>
                <option value="">Unassigned</option>
                {assignees.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} · {user.role}
                  </option>
                ))}
              </select>
            </label>
            <button className="secondary-action compact" type="button" disabled={assignSaving} onClick={() => onAssign(ticket.id, assigneeDraft)}>
              {assignSaving ? "Assigning..." : "Save assignment"}
            </button>
            {statusError ? <small className="ticket-admin-error">{statusError}</small> : null}
            {assignError ? <small className="ticket-admin-error">{assignError}</small> : null}
          </div>
        </section>

        <section className="sap-drawer-section">
          <span className="sap-section-label">
            <ShieldCheck size={12} />
            Internal notes
            <em>Visible to admin/support only</em>
          </span>
          {Array.isArray(ticket.internalNotes) && ticket.internalNotes.length > 0 ? (
            <div className="ticket-admin-thread">
              {ticket.internalNotes.map((note) => (
                <article className="ticket-admin-message ticket-admin-message--note" key={note.id}>
                  <div className="ticket-admin-message-head">
                    <strong>{note.by || "System"}</strong>
                    <span>{note.role || "system"} · {formatDateTime(note.createdAt)}</span>
                  </div>
                  <p>{note.note}</p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState icon={ShieldCheck} text="No internal notes yet." />
          )}
          <div className="ticket-admin-controls">
            <label className="ticket-admin-field ticket-admin-field--wide">
              <span>Add internal note</span>
              <textarea
                rows={3}
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder="Visible to admin/support only"
              />
            </label>
            <button
              className="secondary-action compact"
              type="button"
              disabled={noteSaving || !noteDraft.trim()}
              onClick={() => onAddNote(ticket.id, noteDraft)}
            >
              {noteSaving ? "Saving..." : "Add internal note"}
            </button>
            {noteError ? <small className="ticket-admin-error">{noteError}</small> : null}
          </div>
        </section>

        <section className="sap-drawer-section">
          <span className="sap-section-label">
            <AlertTriangle size={12} />
            Convert to dispute
          </span>
          {ticket.convertedAt ? (
            <div className="support-conversion-state">
              <strong>Converted to dispute case</strong>
              <p>This support ticket opened the formal order-linked dispute case for order {ticket.convertedOrderId || ticket.orderId}.</p>
              <small>Converted {formatDateTime(ticket.convertedAt)}{ticket.convertedBy ? ` · by ${ticket.convertedBy}` : ""}</small>
              <button
                className="secondary-action compact"
                type="button"
                onClick={() => {
                  const orderId = ticket.convertedOrderId || ticket.orderId;
                  if (!orderId) return;
                  window.history.pushState(null, "", `/admin/support?order=${encodeURIComponent(orderId)}`);
                  window.dispatchEvent(new PopStateEvent("popstate"));
                }}
              >
                Open dispute case
              </button>
            </div>
          ) : (
            <div className="ticket-admin-controls">
              <p className="support-conversion-warning">
                This will open a formal order-linked dispute. It will not issue a refund or change COD/order status automatically.
              </p>
              <label className="ticket-admin-field">
                <span>Issue type / dispute reason</span>
                <select value={issueTypeDraft} onChange={(event) => setIssueTypeDraft(event.target.value)} disabled={!canConvert && !ticket.orderId}>
                  {CONVERSION_ISSUE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="ticket-admin-field ticket-admin-field--wide">
                <span>Admin note</span>
                <textarea
                  rows={3}
                  value={conversionNoteDraft}
                  onChange={(event) => setConversionNoteDraft(event.target.value)}
                  placeholder="Optional internal note for the dispute case"
                />
              </label>
              <label className="ticket-admin-toggle">
                <input
                  type="checkbox"
                  checked={priorityEscalationDraft}
                  onChange={(event) => setPriorityEscalationDraft(event.target.checked)}
                />
                <span>Escalate to urgent priority</span>
              </label>
              <label className="ticket-admin-toggle">
                <input
                  type="checkbox"
                  checked={overrideClosedDraft}
                  onChange={(event) => setOverrideClosedDraft(event.target.checked)}
                />
                <span>Override closed/resolved ticket</span>
              </label>
              <button
                className="primary-action compact"
                type="button"
                disabled={convertSaving || !canConvert}
                onClick={() => onConvert(ticket.id, {
                  issueType: issueTypeDraft,
                  adminNote: conversionNoteDraft,
                  priorityEscalation: priorityEscalationDraft,
                  overrideClosed: overrideClosedDraft,
                })}
              >
                {convertSaving ? "Converting..." : "Convert to dispute"}
              </button>
              {conversionBlocked ? <small className="ticket-admin-error">{conversionBlocked}</small> : null}
              {convertError ? <small className="ticket-admin-error">{convertError}</small> : null}
            </div>
          )}
        </section>

        <section className="sap-drawer-section">
          <span className="sap-section-label">
            <Clock size={12} />
            Timestamps
          </span>
          <div className="ticket-admin-meta-grid">
            <span><strong>Created</strong>{formatDateTime(ticket.createdAt)}</span>
            <span><strong>Updated</strong>{formatDateTime(ticket.updatedAt)}</span>
            <span><strong>Last message</strong>{formatDateTime(ticket.lastMessageAt)}</span>
            <span><strong>Last status</strong>{formatDateTime(ticket.lastStatusAt)}</span>
          </div>
        </section>
      </div>
    </aside>
  );
}

export function AdminSupportTickets() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [category, setCategory] = useState("");
  const [requesterRole, setRequesterRole] = useState("all");
  const [assignment, setAssignment] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [queryTicketId, setQueryTicketId] = useState(getTicketFromQuery);
  const hasAutoSelectedRef = useRef(false);

  const ticketsQuery = useQuery({
    queryKey: ["admin-support-tickets", status, priority, category],
    queryFn: () => supportTicketsApi.adminList({
      status: status === "all" ? "" : status,
      priority: priority === "all" ? "" : priority,
      category,
      limit: 100,
    }),
    keepPreviousData: true,
  });

  const usersQuery = useQuery({
    queryKey: ["admin-support-ticket-users"],
    queryFn: () => usersApi.list({ limit: 100 }),
  });

  const selectedTicketQuery = useQuery({
    queryKey: ["admin-support-ticket-detail", selectedId],
    queryFn: () => supportTicketsApi.adminGet(selectedId),
    enabled: Boolean(selectedId),
  });

  const tickets = ticketsQuery.data?.tickets || [];
  const users = usersQuery.data?.users || [];

  const statusCounts = useMemo(() => {
    const counts = STATUS_OPTIONS.reduce((acc, next) => ({ ...acc, [next]: 0 }), {});
    for (const ticket of tickets) counts[ticket.status] = (counts[ticket.status] || 0) + 1;
    return counts;
  }, [tickets]);

  const assignedCount = tickets.filter((ticket) => Boolean(ticket.assignedToUserId)).length;
  const unassignedCount = tickets.length - assignedCount;
  const openCount = tickets.filter((ticket) => ticket.status === "Open").length;
  const highPriorityCount = tickets.filter((ticket) => ["high", "urgent"].includes(ticket.priority)).length;

  const filteredTickets = useMemo(() => {
    const q = normalize(search);
    return tickets.filter((ticket) => {
      const requesterLabelValue = [ticket.requesterName, ticket.requesterEmail].join(" ").toLowerCase();
      const matchesSearch = !q || [
        ticket.ticketNumber,
        ticket.subject,
        ticket.description,
        ticket.category,
        ticket.requesterRole,
        requesterLabelValue,
        ticket.orderId,
        ticket.shopId,
        ticket.driverId,
        ticket.assignedToUserName,
        ticket.assignedToUserEmail,
      ].some((value) => normalize(value).includes(q));
      const matchesRequesterRole = requesterRole === "all" || ticket.requesterRole === requesterRole;
      const matchesAssignment = assignment === "all"
        || (assignment === "assigned" && Boolean(ticket.assignedToUserId))
        || (assignment === "unassigned" && !ticket.assignedToUserId);
      return matchesSearch && matchesRequesterRole && matchesAssignment;
    });
  }, [assignment, requesterRole, search, tickets]);

  useEffect(() => {
    function syncTicketFromQuery() {
      setQueryTicketId(getTicketFromQuery());
    }

    syncTicketFromQuery();
    window.addEventListener("popstate", syncTicketFromQuery);
    return () => window.removeEventListener("popstate", syncTicketFromQuery);
  }, []);

  useEffect(() => {
    if (!filteredTickets.length) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }

    if (queryTicketId) {
      if (selectedId !== queryTicketId) setSelectedId(queryTicketId);
      return;
    }

    const selectedExists = selectedId
      ? filteredTickets.some((ticket) => ticket.id === selectedId || ticket.ticketNumber === selectedId)
      : false;

    if (!hasAutoSelectedRef.current) {
      hasAutoSelectedRef.current = true;
      if (!selectedExists) setSelectedId(filteredTickets[0].id);
      return;
    }

    if (selectedId === null) return;
    if (!selectedExists) setSelectedId(filteredTickets[0].id);
  }, [filteredTickets, queryTicketId, selectedId]);

  const selectedTicket = selectedTicketQuery.data
    || filteredTickets.find((ticket) => ticket.id === selectedId || ticket.ticketNumber === selectedId)
    || null;
  const adminUsers = users.filter((user) => ["admin", "support"].includes(user.role));

  const statusMutation = useMutation({
    mutationFn: ({ ticketId, nextStatus }) => supportTicketsApi.updateStatus(ticketId, nextStatus),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      qc.invalidateQueries({ queryKey: ["admin-support-ticket-detail"] });
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ ticketId, assignedToUserId }) => supportTicketsApi.assign(ticketId, {
      assignedToUserId: assignedToUserId || null,
      assignedToRole: assignedToUserId ? (adminUsers.find((user) => user.id === assignedToUserId)?.role || "support") : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      qc.invalidateQueries({ queryKey: ["admin-support-ticket-detail"] });
    },
  });

  const noteMutation = useMutation({
    mutationFn: ({ ticketId, note }) => supportTicketsApi.addInternalNote(ticketId, { note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      qc.invalidateQueries({ queryKey: ["admin-support-ticket-detail"] });
    },
  });

  const convertMutation = useMutation({
    mutationFn: ({ ticketId, payload }) => supportTicketsApi.convertToDispute(ticketId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      qc.invalidateQueries({ queryKey: ["admin-support-ticket-detail"] });
    },
  });

  function clearTicketQuery() {
    const params = new URLSearchParams(window.location.search);
    params.delete("ticket");
    const query = params.toString();
    const nextPath = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash || ""}`;
    window.history.replaceState(null, "", nextPath);
    setQueryTicketId("");
  }

  return (
    <main className="workspace">
      <PageTitle
        kicker="Support"
        title="Support Tickets"
        description="General help requests, operational issues, and customer care cases. Order-linked disputes remain in the Disputes section."
      />

      <section className="metric-grid">
        <MetricCard icon={Ticket} label="Tickets" value={tickets.length} note="Loaded from support module" />
        <MetricCard icon={Clock} label="Open" value={openCount} note="Needs action" />
        <MetricCard icon={UserCheck} label="Assigned" value={assignedCount} note={`${unassignedCount} unassigned`} />
        <MetricCard icon={AlertTriangle} label="High priority" value={highPriorityCount} note="Triage first" />
      </section>

      <section className="ticket-admin-toolbar">
        <label className="management-search ticket-admin-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search ticket reference, subject, requester, order, shop, or driver"
          />
        </label>
        <label className="ticket-admin-filter">
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="ticket-admin-filter">
          <span>Priority</span>
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            {PRIORITY_OPTIONS.map((item) => <option key={item} value={item}>{item === "all" ? "All priorities" : item}</option>)}
          </select>
        </label>
        <label className="ticket-admin-filter">
          <span>Category</span>
          <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="order_help, delivery_help…" />
        </label>
        <label className="ticket-admin-filter">
          <span>Requester role</span>
          <select value={requesterRole} onChange={(event) => setRequesterRole(event.target.value)}>
            {ROLE_OPTIONS.map((item) => <option key={item} value={item}>{item === "all" ? "All roles" : item}</option>)}
          </select>
        </label>
        <label className="ticket-admin-filter">
          <span>Assignment</span>
          <select value={assignment} onChange={(event) => setAssignment(event.target.value)}>
            {ASSIGNMENT_OPTIONS.map((item) => <option key={item} value={item}>{item === "all" ? "All tickets" : item}</option>)}
          </select>
        </label>
      </section>

      <section className="ticket-admin-status-strip">
        {STATUS_OPTIONS.map((item) => (
          <button key={item} type="button" className="ticket-admin-status-chip" onClick={() => setStatus(item)}>
            <strong>{statusCounts[item] || 0}</strong>
            <span>{item}</span>
          </button>
        ))}
      </section>

      {ticketsQuery.isLoading ? (
        <section className="panel"><EmptyState icon={Ticket} text="Loading support tickets…" /></section>
      ) : ticketsQuery.isError ? (
        <section className="panel"><EmptyState icon={Ticket} text="Failed to load support tickets." /></section>
      ) : filteredTickets.length === 0 ? (
        <section className="panel">
          <EmptyState icon={Ticket} text="No support tickets match the current filters." />
        </section>
      ) : (
        <section className="ticket-admin-workspace">
          <section className="panel ticket-admin-list-panel">
            <PanelHeader icon={Ticket} title="Support ticket queue" action={`${filteredTickets.length} shown`} />
            <div className="ticket-admin-list">
              {filteredTickets.map((ticket) => {
                const selected = ticket.id === selectedId || ticket.ticketNumber === selectedId;
                return (
                  <article
                    key={ticket.id}
                    className={selected ? "ticket-admin-row ticket-admin-row--selected" : "ticket-admin-row"}
                    onClick={() => setSelectedId(ticket.id)}
                  >
                    <div className="ticket-admin-row-head">
                      <strong>{ticket.ticketNumber}</strong>
                      <TicketStatusPill status={ticket.status || "Open"} />
                    </div>
                    <p className="ticket-admin-subject">{ticket.subject}</p>
                    <div className="ticket-admin-row-meta">
                      <span>{ticket.requesterName || "Unknown requester"} · {ticket.requesterRole}</span>
                      <span>{ticket.requesterEmail || "No email"}</span>
                      <span>Category: {ticket.category || "uncategorized"}</span>
                      <span>Priority: <TicketPriorityPill priority={ticket.priority || "normal"} /></span>
                      <span>{ticket.assignedToUserName || "Unassigned"}</span>
                      <span>{contextLabel(ticket)}</span>
                      <span>Updated {formatDateTime(ticket.updatedAt)}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <SupportTicketDrawer
            ticket={selectedTicket}
            users={adminUsers}
            onClose={() => {
              setSelectedId(null);
              clearTicketQuery();
            }}
            onStatusSave={(ticketId, nextStatus) => statusMutation.mutate({ ticketId, nextStatus })}
            onAssign={(ticketId, assignedToUserId) => assignMutation.mutate({ ticketId, assignedToUserId })}
            onAddNote={(ticketId, note) => noteMutation.mutate({ ticketId, note })}
            onConvert={(ticketId, payload) => convertMutation.mutate({ ticketId, payload })}
            onFetch={() => qc.invalidateQueries({ queryKey: ["admin-support-tickets"] })}
            statusSaving={statusMutation.isPending}
            assignSaving={assignMutation.isPending}
            noteSaving={noteMutation.isPending}
            convertSaving={convertMutation.isPending}
            statusError={statusMutation.isError ? statusMutation.error?.message || "Failed to update status." : ""}
            assignError={assignMutation.isError ? assignMutation.error?.message || "Failed to assign ticket." : ""}
            noteError={noteMutation.isError ? noteMutation.error?.message || "Failed to add internal note." : ""}
            convertError={convertMutation.isError ? convertMutation.error?.message || "Failed to convert ticket." : ""}
          />
        </section>
      )}
    </main>
  );
}
