import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Clock,
  HelpCircle,
  MessageSquare,
  PackageCheck,
  Search,
  ShieldCheck,
  Ticket,
  ArrowRight,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmptyState } from "@tuti/shared/components/EmptyState.jsx";
import { MetricCard } from "@tuti/shared/components/MetricCard.jsx";
import { PageTitle } from "@tuti/shared/components/PageTitle.jsx";
import { PanelHeader } from "@tuti/shared/components/PanelHeader.jsx";
import { ordersApi, supportTicketsApi } from "@tuti/shared/api/client.js";
import { useAuthStore } from "@tuti/shared/store/authStore.js";

const STATUS_OPTIONS = [
  "all",
  "Open",
  "In Progress",
  "Waiting for Customer",
  "Waiting for Seller",
  "Waiting for Driver",
  "Resolved",
  "Closed",
];

const PRIORITY_OPTIONS = ["all", "low", "normal", "high", "urgent"];
const CATEGORY_OPTIONS = [
  { value: "all", label: "All categories" },
  { value: "general", label: "General help" },
  { value: "account", label: "Account" },
  { value: "order_help", label: "Order help" },
  { value: "delivery_help", label: "Delivery help" },
  { value: "payment_question", label: "Payment question" },
  { value: "product_issue", label: "Product issue" },
  { value: "other", label: "Other" },
];

const REPLY_PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
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

function statusTone(status) {
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

function TicketPill({ value, kind = "status" }) {
  const tone = kind === "priority" ? priorityTone(value) : statusTone(value);
  return <span className={`support-ticket-pill support-ticket-pill--${tone}`}>{value}</span>;
}

function safeOrderLabel(order) {
  if (!order) return "No order linked";
  return `Order ${order.orderId}`;
}

function buildSupportHint() {
  return "Use Support for general help. For refund, delivery, or order outcome issues, open a dispute from your order details.";
}

function getTicketFromQuery() {
  return new URLSearchParams(window.location.search).get("ticket") || "";
}

function SupportTicketDetail({
  ticket,
  onNavigate,
  replyDraft,
  setReplyDraft,
  replySaving,
  replyError,
  onReply,
  loading,
  loadError,
}) {
  const messages = Array.isArray(ticket?.messages) ? ticket.messages : [];
  const orderId = ticket?.orderId || "";

  return (
    <aside className="support-ticket-detail panel">
      {loadError ? (
        <EmptyState icon={Ticket} text={loadError || "Failed to load ticket details."} />
      ) : loading && !ticket ? (
        <EmptyState icon={Ticket} text="Loading ticket details…" />
      ) : !ticket ? (
        <EmptyState icon={Ticket} text="Select a support ticket to view details and reply." />
      ) : (
        <>
          <PanelHeader
            icon={Ticket}
            title={ticket.ticketNumber}
            action={<TicketPill value={ticket.status || "Open"} />}
          />

          <div className="support-ticket-detail-head">
            <strong>{ticket.subject}</strong>
            <p>{ticket.description}</p>
          </div>

          <div className="support-ticket-context-grid">
            <span><strong>Category</strong>{ticket.category || "uncategorized"}</span>
            <span><strong>Priority</strong><TicketPill kind="priority" value={ticket.priority || "normal"} /></span>
            <span><strong>Created</strong>{formatDateTime(ticket.createdAt)}</span>
            <span><strong>Updated</strong>{formatDateTime(ticket.updatedAt)}</span>
            <span><strong>Order</strong>{safeOrderLabel(ticket.orderId ? { orderId: ticket.orderId } : null)}</span>
          </div>

          {orderId ? (
            <div className="support-ticket-order-link">
              <span>
                <PackageCheck size={14} />
                Linked order
              </span>
              <button className="ghost-action compact" type="button" onClick={() => onNavigate?.(`/account?order=${encodeURIComponent(orderId)}`)}>
                Open order
                <ArrowRight size={14} />
              </button>
            </div>
          ) : null}

          <section className="support-ticket-thread">
            <span className="support-ticket-thread-head">
              <MessageSquare size={14} />
              Conversation
            </span>
            {messages.length ? (
              messages.map((message) => (
                <article className="support-ticket-message" key={message.id}>
                  <div className="support-ticket-message-head">
                    <strong>{message.by || "System"}</strong>
                    <span>{message.role || "system"} · {formatDateTime(message.createdAt)}</span>
                  </div>
                  <p>{message.body}</p>
                  {(message.attachments || []).length > 0 ? (
                    <div className="support-ticket-attachments">
                      {message.attachments.map((attachment, index) => (
                        <span className="support-ticket-attachment" key={`${message.id}-attachment-${index}`}>
                          {typeof attachment === "string" ? attachment : attachment?.name || "Attachment"}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <EmptyState icon={MessageSquare} text="No messages yet." />
            )}
          </section>

          <section className="support-ticket-reply">
            <span className="support-ticket-thread-head">
              <MessageSquare size={14} />
              Reply
            </span>
            <textarea
              rows={4}
              value={replyDraft}
              onChange={(event) => setReplyDraft(event.target.value)}
              placeholder="Write your reply here"
            />
            {replyError ? <small className="support-ticket-error">{replyError}</small> : null}
            <div className="support-ticket-reply-actions">
              <button
                className="primary-action"
                type="button"
                disabled={replySaving || !replyDraft.trim()}
                onClick={onReply}
              >
                {replySaving ? "Sending…" : "Send reply"}
              </button>
              <small className="support-ticket-reply-note">
                Replies are only visible to the support team handling this ticket.
              </small>
            </div>
          </section>
        </>
      )}
    </aside>
  );
}

export function SupportTicketsPage({ onNavigate }) {
  const qc = useQueryClient();
  const { user, isAuthenticated } = useAuthStore();
  const authenticated = isAuthenticated();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [category, setCategory] = useState("all");
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [queryTicketId, setQueryTicketId] = useState(getTicketFromQuery);
  const [createForm, setCreateForm] = useState({
    subject: "",
    category: "general",
    priority: "normal",
    orderId: "",
    description: "",
  });
  const [createError, setCreateError] = useState("");
  const [replyDraft, setReplyDraft] = useState("");

  const ordersQuery = useQuery({
    queryKey: ["customer-support-orders", authenticated, user?.email],
    queryFn: () => ordersApi.list({ page: 1, limit: 50 }),
    enabled: authenticated,
  });

  const ticketsQuery = useQuery({
    queryKey: ["customer-support-tickets", status, priority, category, authenticated, user?.email],
    queryFn: () => supportTicketsApi.list({
      status: status === "all" ? "" : status,
      priority: priority === "all" ? "" : priority,
      category: category === "all" ? "" : category,
      limit: 100,
    }),
    enabled: authenticated,
    keepPreviousData: true,
  });

  const tickets = ticketsQuery.data?.tickets || [];
  const orders = ordersQuery.data?.orders || [];
  const hasActiveFilters = Boolean(search.trim()) || status !== "all" || priority !== "all" || category !== "all";
  const visibleTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter((ticket) => {
      const requester = [ticket.requesterName, ticket.requesterEmail].join(" ").toLowerCase();
      return [
        ticket.ticketNumber,
        ticket.subject,
        ticket.description,
        ticket.category,
        ticket.orderId,
        requester,
      ].some((value) => String(value || "").toLowerCase().includes(q));
    });
  }, [search, tickets]);

  const selectedTicketQuery = useQuery({
    queryKey: ["customer-support-ticket", selectedTicketId, authenticated, user?.email],
    queryFn: () => supportTicketsApi.get(selectedTicketId),
    enabled: authenticated && Boolean(selectedTicketId),
  });

  const selectedTicket = selectedTicketQuery.data || visibleTickets.find((ticket) => ticket.id === selectedTicketId || ticket.ticketNumber === selectedTicketId) || null;

  useEffect(() => {
    setReplyDraft("");
  }, [selectedTicketId]);

  useEffect(() => {
    function syncTicketFromQuery() {
      setQueryTicketId(getTicketFromQuery());
    }
    syncTicketFromQuery();
    window.addEventListener("popstate", syncTicketFromQuery);
    return () => window.removeEventListener("popstate", syncTicketFromQuery);
  }, []);

  useEffect(() => {
    if (queryTicketId) {
      if (selectedTicketId !== queryTicketId) setSelectedTicketId(queryTicketId);
      return;
    }
    if (!visibleTickets.length) {
      if (selectedTicketId) setSelectedTicketId("");
      return;
    }
    const selectedExists = selectedTicketId
      ? visibleTickets.some((ticket) => ticket.id === selectedTicketId || ticket.ticketNumber === selectedTicketId)
      : false;
    if (!selectedTicketId || !selectedExists) {
      setSelectedTicketId(visibleTickets[0].id || visibleTickets[0].ticketNumber);
    }
  }, [queryTicketId, selectedTicketId, visibleTickets]);

  const statusCounts = useMemo(() => {
    const counts = STATUS_OPTIONS.filter((item) => item !== "all").reduce((acc, item) => ({ ...acc, [item]: 0 }), {});
    for (const ticket of tickets) {
      if (counts[ticket.status] !== undefined) counts[ticket.status] += 1;
    }
    return counts;
  }, [tickets]);

  const openCount = tickets.filter((ticket) => ticket.status === "Open").length;
  const waitingCount = tickets.filter((ticket) => ["Waiting for Customer", "Waiting for Seller", "Waiting for Driver"].includes(ticket.status)).length;
  const resolvedCount = tickets.filter((ticket) => ["Resolved", "Closed"].includes(ticket.status)).length;

  const orderOptions = useMemo(() => ([
    { value: "", label: "No order link" },
    ...orders.map((order) => ({
      value: order.orderId,
      label: `${order.orderId} · ${order.status || "Pending"}`,
    })),
  ]), [orders]);

  const createMutation = useMutation({
    mutationFn: (payload) => supportTicketsApi.create(payload),
    onSuccess: (created) => {
      setCreateError("");
      setCreateForm({
        subject: "",
        category: "general",
        priority: "normal",
        orderId: "",
        description: "",
      });
      qc.invalidateQueries({ queryKey: ["customer-support-tickets"] });
      if (created?.id || created?.ticketNumber) {
        setSelectedTicketId(created.id || created.ticketNumber);
      }
    },
    onError: (error) => {
      setCreateError(error.message || "Failed to create support ticket.");
    },
  });

  const replyMutation = useMutation({
    mutationFn: ({ ticketId, message }) => supportTicketsApi.reply(ticketId, { message }),
    onSuccess: () => {
      setReplyDraft("");
      setCreateError("");
      qc.invalidateQueries({ queryKey: ["customer-support-tickets"] });
      qc.invalidateQueries({ queryKey: ["customer-support-ticket", selectedTicketId] });
    },
  });

  function handleCreateSubmit(event) {
    event.preventDefault();
    setCreateError("");
    const subject = createForm.subject.trim();
    const description = createForm.description.trim();
    const categoryValue = createForm.category.trim();
    if (!subject || !description || !categoryValue) {
      setCreateError("Subject, category, and description are required.");
      return;
    }
    createMutation.mutate({
      subject,
      description,
      category: categoryValue,
      priority: createForm.priority,
      orderId: createForm.orderId || null,
    });
  }

  function handleReplySubmit() {
    if (!selectedTicketId || !replyDraft.trim()) return;
    replyMutation.mutate({ ticketId: selectedTicketId, message: replyDraft.trim() });
  }

  if (!authenticated) {
    return (
      <main className="page-shell support-page">
        <PageTitle
          kicker="Support"
          title="Help & Support"
          description="Use Support for general help. For refund, delivery, or order outcome issues, open a dispute from your order details."
        />
        <section className="support-entry-panel panel">
          <EmptyState icon={HelpCircle} text="Please sign in to create or view your support tickets." />
          <div className="support-entry-actions">
            <button className="primary-action" type="button" onClick={() => window.dispatchEvent(new CustomEvent("tuti:open-auth", { detail: { mode: "login" } }))}>
              Sign in
            </button>
            <button className="secondary-action" type="button" onClick={() => onNavigate?.("/customer-service")}>
              View customer service
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell support-page">
      <PageTitle
        kicker="Support"
        title="Help & Support"
        description={buildSupportHint()}
      />

      <section className="support-bridge panel">
        <div>
          <span className="eyebrow">Need an order dispute?</span>
          <h2>Support is for general help. Disputes stay in your order details.</h2>
          <p>Use this area for account questions, general guidance, and operational help. If the issue changes refund, delivery, or order outcome, open the dispute flow from your order page.</p>
        </div>
        <div className="support-bridge-actions">
          <button className="secondary-action compact" type="button" onClick={() => onNavigate?.("/account")}>
            <PackageCheck size={16} />
            Go to orders
          </button>
          <button className="ghost-action compact" type="button" onClick={() => onNavigate?.("/customer-service")}>
            <ShieldCheck size={16} />
            Customer service
          </button>
        </div>
      </section>

      <section className="metric-grid support-ticket-metrics">
        <MetricCard icon={Ticket} label="Tickets" value={tickets.length} note="Your support history" />
        <MetricCard icon={AlertTriangle} label="Open" value={openCount} note="Needs attention" />
        <MetricCard icon={Clock} label="Waiting" value={waitingCount} note="Pending a reply" />
        <MetricCard icon={CalendarClock} label="Resolved" value={resolvedCount} note="Completed or closed" />
      </section>

      <section className="support-ticket-layout">
        <div className="support-ticket-main">
          <section className="panel support-ticket-compose">
            <PanelHeader
              icon={MessageSquare}
              title="Create support ticket"
              action="General help only"
            />
            <p className="support-ticket-help">
              Use Support for general help. For refund, delivery, or order outcome issues, open a dispute from your order details.
            </p>
            <form className="support-ticket-form" onSubmit={handleCreateSubmit}>
              <div className="support-ticket-form-grid">
                <label>
                  <span>Subject</span>
                  <input
                    required
                    value={createForm.subject}
                    onChange={(event) => setCreateForm((current) => ({ ...current, subject: event.target.value }))}
                    placeholder="What do you need help with?"
                  />
                </label>
                <label>
                  <span>Category</span>
                  <select
                    required
                    value={createForm.category}
                    onChange={(event) => setCreateForm((current) => ({ ...current, category: event.target.value }))}
                  >
                    {CATEGORY_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Priority</span>
                  <select
                    value={createForm.priority}
                    onChange={(event) => setCreateForm((current) => ({ ...current, priority: event.target.value }))}
                  >
                    {REPLY_PRIORITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Linked order</span>
                  <select
                    value={createForm.orderId}
                    onChange={(event) => setCreateForm((current) => ({ ...current, orderId: event.target.value }))}
                  >
                    {orderOptions.map((option) => (
                      <option key={option.value || "no-order"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="support-ticket-form-full">
                <span>Description</span>
                <textarea
                  required
                  rows={4}
                  value={createForm.description}
                  onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Tell us what happened and what help you need."
                />
              </label>
              {createError ? <p className="support-ticket-error">{createError}</p> : null}
              <div className="support-ticket-form-actions">
                <button className="primary-action" type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating…" : "Create ticket"}
                </button>
                <span className="support-ticket-form-note">
                  Replies and updates stay inside your support thread.
                </span>
              </div>
            </form>
          </section>

          <section className="panel support-ticket-list-panel">
            <PanelHeader
              icon={Ticket}
              title="Your tickets"
            action={`${visibleTickets.length} shown`}
            />
            <div className="support-ticket-toolbar">
              <label className="management-search support-ticket-search">
                <Search size={16} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search ticket reference, subject, category, or order"
                />
              </label>
              <label className="support-ticket-filter">
                <span>Status</span>
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  {STATUS_OPTIONS.map((item) => (
                    <option key={item} value={item}>{item === "all" ? "All statuses" : item}</option>
                  ))}
                </select>
              </label>
              <label className="support-ticket-filter">
                <span>Priority</span>
                <select value={priority} onChange={(event) => setPriority(event.target.value)}>
                  {PRIORITY_OPTIONS.map((item) => (
                    <option key={item} value={item}>{item === "all" ? "All priorities" : item}</option>
                  ))}
                </select>
              </label>
              <label className="support-ticket-filter">
                <span>Category</span>
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  {CATEGORY_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {ticketsQuery.isLoading ? (
              <div className="support-ticket-loading">
                <EmptyState icon={Ticket} text="Loading your support tickets…" />
                <div className="support-ticket-skeleton">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ) : ticketsQuery.isError ? (
              <EmptyState icon={Ticket} text="Failed to load support tickets." />
            ) : visibleTickets.length === 0 ? (
              <EmptyState
                icon={Ticket}
                text={hasActiveFilters ? "No support tickets match the current filters." : "You do not have any support tickets yet."}
              />
            ) : (
              <div className="support-ticket-list">
                {visibleTickets.map((ticket) => {
                  const selected = ticket.id === selectedTicketId || ticket.ticketNumber === selectedTicketId;
                  return (
                    <button
                      className={selected ? "support-ticket-row active" : "support-ticket-row"}
                      key={ticket.id}
                      type="button"
                      onClick={() => setSelectedTicketId(ticket.id || ticket.ticketNumber)}
                    >
                      <div className="support-ticket-row-head">
                        <strong>{ticket.ticketNumber}</strong>
                        <TicketPill value={ticket.status || "Open"} />
                      </div>
                      <div className="support-ticket-row-copy">
                        <strong>{ticket.subject}</strong>
                        <span>{ticket.category || "uncategorized"}</span>
                        <small>{ticket.orderId ? `Order ${ticket.orderId}` : "No order linked"}</small>
                      </div>
                      <div className="support-ticket-row-meta">
                        <span><TicketPill kind="priority" value={ticket.priority || "normal"} /></span>
                        <span>Updated {formatDateTime(ticket.updatedAt)}</span>
                        <span>Created {formatDateTime(ticket.createdAt)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <SupportTicketDetail
          ticket={selectedTicket}
          onNavigate={onNavigate}
          replyDraft={replyDraft}
          setReplyDraft={setReplyDraft}
          replySaving={replyMutation.isPending}
          replyError={replyMutation.isError ? replyMutation.error?.message || "Failed to send reply." : ""}
          onReply={handleReplySubmit}
          loading={selectedTicketQuery.isLoading}
          loadError={selectedTicketQuery.isError ? selectedTicketQuery.error?.message || "Failed to load ticket details." : ""}
        />
      </section>
    </main>
  );
}
