import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  MessageSquare,
  LogOut,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Ticket,
  Truck,
  WalletCards,
} from "lucide-react";
import { brand } from "@tuti/shared/brand.js";
import { authApi, driverOffersApi, driverPortalApi, supportTicketsApi } from "@tuti/shared/api/client.js";
import { EmptyState } from "@tuti/shared/components/EmptyState.jsx";
import { useAuthStore } from "@tuti/shared/store/authStore.js";
import { formatCurrency } from "@tuti/shared/utils/money.js";

const LOGIN_COPY = "Sign in with the credentials provided by your seller.";

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-AE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isSameDay(value, reference = new Date()) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime())
    && date.getFullYear() === reference.getFullYear()
    && date.getMonth() === reference.getMonth()
    && date.getDate() === reference.getDate();
}

function summarizeItems(items = []) {
  if (!items.length) return "No item summary";
  const parts = items.slice(0, 2).map((item) => {
    const qty = Number(item.quantity) || 0;
    return `${qty > 1 ? `${qty}x ` : ""}${item.productName || "Item"}`;
  });
  return `${parts.join(" · ")}${items.length > 2 ? ` +${items.length - 2} more` : ""}`;
}

function formatTimeRemaining(value) {
  if (!value) return "—";
  const expires = new Date(value);
  if (Number.isNaN(expires.getTime())) return "—";
  const diff = expires.getTime() - Date.now();
  if (diff <= 0) return "Expired soon";
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `${minutes} min left`;
  const hours = Math.round(minutes / 60);
  return `${hours}h left`;
}

function getStatusTone(status = "") {
  if (status === "Delivered") return "success";
  if (status === "Shipped") return "brand";
  if (status === "Ready for Delivery") return "warning";
  return "neutral";
}

function getTaskStatusLabel(task) {
  if (!task) return "No task selected";
  if (task.status === "Delivered") return task.driverAssignment?.deliveredAt ? "Delivered" : "Completed";
  return task.status || "Assigned";
}

function getSafeLoginErrorMessage(message) {
  if (!message) return "Sign in failed.";
  if (String(message).toLowerCase().includes("driver access")) return "This account does not have driver access.";
  return message;
}

function getSectionFromQuery() {
  return new URLSearchParams(window.location.search).get("section") || "deliveries";
}

function getSupportTicketFromQuery() {
  return new URLSearchParams(window.location.search).get("ticket") || "";
}

function StatCard({ icon: Icon, label, value, note }) {
  return (
    <article className="dp-stat">
      <span className="dp-stat-icon"><Icon size={18} /></span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

function DeliveryRow({ task, active, onSelect }) {
  const tone = getStatusTone(task.status);
  const itemSummary = summarizeItems(task.items);
  return (
    <button
      type="button"
      className={active ? "dp-task active" : "dp-task"}
      onClick={() => onSelect(task.orderId)}
    >
      <div className="dp-task-top">
        <div>
          <strong>{task.orderId}</strong>
          <span>{task.customerName || "Customer"}</span>
        </div>
        <span className={`dp-status ${tone}`}>{getTaskStatusLabel(task)}</span>
      </div>

      <p className="dp-task-address">{task.deliveryAddress || "No delivery address listed."}</p>

      <div className="dp-task-meta">
        <span><Package size={13} />{itemSummary}</span>
        <span><WalletCards size={13} />{formatCurrency(task.codAmount || 0)}</span>
      </div>

      <div className="dp-task-footer">
        <span><Clock3 size={13} />Assigned {formatDateTime(task.driverAssignment?.assignedAt)}</span>
        {task.driverAssignment?.deliveredAt ? <span><CheckCircle2 size={13} />Delivered {formatDateTime(task.driverAssignment.deliveredAt)}</span> : null}
      </div>
    </button>
  );
}

function OfferCard({ offer, busy, onAccept }) {
  return (
    <article className="dp-offer-card">
      <div className="dp-offer-head">
        <div>
          <strong>{offer.orderId}</strong>
          <span>{offer.shopName || "Seller shop"}</span>
        </div>
        <span className="dp-offer-timer">{formatTimeRemaining(offer.expiresAt)}</span>
      </div>

      <div className="dp-offer-meta">
        <span><MapPin size={13} />{offer.deliveryZone || "Any zone"}</span>
        <span><WalletCards size={13} />{formatCurrency(offer.codAmount || 0)}</span>
      </div>

      <p className="dp-offer-address">{offer.deliveryAddressSummary || "No address summary provided."}</p>

      {offer.notes ? <p className="dp-offer-notes">{offer.notes}</p> : null}

      <button className="primary-action full-width" type="button" onClick={() => onAccept(offer.id)} disabled={busy}>
        <Truck size={16} />
        {busy ? "Accepting…" : "Accept offer"}
      </button>
    </article>
  );
}

const SUPPORT_STATUS_OPTIONS = [
  "all",
  "Open",
  "In Progress",
  "Waiting for Customer",
  "Waiting for Seller",
  "Waiting for Driver",
  "Resolved",
  "Closed",
]

const SUPPORT_PRIORITY_OPTIONS = ["all", "low", "normal", "high", "urgent"];
const DRIVER_SUPPORT_CATEGORY_OPTIONS = [
  { value: "all", label: "All categories" },
  { value: "delivery_help", label: "Delivery help" },
  { value: "order_handoff", label: "Order handoff" },
  { value: "cod_cash_collection", label: "COD cash collection" },
  { value: "account_access", label: "Account access" },
  { value: "app_issue", label: "App issue" },
  { value: "other", label: "Other" },
];

function formatSupportCategory(value) {
  const map = {
    delivery_help: "Delivery help",
    order_handoff: "Order handoff",
    cod_cash_collection: "COD cash collection",
    account_access: "Account access",
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
    case "Waiting for Seller":
    case "Waiting for Driver": return "neutral";
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
  return <span className={`dp-support-pill ${tone}`}>{value}</span>;
}

function SupportTicketRow({ ticket, active, onSelect }) {
  return (
    <button type="button" className={active ? "dp-support-row active" : "dp-support-row"} onClick={() => onSelect(ticket.id || ticket.ticketNumber)}>
      <div className="dp-support-row-main">
        <div className="dp-support-row-head">
          <strong>{ticket.ticketNumber}</strong>
          <span>{ticket.subject}</span>
        </div>
        <p>{ticket.description}</p>
        <div className="dp-support-row-meta">
          <span>{formatSupportCategory(ticket.category)}</span>
          <span>{ticket.orderId ? `Order ${ticket.orderId}` : "No delivery link"}</span>
          <span>Updated {formatDateTime(ticket.updatedAt)}</span>
        </div>
      </div>
      <div className="dp-support-row-side">
        <SupportPill value={ticket.status || "Open"} />
        <SupportPill kind="priority" value={ticket.priority || "normal"} />
        <span className="dp-support-row-ref">Created {formatDateTime(ticket.createdAt)}</span>
      </div>
    </button>
  );
}

function SupportTicketDetail({ ticket, onOpenDelivery, replyDraft, setReplyDraft, replySaving, replyError, onReply, loading, loadError }) {
  const messages = Array.isArray(ticket?.messages) ? ticket.messages : [];

  return (
    <aside className="dp-support-detail">
      {loadError ? (
        <EmptyState icon={Ticket} text={loadError || "Failed to load support ticket."} />
      ) : loading && !ticket ? (
        <EmptyState icon={Ticket} text="Loading support ticket…" />
      ) : !ticket ? (
        <EmptyState icon={Ticket} text="Select a support ticket to view the thread and reply." />
      ) : (
        <>
          <div className="dp-support-detail-head">
            <span className="eyebrow">Support ticket</span>
            <h2>{ticket.ticketNumber}</h2>
            <p>{ticket.subject}</p>
            <div className="dp-support-detail-meta">
              <span><strong>Category</strong>{formatSupportCategory(ticket.category)}</span>
              <span><strong>Priority</strong><SupportPill kind="priority" value={ticket.priority || "normal"} /></span>
              <span><strong>Status</strong><SupportPill value={ticket.status || "Open"} /></span>
              <span><strong>Created</strong>{formatDateTime(ticket.createdAt)}</span>
              <span><strong>Updated</strong>{formatDateTime(ticket.updatedAt)}</span>
            </div>
            <p className="dp-support-copy">Use Support for delivery, account, app, or COD help. Support tickets do not complete deliveries, change COD balances, or resolve disputes.</p>
          </div>

          {ticket.orderId ? (
            <div className="dp-support-linked">
              <div>
                <span>Linked delivery</span>
                <strong>{ticket.orderId}</strong>
              </div>
              <button className="secondary-action compact" type="button" onClick={() => onOpenDelivery?.(ticket.orderId)}>
                Open delivery
                <ArrowRight size={14} />
              </button>
            </div>
          ) : null}

          <section className="dp-support-thread">
            <span className="dp-support-thread-head">
              <MessageSquare size={14} />
              Conversation
            </span>
            {messages.length ? (
              messages.map((message) => (
                <article className="dp-support-message" key={message.id}>
                  <div className="dp-support-message-head">
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

          <section className="dp-support-reply">
            <span className="dp-support-thread-head">
              <MessageSquare size={14} />
              Reply
            </span>
            <textarea
              rows="4"
              value={replyDraft}
              onChange={(e) => setReplyDraft(e.target.value)}
              placeholder="Write your reply here"
            />
            {replyError ? <small className="dp-form-error">{replyError}</small> : null}
            <div className="dp-support-reply-actions">
              <button className="primary-action" type="button" disabled={replySaving || !replyDraft.trim()} onClick={onReply}>
                {replySaving ? "Sending…" : "Send reply"}
              </button>
              <small className="dp-support-reply-note">Replies stay inside this support thread and never change delivery status or COD.</small>
            </div>
          </section>
        </>
      )}
    </aside>
  );
}

export default function App() {
  const queryClient = useQueryClient();
  const { user, accessToken, isAuthenticated, setAuth, clearAuth } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [taskError, setTaskError] = useState("");
  const [taskNote, setTaskNote] = useState("");
  const [offerError, setOfferError] = useState("");
  const [offerNote, setOfferNote] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [pendingOfferId, setPendingOfferId] = useState("");
  const [codCollected, setCodCollected] = useState(true);
  const [deliveryNote, setDeliveryNote] = useState("");
  const [section, setSection] = useState(getSectionFromQuery);
  const [supportSearch, setSupportSearch] = useState("");
  const [supportStatus, setSupportStatus] = useState("all");
  const [supportPriority, setSupportPriority] = useState("all");
  const [supportCategory, setSupportCategory] = useState("all");
  const [selectedSupportTicketId, setSelectedSupportTicketId] = useState("");
  const [supportCreateForm, setSupportCreateForm] = useState({
    subject: "",
    description: "",
    category: "delivery_help",
    priority: "normal",
    orderId: "",
  });
  const [supportCreateError, setSupportCreateError] = useState("");
  const [supportReplyDraft, setSupportReplyDraft] = useState("");
  const [supportReplyError, setSupportReplyError] = useState("");
  const [supportNotice, setSupportNotice] = useState("");
  const [querySupportTicketId, setQuerySupportTicketId] = useState(getSupportTicketFromQuery);

  const isDriverSession = isAuthenticated() && user?.role === "driver" && Boolean(accessToken);
  const nonDriverSession = isAuthenticated() && user && user.role !== "driver";
  const driverKey = user?.driverId || "guest";
  const shopKey = user?.shopId || "guest";

  const meQuery = useQuery({
    queryKey: ["driver", "me", driverKey, shopKey],
    queryFn: () => driverPortalApi.me(),
    enabled: isDriverSession,
  });

  const deliveriesQuery = useQuery({
    queryKey: ["driver", "deliveries", driverKey, shopKey],
    queryFn: () => driverPortalApi.listDeliveries(),
    enabled: isDriverSession,
  });

  const offersQuery = useQuery({
    queryKey: ["driver", "offers", driverKey, shopKey],
    queryFn: () => driverOffersApi.list(),
    enabled: isDriverSession,
  });

  const supportTicketsQuery = useQuery({
    queryKey: ["driver", "support", driverKey, shopKey, supportStatus, supportPriority, supportCategory, supportSearch],
    queryFn: () => supportTicketsApi.list({
      q: supportSearch.trim(),
      status: supportStatus === "all" ? "" : supportStatus,
      priority: supportPriority === "all" ? "" : supportPriority,
      category: supportCategory === "all" ? "" : supportCategory,
      limit: 100,
    }),
    enabled: isDriverSession,
    keepPreviousData: true,
  });

  const deliveries = Array.isArray(deliveriesQuery.data) ? deliveriesQuery.data : [];
  const offers = Array.isArray(offersQuery.data) ? offersQuery.data : [];
  const supportTickets = Array.isArray(supportTicketsQuery.data?.tickets) ? supportTicketsQuery.data.tickets : [];
  const detailOrderId = selectedOrderId || deliveries[0]?.orderId || "";

  useEffect(() => {
    if (!deliveries.length) {
      if (selectedOrderId) setSelectedOrderId("");
      return;
    }
    const selectedExists = deliveries.some((task) => task.orderId === selectedOrderId);
    if (!selectedOrderId || !selectedExists) {
      setSelectedOrderId(deliveries[0].orderId);
    }
  }, [deliveries, selectedOrderId]);
  const selectedTaskQuery = useQuery({
    queryKey: ["driver", "delivery", driverKey, shopKey, detailOrderId],
    queryFn: () => driverPortalApi.getDelivery(detailOrderId),
    enabled: isDriverSession && Boolean(detailOrderId),
  });

  const profile = meQuery.data || null;
  const selectedTask = selectedTaskQuery.data
    || deliveries.find((task) => task.orderId === detailOrderId)
    || null;

  useEffect(() => {
    if (!selectedTask) return;
    if (selectedTask.status === "Delivered" || selectedTask.driverAssignment?.deliveredAt) return;
    setCodCollected(selectedTask.paymentMethod === "cod");
    setDeliveryNote("");
    setTaskError("");
  }, [detailOrderId, selectedTask?.status, selectedTask?.driverAssignment?.deliveredAt]);

  const activeDeliveries = deliveries.filter((task) => task.status !== "Delivered").length;
  const deliveredToday = deliveries.filter((task) => task.status === "Delivered" && isSameDay(task.driverAssignment?.deliveredAt)).length;
  const codToRemit = Number(profile?.codBalance || 0);
  const supportOrderOptions = useMemo(() => ([
    { value: "", label: "No linked delivery" },
    ...deliveries.map((task) => ({
      value: task.orderId,
      label: `${task.orderId} · ${getTaskStatusLabel(task)}`,
    })),
  ]), [deliveries]);

  const refreshAll = async () => {
    const tasks = [meQuery.refetch(), deliveriesQuery.refetch(), offersQuery.refetch(), supportTicketsQuery.refetch()];
    if (detailOrderId) tasks.push(selectedTaskQuery.refetch());
    if (selectedSupportTicketId) tasks.push(selectedSupportTicketQuery.refetch());
    await Promise.all(tasks);
  };

  const acceptOfferMutation = useMutation({
    mutationFn: (offerId) => driverOffersApi.accept(offerId),
    onMutate: (offerId) => {
      setPendingOfferId(offerId);
      setOfferError("");
      setOfferNote("");
    },
    onSuccess: async (result) => {
      setOfferNote("Delivery offer accepted.");
      await queryClient.invalidateQueries({ queryKey: ["driver"] });
      await Promise.all([offersQuery.refetch(), deliveriesQuery.refetch(), meQuery.refetch()]);
      const acceptedOrderId = result?.order?.orderId || result?.offer?.orderId;
      if (acceptedOrderId) setSelectedOrderId(acceptedOrderId);
    },
    onError: async (err) => {
      const message = String(err?.message || "Unable to accept delivery offer.").toLowerCase();
      if (
        message.includes("already accepted") ||
        message.includes("no longer available") ||
        message.includes("no longer open") ||
        message.includes("active assignment") ||
        message.includes("already has an active")
      ) {
        setOfferError("This delivery was already accepted by another driver.");
      } else if (message.includes("expired")) {
        setOfferError("This delivery offer has expired.");
      } else if (message.includes("cancel")) {
        setOfferError("This delivery offer is no longer available.");
      } else {
        setOfferError(err?.message || "Unable to accept delivery offer.");
      }
      await offersQuery.refetch();
    },
    onSettled: () => setPendingOfferId(""),
  });

  const completeMutation = useMutation({
    mutationFn: ({ orderId, payload }) => driverPortalApi.recordDelivery(orderId, payload),
    onSuccess: async () => {
      setTaskError("");
      setTaskNote("Delivery marked complete.");
      await queryClient.invalidateQueries({ queryKey: ["driver"] });
    },
    onError: (err) => setTaskError(err?.message || "Unable to complete delivery."),
  });

  const supportCreateMutation = useMutation({
    mutationFn: (payload) => supportTicketsApi.create(payload),
    onSuccess: async (created) => {
      setSupportCreateError("");
      setSupportNotice("Support ticket created.");
      setSupportCreateForm({ subject: "", description: "", category: "delivery_help", priority: "normal", orderId: "" });
      await refreshAll();
      if (created?.id || created?.ticketNumber) {
        setSelectedSupportTicketId(created.id || created.ticketNumber);
      }
      setSection("support");
    },
    onError: (err) => setSupportCreateError(err?.message || "Unable to create support ticket."),
  });

  const supportReplyMutation = useMutation({
    mutationFn: ({ ticketId, message }) => supportTicketsApi.reply(ticketId, { message }),
    onSuccess: async () => {
      setSupportReplyDraft("");
      setSupportReplyError("");
      setSupportNotice("Reply sent.");
      await Promise.all([
        supportTicketsQuery.refetch(),
        selectedSupportTicketId ? selectedSupportTicketQuery.refetch() : Promise.resolve(),
      ]);
    },
    onError: (err) => setSupportReplyError(err?.message || "Unable to send reply."),
  });

  useEffect(() => {
    if (taskNote) {
      const timer = window.setTimeout(() => setTaskNote(""), 2200);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [taskNote]);

  useEffect(() => {
    if (offerNote) {
      const timer = window.setTimeout(() => setOfferNote(""), 2400);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [offerNote]);

  useEffect(() => {
    if (!supportNotice) return undefined;
    const timer = window.setTimeout(() => setSupportNotice(""), 2400);
    return () => window.clearTimeout(timer);
  }, [supportNotice]);

  useEffect(() => {
    function syncSupportSelectionFromQuery() {
      setSection(getSectionFromQuery());
      setQuerySupportTicketId(getSupportTicketFromQuery());
    }

    syncSupportSelectionFromQuery();
    window.addEventListener("popstate", syncSupportSelectionFromQuery);
    return () => window.removeEventListener("popstate", syncSupportSelectionFromQuery);
  }, []);

  const visibleSupportTickets = useMemo(() => {
    const q = supportSearch.trim().toLowerCase();
    if (!q) return supportTickets;
    return supportTickets.filter((ticket) => {
      const haystack = [
        ticket.ticketNumber,
        ticket.subject,
        ticket.description,
        ticket.category,
        ticket.status,
        ticket.orderId,
        ticket.requesterName,
        ticket.requesterEmail,
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [supportSearch, supportTickets]);

  const selectedSupportTicketQuery = useQuery({
    queryKey: ["driver", "support-ticket", driverKey, shopKey, selectedSupportTicketId],
    queryFn: () => supportTicketsApi.get(selectedSupportTicketId),
    enabled: isDriverSession && Boolean(selectedSupportTicketId),
  });

  const selectedSupportTicket = selectedSupportTicketQuery.data
    || visibleSupportTickets.find((ticket) => ticket.id === selectedSupportTicketId || ticket.ticketNumber === selectedSupportTicketId)
    || null;

  useEffect(() => {
    if (!visibleSupportTickets.length) {
      if (selectedSupportTicketId) setSelectedSupportTicketId("");
      return;
    }

    if (querySupportTicketId) {
      const selectedExists = visibleSupportTickets.some((ticket) => ticket.id === querySupportTicketId || ticket.ticketNumber === querySupportTicketId);
      if (selectedSupportTicketId !== querySupportTicketId) setSelectedSupportTicketId(querySupportTicketId);
      if (selectedExists) return;
    }

    const exists = selectedSupportTicketId
      ? visibleSupportTickets.some((ticket) => ticket.id === selectedSupportTicketId || ticket.ticketNumber === selectedSupportTicketId)
      : false;
    if (!selectedSupportTicketId || !exists) {
      setSelectedSupportTicketId(visibleSupportTickets[0].id || visibleSupportTickets[0].ticketNumber);
    }
  }, [querySupportTicketId, selectedSupportTicketId, visibleSupportTickets]);

  useEffect(() => {
    if (!selectedSupportTicketId) return;
    setSupportReplyError("");
  }, [selectedSupportTicketId]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    try {
      const result = await authApi.login({ email: email.trim(), password });
      if (result?.user?.role !== "driver") {
        setLoginError("This account does not have driver access.");
        return;
      }
      if (!result?.user?.driverId) {
        setLoginError("Driver profile is not linked.");
        return;
      }
      setAuth(result.user, result.accessToken, result.refreshToken);
      setPassword("");
    } catch (err) {
      setLoginError(getSafeLoginErrorMessage(err?.message));
    }
  }

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // local sign-out still happens below
    } finally {
      clearAuth();
      queryClient.removeQueries({ queryKey: ["driver"] });
      setSelectedOrderId("");
      setTaskError("");
      setTaskNote("");
      setOfferError("");
      setOfferNote("");
      setSupportNotice("");
      setSupportCreateError("");
      setSupportReplyError("");
      setSupportSearch("");
      setSupportStatus("all");
      setSupportPriority("all");
      setSupportCategory("all");
      setSelectedSupportTicketId("");
      setSupportCreateForm({ subject: "", description: "", category: "delivery_help", priority: "normal", orderId: "" });
      setSupportReplyDraft("");
      setSection("deliveries");
    }
  }

  async function handleMarkDelivered(e) {
    e.preventDefault();
    if (!selectedTask || selectedTask.status === "Delivered") return;
    setTaskError("");
    await completeMutation.mutateAsync({
      orderId: selectedTask.orderId,
      payload: {
        codCollected,
        note: deliveryNote.trim(),
      },
    });
    setDeliveryNote("");
    await refreshAll();
  }

  async function handleAcceptOffer(offerId) {
    setOfferError("");
    await acceptOfferMutation.mutateAsync(offerId);
    await refreshAll();
  }

  if (!isDriverSession) {
    return (
      <main className="dp-gate">
        <section className="dp-gate-card">
          <div className="dp-gate-brand">
            <span className="dp-mark">{brand.mark}</span>
            <div>
              <span className="eyebrow">Driver Portal</span>
              <h1>Delivery tasks for linked drivers</h1>
            </div>
          </div>

          <p className="dp-gate-copy">{LOGIN_COPY}</p>

          {nonDriverSession ? (
            <div className="dp-gate-warning">
              <AlertTriangle size={16} />
              <span>This account does not have driver access.</span>
            </div>
          ) : null}

          <form className="dp-login-form" onSubmit={handleLogin}>
            <label className="dp-field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="driver@tuti.example"
                autoComplete="email"
                required
              />
            </label>

            <label className="dp-field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Temporary or assigned password"
                autoComplete="current-password"
                required
              />
            </label>

            {loginError ? <p className="dp-form-error">{loginError}</p> : null}

            <button className="primary-action full-width" type="submit">
              <ShieldCheck size={16} />
              Sign in
            </button>
          </form>
        </section>
      </main>
    );
  }

  const dashboardError = meQuery.isError ? (meQuery.error?.message || "Unable to load driver profile.") : "";

  if (dashboardError) {
    return (
      <main className="dp-error-screen">
        <section className="dp-error-card">
          <AlertTriangle size={22} />
          <h1>Could not load driver access</h1>
          <p>{dashboardError}</p>
          <div className="dp-error-actions">
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
    <main className="dp-shell">
      <header className="dp-topbar">
        <div className="dp-topbar-brand">
          <span className="dp-mark small">{brand.mark}</span>
          <div>
            <span className="eyebrow">Driver Portal</span>
            <strong>{profile?.name || user?.name || "Driver"}</strong>
          </div>
        </div>

        <div className="dp-topbar-actions">
          <div className="dp-topbar-tabs" role="tablist" aria-label="Driver sections">
            <button
              className={section === "deliveries" ? "dp-tab active" : "dp-tab"}
              type="button"
              onClick={() => setSection("deliveries")}
            >
              <Truck size={13} />
              Deliveries
            </button>
            <button
              className={section === "offers" ? "dp-tab active" : "dp-tab"}
              type="button"
              onClick={() => setSection("offers")}
            >
              <Ticket size={13} />
              Offers
            </button>
            <button
              className={section === "support" ? "dp-tab active" : "dp-tab"}
              type="button"
              onClick={() => setSection("support")}
            >
              <MessageSquare size={13} />
              Support
            </button>
          </div>
          <button className="secondary-action compact" type="button" onClick={refreshAll} disabled={meQuery.isFetching || deliveriesQuery.isFetching}>
            <RefreshCw size={14} />
            Refresh
          </button>
          <button className="ghost-action compact" type="button" onClick={handleLogout}>
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </header>

      {section === "support" ? (
        <>
          <section className="dp-support-hero">
            <div className="dp-support-hero-copy">
              <span className="eyebrow">Help &amp; Support</span>
              <h1>Support for delivery, account, app, or COD help.</h1>
              <p>Use Support for communication and help requests. It does not complete deliveries, change COD balances, or resolve disputes.</p>
            </div>
            <div className="dp-support-hero-card">
              <span className="dp-support-hero-label">Driver scope</span>
              <strong>Private to you</strong>
              <p>Your tickets stay linked to your driver account and the support team handling them.</p>
            </div>
          </section>

          {supportNotice ? (
            <div className="dp-banner success">
              <CheckCircle2 size={14} />
              <span>{supportNotice}</span>
            </div>
          ) : null}

          <section className="dp-support-board">
            <article className="dp-panel dp-support-list-panel">
              <div className="dp-panel-head">
                <div>
                  <span className="eyebrow">Create ticket</span>
                  <h2>Support tickets</h2>
                </div>
                <span className="dp-panel-meta">Driver-scoped support only</span>
              </div>

              <form className="dp-support-form" onSubmit={(e) => {
                e.preventDefault();
                setSupportCreateError("");
                const subject = supportCreateForm.subject.trim();
                const description = supportCreateForm.description.trim();
                const category = supportCreateForm.category.trim();
                if (!subject || !description || !category) {
                  setSupportCreateError("Subject, category, and description are required.");
                  return;
                }
                supportCreateMutation.mutate({
                  subject,
                  description,
                  category,
                  priority: supportCreateForm.priority,
                  orderId: supportCreateForm.orderId || null,
                });
              }}>
                <p className="dp-support-copy">
                  Use Support for delivery, account, app, or COD help. Support tickets do not complete deliveries, change COD balances, or resolve disputes.
                </p>
                <div className="dp-support-grid">
                  <label className="dp-field wide">
                    <span>Subject</span>
                    <input
                      value={supportCreateForm.subject}
                      onChange={(e) => setSupportCreateForm((current) => ({ ...current, subject: e.target.value }))}
                      placeholder="What do you need help with?"
                    />
                  </label>
                  <label className="dp-field">
                    <span>Category</span>
                    <select
                      value={supportCreateForm.category}
                      onChange={(e) => setSupportCreateForm((current) => ({ ...current, category: e.target.value }))}
                    >
                      {DRIVER_SUPPORT_CATEGORY_OPTIONS.filter((item) => item.value !== "all").map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="dp-field">
                    <span>Priority</span>
                    <select
                      value={supportCreateForm.priority}
                      onChange={(e) => setSupportCreateForm((current) => ({ ...current, priority: e.target.value }))}
                    >
                      {SUPPORT_PRIORITY_OPTIONS.filter((value) => value !== "all").map((value) => (
                        <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="dp-field wide">
                    <span>Linked delivery (optional)</span>
                    <select
                      value={supportCreateForm.orderId}
                      onChange={(e) => setSupportCreateForm((current) => ({ ...current, orderId: e.target.value }))}
                    >
                      {supportOrderOptions.map((option) => (
                        <option key={option.value || "no-order"} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="dp-field wide">
                    <span>Description</span>
                    <textarea
                      rows="4"
                      value={supportCreateForm.description}
                      onChange={(e) => setSupportCreateForm((current) => ({ ...current, description: e.target.value }))}
                      placeholder="Describe the issue, question, or help request in a few clear sentences."
                    />
                  </label>
                </div>
                {supportCreateError ? <p className="dp-form-error">{supportCreateError}</p> : null}
                <button className="primary-action full-width" type="submit" disabled={supportCreateMutation.isPending}>
                  <Ticket size={16} />
                  {supportCreateMutation.isPending ? "Creating…" : "Create ticket"}
                </button>
              </form>

              <div className="dp-support-filters">
                <label className="dp-field">
                  <span>Search</span>
                  <div className="dp-support-search">
                    <Search size={14} />
                    <input value={supportSearch} onChange={(e) => setSupportSearch(e.target.value)} placeholder="Search ticket ref, subject, delivery…" />
                  </div>
                </label>
                <label className="dp-field">
                  <span>Status</span>
                  <select value={supportStatus} onChange={(e) => setSupportStatus(e.target.value)}>
                    {SUPPORT_STATUS_OPTIONS.map((value) => <option key={value} value={value}>{value === "all" ? "All" : value}</option>)}
                  </select>
                </label>
                <label className="dp-field">
                  <span>Priority</span>
                  <select value={supportPriority} onChange={(e) => setSupportPriority(e.target.value)}>
                    {SUPPORT_PRIORITY_OPTIONS.map((value) => <option key={value} value={value}>{value === "all" ? "All" : value.charAt(0).toUpperCase() + value.slice(1)}</option>)}
                  </select>
                </label>
                <label className="dp-field">
                  <span>Category</span>
                  <select value={supportCategory} onChange={(e) => setSupportCategory(e.target.value)}>
                    {DRIVER_SUPPORT_CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
              </div>

              {supportTicketsQuery.isError ? (
                <div className="dp-banner error">
                  <AlertTriangle size={14} />
                  <span>{supportTicketsQuery.error?.message || "Unable to load support tickets."}</span>
                </div>
              ) : null}

              {supportTicketsQuery.isLoading && !supportTickets.length ? (
                <div className="dp-loading">Loading support tickets…</div>
              ) : visibleSupportTickets.length ? (
                <div className="dp-support-list">
                  {visibleSupportTickets.map((ticket) => (
                    <SupportTicketRow
                      key={ticket.id || ticket.ticketNumber}
                      ticket={ticket}
                      active={selectedSupportTicketId === ticket.id || selectedSupportTicketId === ticket.ticketNumber}
                      onSelect={setSelectedSupportTicketId}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Ticket}
                  text={supportSearch || supportStatus !== "all" || supportPriority !== "all" || supportCategory !== "all"
                    ? "No support tickets match your filters."
                    : "No support tickets yet. Use Support for general help; disputes stay in the order flow."}
                />
              )}
            </article>

            <SupportTicketDetail
              ticket={selectedSupportTicket}
              onOpenDelivery={(orderId) => {
                setSection("deliveries");
                setSelectedOrderId(orderId);
              }}
              replyDraft={supportReplyDraft}
              setReplyDraft={setSupportReplyDraft}
              replySaving={supportReplyMutation.isPending}
              replyError={supportReplyError}
              onReply={() => {
                if (!selectedSupportTicketId || !supportReplyDraft.trim()) return;
                supportReplyMutation.mutate({ ticketId: selectedSupportTicketId, message: supportReplyDraft.trim() });
              }}
              loading={selectedSupportTicketQuery.isLoading}
              loadError={selectedSupportTicketQuery.error?.message || ""}
            />
          </section>
        </>
      ) : (
        <>
          <section className="dp-hero">
            <div className="dp-hero-copy">
              <span className="eyebrow">Today’s route</span>
              <h1>Good to see you, {profile?.name || user?.name || "driver"}.</h1>
              <p>
                Your seller assigned tasks live here. Keep an eye on the address, collect COD if needed, and mark the delivery once it is complete.
              </p>
              <div className="dp-hero-chips">
                <span><Truck size={14} />{profile?.vehicleType || "Vehicle"}</span>
                <span><MapPin size={14} />{profile?.zone || "Zone not listed"}</span>
                <span><WalletCards size={14} />{formatCurrency(codToRemit)}</span>
              </div>
            </div>

            <aside className="dp-profile-card">
              <div className="dp-profile-head">
                <span className="dp-profile-badge">Assigned shop</span>
                <strong>{profile?.shopName || "Shop not listed"}</strong>
              </div>
              <dl>
                <div><dt>Shop ID</dt><dd>{profile?.shopId || "—"}</dd></div>
                <div><dt>Phone</dt><dd>{profile?.phone || "—"}</dd></div>
                <div><dt>Email</dt><dd>{profile?.loginEmail || "—"}</dd></div>
                <div><dt>Status</dt><dd className="dp-profile-status">{profile?.status || "active"}</dd></div>
              </dl>
            </aside>
          </section>

          <section className="dp-stats-grid">
            <StatCard icon={Truck} label="Active deliveries" value={activeDeliveries} note="Ready for delivery or shipped" />
            <StatCard icon={CheckCircle2} label="Delivered today" value={deliveredToday} note="Completed in this session" />
            <StatCard icon={WalletCards} label="COD to remit" value={formatCurrency(codToRemit)} note="Cash tracking only" />
          </section>

          {(deliveriesQuery.isError || taskError) ? (
            <div className="dp-banner error">
              <AlertTriangle size={14} />
              <span>{deliveriesQuery.error?.message || taskError}</span>
            </div>
          ) : null}

          {taskNote ? (
            <div className="dp-banner success">
              <CheckCircle2 size={14} />
              <span>{taskNote}</span>
            </div>
          ) : null}

          {offerError ? (
            <div className="dp-banner error">
              <AlertTriangle size={14} />
              <span>{offerError}</span>
            </div>
          ) : null}

          {offerNote ? (
            <div className="dp-banner success">
              <CheckCircle2 size={14} />
              <span>{offerNote}</span>
            </div>
          ) : null}

          <section className="dp-board">
            <article className="dp-panel dp-offers-panel">
              <div className="dp-panel-head">
                <div>
                  <span className="eyebrow">Available delivery offers</span>
                  <h2>{offers.length ? `${offers.length} offer${offers.length === 1 ? "" : "s"}` : "No available offers"}</h2>
                </div>
                <span className="dp-panel-meta">First accepted by you becomes your task</span>
              </div>

              {offersQuery.isLoading ? (
                <div className="dp-loading">Loading offers…</div>
              ) : offers.length ? (
                <div className="dp-offer-list">
                  {offers.map((offer) => (
                    <OfferCard
                      key={offer.id}
                      offer={offer}
                      busy={pendingOfferId === offer.id && acceptOfferMutation.isPending}
                      onAccept={handleAcceptOffer}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Truck}
                  text="No available delivery offers right now. Keep this screen open and refresh when your seller broadcasts new work."
                />
              )}
            </article>

            <article className="dp-panel dp-list-panel">
              <div className="dp-panel-head">
                <div>
                  <span className="eyebrow">My assigned deliveries</span>
                  <h2>{deliveries.length ? `${deliveries.length} task${deliveries.length === 1 ? "" : "s"}` : "No assigned deliveries"}</h2>
                </div>
                <span className="dp-panel-meta">Tap a task to inspect it</span>
              </div>

              {deliveriesQuery.isLoading ? (
                <div className="dp-loading">Loading deliveries…</div>
              ) : deliveries.length ? (
                <>
                  <div className="dp-task-list">
                    {deliveries.map((task) => (
                      <DeliveryRow
                        key={task.orderId}
                        task={task}
                        active={task.orderId === detailOrderId}
                        onSelect={setSelectedOrderId}
                      />
                    ))}
                  </div>

                  <div className="dp-inline-detail">
                    <div className="dp-panel-head inline">
                      <div>
                        <span className="eyebrow">Delivery detail</span>
                        <h2>{selectedTask?.orderId || "Select a delivery"}</h2>
                      </div>
                      {selectedTask ? <span className={`dp-status ${getStatusTone(selectedTask.status)}`}>{getTaskStatusLabel(selectedTask)}</span> : null}
                    </div>

                    {selectedTask ? (
                      <>
                        <div className="dp-detail-grid">
                          <div className="dp-detail-card">
                            <span>Customer</span>
                            <strong>{selectedTask.customerName || "Customer"}</strong>
                            <small>{selectedTask.phone || "Phone not shared"}</small>
                          </div>
                          <div className="dp-detail-card">
                            <span>Delivery window</span>
                            <strong>{selectedTask.deliveryDate || "—"}</strong>
                            <small>{selectedTask.deliveryTime || "—"}</small>
                          </div>
                          <div className="dp-detail-card">
                            <span>COD amount</span>
                            <strong>{formatCurrency(selectedTask.codAmount || 0)}</strong>
                            <small>{selectedTask.paymentMethod === "cod" ? "Collect on delivery" : "No COD due"}</small>
                          </div>
                          <div className="dp-detail-card">
                            <span>Assigned at</span>
                            <strong>{formatDateTime(selectedTask.driverAssignment?.assignedAt)}</strong>
                            <small>{selectedTask.driverAssignment?.deliveredAt ? `Delivered ${formatDateTime(selectedTask.driverAssignment.deliveredAt)}` : "Still active"}</small>
                          </div>
                        </div>

                        <section className="dp-detail-section">
                          <h3>Address</h3>
                          <p>{selectedTask.deliveryAddress || "No address listed."}</p>
                        </section>

                        <section className="dp-detail-section">
                          <h3>Items</h3>
                          <div className="dp-item-list">
                            {selectedTask.items?.length ? selectedTask.items.map((item, index) => (
                              <div className="dp-item-row" key={`${selectedTask.orderId}-${item.productId || item.productName || index}`}>
                                <div>
                                  <strong>{item.productName || "Item"}</strong>
                                  <span>{item.quantity || 1} × {formatCurrency(item.price || 0)}</span>
                                </div>
                                <small>{item.category || "Item"}</small>
                              </div>
                            )) : <p className="dp-muted">No item details available.</p>}
                          </div>
                        </section>

                        <section className="dp-detail-section">
                          <h3>Warning</h3>
                          <p className="dp-warning-copy">
                            COD collected updates your cash balance for seller/admin tracking. No payment transfer is executed.
                          </p>
                        </section>

                        {selectedTask.status === "Delivered" || selectedTask.driverAssignment?.deliveredAt ? (
                          <div className="dp-complete-state">
                            <CheckCircle2 size={16} />
                            <span>This delivery is already completed.</span>
                          </div>
                        ) : (
                          <form className="dp-delivery-form" onSubmit={handleMarkDelivered}>
                            <label className="dp-field">
                              <span>COD collected</span>
                              <div className="dp-switch-row" role="group" aria-label="COD collected">
                                <button
                                  type="button"
                                  className={codCollected ? "dp-switch active" : "dp-switch"}
                                  onClick={() => setCodCollected(true)}
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  className={!codCollected ? "dp-switch active" : "dp-switch"}
                                  onClick={() => setCodCollected(false)}
                                >
                                  No
                                </button>
                              </div>
                            </label>

                            <label className="dp-field">
                              <span>Delivery note</span>
                              <textarea
                                rows="3"
                                value={deliveryNote}
                                onChange={(e) => setDeliveryNote(e.target.value)}
                                placeholder="Gate code, customer note, or handoff detail"
                              />
                            </label>

                            <button className="primary-action full-width" type="submit" disabled={completeMutation.isPending}>
                              <CheckCircle2 size={16} />
                              {completeMutation.isPending ? "Saving…" : "Mark delivered"}
                            </button>
                          </form>
                        )}
                      </>
                    ) : (
                      <EmptyState icon={Truck} text="Select an assigned delivery to review the address and complete it." />
                    )}
                  </div>
                </>
              ) : (
                <EmptyState icon={Package} text="No assigned deliveries yet. Your seller will add tasks here once an order is ready." />
              )}
            </article>
          </section>
        </>
      )}
    </main>
  );
}
