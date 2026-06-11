import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  BarChart2,
  Cake,
  CalendarClock,
  CheckCircle2,
  ArrowRight,
  ClipboardCheck,
  CreditCard,
  Clock,
  Gift,
  Headphones,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  PackageCheck,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Ticket,
  TrendingUp,
  Truck,
  Upload,
  Users,
  WalletCards,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BottleArt } from "@tuti/shared/components/BottleArt.jsx";
import { EmptyState } from "@tuti/shared/components/EmptyState.jsx";
import { MetricCard } from "@tuti/shared/components/MetricCard.jsx";
import { PanelHeader } from "@tuti/shared/components/PanelHeader.jsx";
import { StatusBadge } from "@tuti/shared/components/StatusBadge.jsx";
import { formatCurrency } from "@tuti/shared/utils/money.js";
import { computeSellerHealth } from "@tuti/shared/utils/sellerHealth.js";
import { marketplaceApi, ordersApi, sellerDeliveryOffersApi, sellerDriversApi, sellerFinanceApi, supportTicketsApi, uploadApi } from "@tuti/shared/api/client.js";
import { useAuthStore } from "@tuti/shared/store/authStore.js";
import { GENDER_OPTIONS, SCENT_FAMILIES } from "@tuti/shared/constants";
import { getAllowedOrderActions } from "@tuti/shared/workflows";
import {
  SellerChecklistPanel,
  SellerInsightCard,
  SellerPageHeader,
  SellerQueuePanel,
} from "../shared/SellerDashboardPrimitives.jsx";
import {
  DEFAULT_BY_TYPE,
  SHOP_CATEGORIES,
  SHOP_TYPE_META,
  SupportPill,
  SellerSupportTicketDetail,
  driverMatchesBroadcastZone,
  driverStatusTone,
  formatCaseStatusLabel,
  formatDriverStatus,
  formatDriverVehicle,
  formatOfferCountdown,
  formatOfferExpiry,
  formatResolutionLabel,
  formatSellerOrderStatusLabel,
  formatSupportCategory,
  formatSupportDate,
  getShopType,
  getSellerPrimaryAction,
  getStockHealth,
  isDriverAssignableOrder,
  isSellerDriverActive,
  orderNextAction,
  ownShopOrder,
  productTypeLabel,
  renderOrderItemSummary,
  renderOrderMetadata,
  resolveOrderDeliveryZone,
  SUPPORT_CATEGORY_OPTIONS,
  SUPPORT_PRIORITY_OPTIONS,
  SUPPORT_STATUS_OPTIONS,
  supportOrderLabel,
  supportPriorityTone,
  supportStatusTone,
} from "../shared/sellerDashboardHelpers.jsx";

/* ─── Support tickets ────────────────────────────────────────── */
export function SellerSupportTickets({ seller, onOpenOrder = () => {} }) {
  const shop = seller?.shop;
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const shopId = shop?.id || user?.shopId || "";

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [category, setCategory] = useState("all");
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [createForm, setCreateForm] = useState({
    subject: "",
    category: "general",
    priority: "normal",
    orderId: "",
    description: "",
  });
  const [createError, setCreateError] = useState("");
  const [supportNotice, setSupportNotice] = useState("");
  const [replyDraft, setReplyDraft] = useState("");
  const [replyError, setReplyError] = useState("");
  const [queryTicketId, setQueryTicketId] = useState(() => new URLSearchParams(window.location.search).get("ticket") || "");

  const { data: ordersData, isLoading: ordersLoading, error: ordersError } = useQuery({
    queryKey: ["seller-support-orders", user?.sub],
    queryFn:  () => ordersApi.list({ limit: 100 }),
    enabled:  Boolean(user && shopId),
  });

  const ownOrders = useMemo(() => (ordersData?.orders || []).filter((order) => ownShopOrder(order, shopId)), [ordersData, shopId]);
  const orderMap = useMemo(() => new Map(ownOrders.map((order) => [order.orderId, order])), [ownOrders]);

  const { data: ticketsData, isLoading: ticketsLoading, error: ticketsError } = useQuery({
    queryKey: ["seller-support-tickets", user?.sub, search, status, priority, category],
    queryFn: () => supportTicketsApi.list({
      q: search.trim(),
      status: status === "all" ? "" : status,
      priority: priority === "all" ? "" : priority,
      category: category === "all" ? "" : category,
      limit: 100,
    }),
    enabled: Boolean(user && shopId),
    keepPreviousData: true,
  });

  const tickets = ticketsData?.tickets || [];
  const visibleTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter((ticket) => {
      const requester = [ticket.requesterName, ticket.requesterEmail, ticket.assignedToUserName, ticket.assignedToUserEmail].join(" ").toLowerCase();
      return [
        ticket.ticketNumber,
        ticket.subject,
        ticket.description,
        ticket.category,
        ticket.status,
        ticket.orderId,
        requester,
      ].some((value) => String(value || "").toLowerCase().includes(q));
    });
  }, [search, tickets]);

  const selectedTicketQuery = useQuery({
    queryKey: ["seller-support-ticket", selectedTicketId, user?.sub],
    queryFn: () => supportTicketsApi.get(selectedTicketId),
    enabled: Boolean(user && selectedTicketId),
  });

  const selectedTicket = selectedTicketQuery.data || visibleTickets.find((ticket) => ticket.id === selectedTicketId || ticket.ticketNumber === selectedTicketId) || null;

  useEffect(() => {
    setReplyDraft("");
    setReplyError("");
  }, [selectedTicketId]);

  useEffect(() => {
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
  }, [selectedTicketId, visibleTickets]);

  useEffect(() => {
    if (!supportNotice) return undefined;
    const timer = window.setTimeout(() => setSupportNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [supportNotice]);

  useEffect(() => {
    if (!selectedTicketId) return;
    const visible = visibleTickets.some((ticket) => ticket.id === selectedTicketId || ticket.ticketNumber === selectedTicketId);
    if (!visible) return;
    setReplyError("");
  }, [selectedTicketId, visibleTickets]);

  useEffect(() => {
    function syncTicketFromQuery() {
      setQueryTicketId(new URLSearchParams(window.location.search).get("ticket") || "");
    }
    syncTicketFromQuery();
    window.addEventListener("popstate", syncTicketFromQuery);
    return () => window.removeEventListener("popstate", syncTicketFromQuery);
  }, []);

  useEffect(() => {
    if (!queryTicketId) return;
    if (selectedTicketId !== queryTicketId) setSelectedTicketId(queryTicketId);
  }, [queryTicketId, selectedTicketId]);

  const openCount = tickets.filter((ticket) => ticket.status === "Open").length;
  const waitingCount = tickets.filter((ticket) => ["Waiting for Customer", "Waiting for Seller", "Waiting for Driver"].includes(ticket.status)).length;
  const resolvedCount = tickets.filter((ticket) => ["Resolved", "Closed"].includes(ticket.status)).length;

  const orderOptions = useMemo(() => ([
    { value: "", label: "No order link" },
    ...ownOrders.map((order) => ({
      value: order.orderId,
      label: `${order.orderId} · ${formatSellerOrderStatusLabel(order.status || "Pending")}`,
    })),
  ]), [ownOrders]);

  const createMutation = useMutation({
    mutationFn: (payload) => supportTicketsApi.create(payload),
    onSuccess: (created) => {
      setCreateError("");
      setSupportNotice("Support ticket created.");
      setCreateForm({
        subject: "",
        category: "general",
        priority: "normal",
        orderId: "",
        description: "",
      });
      qc.invalidateQueries({ queryKey: ["seller-support-tickets"] });
      if (created?.id || created?.ticketNumber) {
        setSelectedTicketId(created.id || created.ticketNumber);
      }
    },
    onError: (error) => setCreateError(error?.message || "Failed to create support ticket."),
  });

  const replyMutation = useMutation({
    mutationFn: ({ ticketId, message }) => supportTicketsApi.reply(ticketId, { message }),
    onSuccess: () => {
      setReplyDraft("");
      setReplyError("");
      setSupportNotice("Reply sent.");
      qc.invalidateQueries({ queryKey: ["seller-support-tickets"] });
      qc.invalidateQueries({ queryKey: ["seller-support-ticket", selectedTicketId] });
    },
    onError: (error) => setReplyError(error?.message || "Unable to send the reply."),
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

  if (!shop) return <EmptyState icon={Ticket} text="Loading support tickets…" />;

  const loadingError = ticketsError || ordersError;

  return (
    <div className="sd-section support-page-section">
      <SellerPageHeader
        eyebrow="Help & Support"
        title="Support"
        subtitle="Use Support for general shop, account, product, or platform help. Formal order/payment/refund disputes remain in the order dispute flow."
        meta={(
          <span className="sd-type-pill sd-type-pill--sm">
            <MessageSquare size={12} />
            Shop help
          </span>
        )}
      />

      <div className="sd-support-bridge panel">
        <div>
          <span className="sd-support-eyebrow">Support is separate from disputes</span>
          <h3>Use Support for general help. Formal disputes stay in Orders.</h3>
          <p>Keep shop, account, product, and platform questions here. If the issue affects refund, delivery, payment, or order outcome, use the dispute flow from the order details screen.</p>
        </div>
        <div className="sd-support-bridge-points">
          <span><MessageSquare size={13} />General help cases</span>
          <span><ShieldCheck size={13} />Disputes remain order-linked</span>
        </div>
      </div>

      <section className="sd-metric-grid">
        <MetricCard icon={Ticket}            label="Open"      value={openCount}                      note="Needs attention" />
        <MetricCard icon={Clock}             label="Waiting"   value={waitingCount}                   note="Awaiting reply" />
        <MetricCard icon={ShieldCheck}       label="Resolved"  value={resolvedCount}                  note="Closed or done" />
        <MetricCard icon={PackageCheck}      label="Linked"    value={tickets.filter((ticket) => Boolean(ticket.orderId)).length} note="Order context" />
      </section>

      {supportNotice ? <div className="sd-support-success-strip">{supportNotice}</div> : null}

      <section className="sd-support-layout">
        <div className="sd-support-stack">
          <div className="sd-panel">
            <PanelHeader icon={Ticket} title="Create support ticket" action="General help only" />
            <form className="sd-support-form" onSubmit={handleCreateSubmit}>
              <p className="sd-support-note">
                Use Support for general shop, account, product, or platform help. Formal order/payment/refund disputes remain in the order dispute flow.
              </p>
              <div className="sd-field-grid">
                <label className="sd-field wide">
                  <span>Subject</span>
                  <input
                    value={createForm.subject}
                    onChange={(e) => setCreateForm((current) => ({ ...current, subject: e.target.value }))}
                    placeholder="What do you need help with?"
                  />
                </label>
                <label className="sd-field">
                  <span>Category</span>
                  <select
                    value={createForm.category}
                    onChange={(e) => setCreateForm((current) => ({ ...current, category: e.target.value }))}
                  >
                    {SUPPORT_CATEGORY_OPTIONS.filter((item) => item.value !== "all").map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <label className="sd-field">
                  <span>Priority</span>
                  <select
                    value={createForm.priority}
                    onChange={(e) => setCreateForm((current) => ({ ...current, priority: e.target.value }))}
                  >
                    {SUPPORT_PRIORITY_OPTIONS.filter((item) => item !== "all").map((value) => (
                      <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>
                    ))}
                  </select>
                </label>
                <label className="sd-field wide">
                  <span>Linked order (optional)</span>
                  <select
                    value={createForm.orderId}
                    onChange={(e) => setCreateForm((current) => ({ ...current, orderId: e.target.value }))}
                    disabled={ordersLoading && ownOrders.length === 0}
                  >
                    {orderOptions.map((option) => (
                      <option key={option.value || "no-order"} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="sd-field wide">
                  <span>Description</span>
                  <textarea
                    rows={5}
                    value={createForm.description}
                    onChange={(e) => setCreateForm((current) => ({ ...current, description: e.target.value }))}
                    placeholder="Describe the issue, question, or help request in a few clear sentences."
                  />
                </label>
              </div>
              {createError ? <p className="sd-modal-error">{createError}</p> : null}
              <div className="sd-support-actions">
                <button className="primary-action compact" type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating…" : "Create ticket"}
                </button>
              </div>
            </form>
          </div>

          <div className="sd-panel">
            <div className="sd-support-toolbar">
              <PanelHeader icon={Ticket} title="Support tickets" action={`${visibleTickets.length} shown`} />
              <div className="sd-support-filter-bar">
                <label className="sd-search">
                  <Search size={15} />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ticket ref, subject, requester…" />
                </label>
                <label className="sd-field sd-support-select">
                  <span>Status</span>
                  <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    {SUPPORT_STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item === "all" ? "All" : item}</option>)}
                  </select>
                </label>
                <label className="sd-field sd-support-select">
                  <span>Priority</span>
                  <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                    {SUPPORT_PRIORITY_OPTIONS.map((item) => <option key={item} value={item}>{item === "all" ? "All" : item.charAt(0).toUpperCase() + item.slice(1)}</option>)}
                  </select>
                </label>
                <label className="sd-field sd-support-select">
                  <span>Category</span>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    {SUPPORT_CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
              </div>
            </div>

            {loadingError ? <div className="sd-drivers-error">Unable to load support tickets. {loadingError.message || loadingError}</div> : null}
            {ticketsLoading && !tickets.length ? (
              <div className="sd-loading">Loading support tickets…</div>
            ) : visibleTickets.length === 0 ? (
              <EmptyState
                icon={Ticket}
                text={search || status !== "all" || priority !== "all" || category !== "all"
                  ? "No support tickets match your filters."
                  : "No support tickets yet. Use Support for general help; formal disputes stay in the order dispute flow."}
              />
            ) : (
              <div className="sd-support-list">
                {visibleTickets.map((ticket) => {
                  const isActive = selectedTicketId === ticket.id || selectedTicketId === ticket.ticketNumber;
                  const linkedOrder = ticket.orderId ? orderMap.get(ticket.orderId) || null : null;
                  return (
                    <button
                      className={isActive ? "sd-support-row sd-support-row--active" : "sd-support-row"}
                      type="button"
                      key={ticket.id || ticket.ticketNumber}
                      onClick={() => setSelectedTicketId(ticket.id || ticket.ticketNumber)}
                    >
                      <div className="sd-support-row-main">
                        <div className="sd-support-row-head">
                          <strong>{ticket.ticketNumber}</strong>
                          <span>{ticket.subject}</span>
                        </div>
                        <p>{ticket.description}</p>
                        <div className="sd-support-row-meta">
                          <span>{formatSupportCategory(ticket.category)}</span>
                          <span>{ticket.requesterName || ticket.requesterEmail || ticket.requesterRole || "Requester"}</span>
                          <span>{ticket.orderId ? supportOrderLabel(linkedOrder || { orderId: ticket.orderId, status: "" }) : "No order link"}</span>
                          <span>Updated {formatSupportDate(ticket.updatedAt)}</span>
                        </div>
                      </div>
                      <div className="sd-support-row-side">
                        <SupportPill value={ticket.status || "Open"} />
                        <SupportPill kind="priority" value={ticket.priority || "normal"} />
                        <span className="sd-support-row-ref">Created {formatSupportDate(ticket.createdAt)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <SellerSupportTicketDetail
          ticket={selectedTicket}
          orderMap={orderMap}
          onOpenOrder={onOpenOrder}
          replyDraft={replyDraft}
          setReplyDraft={setReplyDraft}
          replySaving={replyMutation.isPending}
          replyError={replyError}
          loading={selectedTicketQuery.isLoading}
          loadError={selectedTicketQuery.error?.message || ""}
          onReply={handleReplySubmit}
        />
      </section>
    </div>
  );
}
