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

export function AdminShops({ adminData, updateProductStatus, focusedShopId = "", onFocusHandled = () => {}, onGoToSection = null }) {
  const qc = useQueryClient();
  const { shops, products } = adminData;
  const [query, setQuery]           = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedRules, setExpandedRules] = useState(null);
  const [contractModal, setContractModal] = useState(null);
  const [contractForm, setContractForm] = useState({ note: "", deadline: "" });
  const [contractError, setContractError] = useState("");
  const [localContractNotices, setLocalContractNotices] = useState({});
  const filteredShops = shops.filter((shop) => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || [shop.name, shop.owner, shop.city, shop.status, shop.category].filter(Boolean).join(" ").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || shop.status === statusFilter;
    return matchesQuery && matchesStatus;
  });
  const sellerWatch = shops.filter((shop) => shop.status !== "Approved" || shop.disputeRate >= 2 || shop.fulfillmentRate < 92);
  const approvedCount = shops.filter((shop) => shop.status === "Approved").length;
  const pendingReviewCount = shops.filter((shop) => shop.status === "Pending review").length;
  const suspendedCount = shops.filter((shop) => shop.status === "Suspended").length;
  const terminatedCount = shops.filter((shop) => shop.status === "Terminated").length;
  const atRiskWarningCount = shops.filter((shop) => {
    const cHealth = computeSellerHealth(shop, products.filter((p) => p.shopId === shop.id));
    return cHealth.level === "At Risk" || cHealth.level === "Warning";
  }).length;
  const pendingProductsCount = products.filter((product) => product.status === "Needs approval").length;
  const contractStateLabel = (status) => status || "Pending review";
  const contractActionTypeMap = {
    warning: "warning",
    actionPlan: "action_plan_request",
    suspend: "suspend",
    reactivate: "reactivate",
    terminate: "terminate",
  };
  const noticeToneByType = (type) => {
    if (type === "warning" || type === "action_plan_request") return "warning";
    if (type === "suspend" || type === "terminate") return "danger";
    if (type === "reactivate") return "success";
    return "neutral";
  };

  const contractActionMutation = useMutation({
    mutationFn: async ({ shopId, payload, mode }) => (
      mode === "notice"
        ? marketplaceApi.addShopAdminNotice(shopId, payload)
        : marketplaceApi.updateShopContractStatus(shopId, payload)
    ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-data"] });
      closeContractModal();
    },
    onError: (error, variables) => {
      if (variables?.fallbackNotice && variables?.shopId) {
        setLocalContractNotices((current) => ({
          ...current,
          [variables.shopId]: [variables.fallbackNotice, ...(current[variables.shopId] || [])].slice(0, 3),
        }));
      }
      setContractError(error?.message || "Unable to save this contract action right now.");
    },
  });

  function openContractModal(shop, action) {
    setContractError("");
    setContractForm({ note: "", deadline: "" });
    setContractModal({
      shopId: shop.id,
      shopName: shop.name,
      action,
    });
  }

  function closeContractModal() {
    setContractModal(null);
    setContractError("");
    setContractForm({ note: "", deadline: "" });
  }

  function confirmContractAction() {
    if (!contractModal) return;
    if (!contractForm.note.trim()) {
      setContractError("An admin note is required before confirming this action.");
      return;
    }
    const actionType = contractActionTypeMap[contractModal.action.key];
    if (!actionType) {
      setContractError("Unsupported contract action.");
      return;
    }

    const isNoticeAction = contractModal.action.key === "warning" || contractModal.action.key === "actionPlan";
    const payload = {
      note: contractForm.note.trim(),
      deadline: contractModal.action.deadline ? contractForm.deadline || "" : "",
      status: "active",
      ...(isNoticeAction
        ? { type: actionType }
        : {
            action: actionType,
            ...(contractModal.action.key === "terminate"
              ? { contractTerminationReason: contractForm.note.trim() }
              : {}),
          }),
    };

    const noticeFallback = {
      id: `${contractModal.shopId}-${Date.now()}`,
      type: actionType,
      note: contractForm.note.trim(),
      deadline: contractModal.action.deadline ? contractForm.deadline || "" : "",
      issuedBy: "admin",
      issuedAt: new Date().toISOString(),
      status: "active",
    };

    if (isNoticeAction) {
      contractActionMutation.mutate({ shopId: contractModal.shopId, payload, mode: "notice", fallbackNotice: noticeFallback });
      return;
    }

    contractActionMutation.mutate({ shopId: contractModal.shopId, payload, mode: "contract", fallbackNotice: noticeFallback });
  }

  return (
    <main className="workspace">
      <PageTitle
        kicker="Seller management"
        title="Seller control center"
        description="Review seller accounts, approval queues, fulfillment quality, dispute risk, and payout readiness."
      />

      <section className="metric-grid">
        <MetricCard icon={Warehouse} label="Seller accounts" value={shops.length} note={`${shops.filter((shop) => shop.status === "Approved").length} approved`} />
        <MetricCard icon={AlertTriangle} label="Watch list" value={sellerWatch.length} note="Verification or quality risk" />
        <MetricCard icon={ClipboardCheck} label="Pending products" value={products.filter((product) => product.status === "Needs approval").length} note="Awaiting review" />
        <MetricCard icon={WalletCards} label="Pending balances" value={formatCurrency(shops.reduce((sum, shop) => sum + shop.pendingBalance, 0))} note="Across sellers" />
      </section>

      <section className="admin-seller-summary">
        <span className="admin-seller-chip"><strong>{shops.length}</strong>Total sellers</span>
        <span className="admin-seller-chip"><strong>{approvedCount}</strong>Approved</span>
        <span className="admin-seller-chip"><strong>{pendingReviewCount}</strong>Pending review</span>
        <span className="admin-seller-chip admin-seller-chip--warn"><strong>{suspendedCount}</strong>Suspended</span>
        <span className="admin-seller-chip admin-seller-chip--danger"><strong>{terminatedCount}</strong>Terminated</span>
        <span className="admin-seller-chip admin-seller-chip--warn"><strong>{atRiskWarningCount}</strong>At Risk / Warning</span>
        <span className="admin-seller-chip"><strong>{pendingProductsCount}</strong>Pending products</span>
      </section>

      <section className="management-toolbar">
        <label className="management-search">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search seller, owner, city..." />
        </label>
        <div className="segment-tabs" aria-label="Seller status">
          {["all", "Approved", "Pending review"].map((status) => (
            <button
              key={status}
              className={statusFilter === status ? "filter-tab active" : "filter-tab"}
              onClick={() => setStatusFilter(status)}
              type="button"
            >
              {status === "all" ? "All sellers" : status}
            </button>
          ))}
        </div>
      </section>

      <section className="admin-shops-grid">
        {filteredShops.map((shop) => {
          const shopProducts = products.filter((p) => p.shopId === shop.id);
          const liveCount    = shopProducts.filter((p) => p.status === "Live").length;
          const pendingCount = shopProducts.filter((p) => p.status === "Needs approval").length;
          const health   = getSellerHealth(shop, pendingCount);
          const cHealth  = computeSellerHealth(shop, shopProducts);
          const contractActions = getContractControlActions(shop, cHealth);
          const notices = (shop.adminNotices && shop.adminNotices.length ? shop.adminNotices : localContractNotices[shop.id]) || [];
          const riskReasons = (cHealth.improvements || []).slice(0, 2);
          const createdLabel = (createdAt) => (createdAt ? new Date(createdAt).toLocaleString() : "—");
          const pendingProducts = shopProducts.filter((p) => p.status === "Needs approval");
          const noticeTypeLabel = (type) => {
            if (type === "action_plan_request") return "Action plan request";
            if (type === "reactivate") return "Reactivated";
            if (type === "suspend") return "Suspended";
            if (type === "terminate") return "Termination";
            return "Warning";
          };
          const shopCategories = [...new Set(shopProducts.map((p) => p.category).filter(Boolean))];
  const groupedNotices = notices.reduce((acc, notice) => {
            const key = notice.type || notice.actionKey || "warning";
            if (!acc[key]) acc[key] = [];
            acc[key].push(notice);
            return acc;
  }, {});

  useEffect(() => {
    if (!focusedShopId) return;
    const found = shops.find((shop) => shop.id === focusedShopId);
    if (!found) {
      onFocusHandled("Seller not found or not visible.");
      return;
    }
    if (statusFilter !== "all") setStatusFilter("all");
    if (query) setQuery("");
    onFocusHandled("");
  }, [focusedShopId, shops, statusFilter, query, onFocusHandled]);

          return (
            <article className={`admin-shop-card${focusedShopId && focusedShopId === shop.id ? " admin-shop-card--focused" : ""}`} key={shop.id}>
              <div className="admin-shop-head">
                <div className="shop-avatar admin-avatar">{shop.avatar}</div>
                <div className="admin-shop-identity">
                  <h3>{shop.name}</h3>
                  <span>{shop.owner} · {shop.city}</span>
                  <small>
                    {(shop.cover || "Coverage not set")}
                    {shopCategories.length > 0 ? ` · ${shopCategories.join(", ")}` : ""}
                  </small>
                </div>
                <StatusBadge status={shop.status} />
              </div>

              {shop.sellerApplicationId && (
                <div className="admin-shop-app-badge">
                  <FileText size={11} />
                  <span>Converted from Seller Application</span>
                  <code className="admin-shop-app-ref">{shop.sellerApplicationId}</code>
                  {shop.applicationContractStatus && (
                    <span>· Contract: {shop.applicationContractStatus}</span>
                  )}
                  {onGoToSection && (
                    <button
                      className="admin-shop-app-link"
                      type="button"
                      onClick={() => onGoToSection("seller-pipeline")}
                    >
                      View in Pipeline
                    </button>
                  )}
                </div>
              )}

              <div className="seller-health-row">
                <span className={`seller-health-badge ${health.tone}`}>{health.label}</span>
                <span className={`ac-health-chip ac-health-chip--${cHealth.tone}`}>{cHealth.score} · {cHealth.level}</span>
                <span><MapPin size={14} /> {shop.cover}</span>
              </div>
              <div className="admin-contract-strip">
                <span><strong>Contract</strong>{contractStateLabel(shop.status)}</span>
                <span><strong>Health</strong>{cHealth.level}</span>
                <span><strong>Notices</strong>{notices.length}</span>
                <span><strong>Pending</strong>{pendingCount}</span>
              </div>
              <div className="admin-health-kpis">
                <span><strong>{shop.fulfillmentRate}%</strong> Fulfillment</span>
                <span><strong>{shop.disputeRate}%</strong> Dispute rate</span>
                <span><strong>{shop.serviceRating}</strong> Rating</span>
                <span><strong>{liveCount}</strong> Live products</span>
              </div>
              {riskReasons.length > 0 ? (
                <div className="admin-risk-reasons">
                  {riskReasons.map((reason) => (
                    <p key={reason}>{reason}</p>
                  ))}
                </div>
              ) : null}
              {shop.disputeRate >= 2 && (
                <div className="admin-shop-dispute-alert">
                  <AlertTriangle size={12} />
                  {shop.disputeRate}% dispute rate — review payout rules
                </div>
              )}
              <div
                className="admin-shop-fulfillment-bar"
                title={`${shop.fulfillmentRate}% fulfillment`}
              >
                <div
                  className="admin-shop-fulfillment-fill"
                  style={{
                    width: `${shop.fulfillmentRate}%`,
                    background: shop.fulfillmentRate >= 95 ? "var(--success)" : shop.fulfillmentRate >= 90 ? "var(--amber)" : "var(--danger)",
                  }}
                />
              </div>

              <div className="admin-shop-stats">
                <div className="admin-stat">
                  <strong>{shop.fulfillmentRate}%</strong>
                  <span>Fulfillment</span>
                </div>
                <div className="admin-stat">
                  <strong>{shop.disputeRate}%</strong>
                  <span>Disputes</span>
                </div>
                <div className="admin-stat">
                  <strong>{shop.serviceRating}</strong>
                  <span>Rating</span>
                </div>
                <div className="admin-stat">
                  <strong>{shop.commissionRate}%</strong>
                  <span>Commission</span>
                </div>
              </div>

              <div className="admin-shop-inventory">
                <span>{liveCount} live · {pendingCount} pending</span>
                <strong>{shop.commissionRate}% commission · {formatCurrency(shop.pendingBalance)} hold</strong>
              </div>

              <div className="seller-action-row">
                <button className="secondary-action compact" type="button">
                  <Eye size={15} />
                  Review seller
                </button>
                <button className="ghost-action compact" type="button">
                  <MessageSquare size={15} />
                  Message
                </button>
                <button className="ghost-action compact" type="button">
                  <PauseCircle size={15} />
                  Hold payout
                </button>
                <button
                  className={expandedRules === shop.id ? "secondary-action compact" : "ghost-action compact"}
                  type="button"
                  onClick={() => setExpandedRules(expandedRules === shop.id ? null : shop.id)}
                >
                  <Settings2 size={15} />
                  Payment rules
                </button>
              </div>

              <div className="contract-control-row">
                {shop.status === "Terminated" ? (
                  <div className="contract-final-state">
                    <XCircle size={14} />
                    Seller marked as terminated. Contract actions are closed.
                  </div>
                ) : (
                  contractActions.map((action) => {
                    const Icon = action.Icon;
                    return (
                      <button
                        className={`ghost-action compact admin-contract-action admin-contract-action--${action.tone}`}
                        key={action.key}
                        onClick={() => openContractModal(shop, action)}
                        type="button"
                      >
                        <Icon size={14} />
                        {action.label}
                      </button>
                    );
                  })
                )}
              </div>

              {notices.length > 0 ? (
                <div className="admin-notices-list">
                  <strong className="admin-notices-title">Admin notices</strong>
                  {Object.entries(groupedNotices).map(([type, items]) => (
                    <div className="admin-notice-group" key={type}>
                      <div className="admin-notice-group-head">
                        <span>{noticeTypeLabel(type)}</span>
                        <small>{items.length}</small>
                      </div>
                      {items.map((notice) => (
                        <div
                          className={`admin-notice${noticeToneByType(notice.type || notice.actionKey) === "neutral" ? "" : ` admin-notice--${noticeToneByType(notice.type || notice.actionKey)}`}`}
                          key={notice.id}
                        >
                          <div className="admin-notice-head">
                            <span>{noticeTypeLabel(notice.type || notice.actionKey)}</span>
                            <small>{createdLabel(notice.issuedAt || notice.createdAt)}</small>
                          </div>
                          <div className="admin-notice-meta">
                            <small>Type: {notice.type || notice.actionKey}</small>
                            <small className="admin-notice-local">{notice.status || "active"}</small>
                          </div>
                          <p>{notice.note}</p>
                          {notice.deadline ? <small>Deadline: {notice.deadline}</small> : null}
                          {notice.sellerPlan ? (
                            <div className="admin-notice-seller-plan">
                              <strong>Seller action plan</strong>
                              <p>{notice.sellerPlan}</p>
                              <small>Submitted: {createdLabel(notice.sellerPlanAt)}</small>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}

              {expandedRules === shop.id && (
                <SellerPaymentRulesPanel
                  shop={shop}
                  onSaved={() => setExpandedRules(null)}
                />
              )}

              {pendingCount > 0 && (
                <div className="admin-shop-products">
                  <div className="admin-shop-products-head">
                    <strong>{pendingProducts.length} pending product{pendingProducts.length === 1 ? "" : "s"}</strong>
                    <small>Approve or reject to keep catalog quality high</small>
                  </div>
                  {pendingProducts.map((product) => (
                      <div className="admin-mini-product" key={product.id}>
                        <BottleArt product={product} compact />
                        <div className="admin-mini-product-info">
                          <span>
                            {product.name}
                            {product.sellerLastEditedAt && (
                              <span className="ac-resubmit-badge ac-resubmit-badge--inline">Re-submitted</span>
                            )}
                          </span>
                          <small>{product.category} · {product.status}</small>
                        </div>
                        <div className="row-actions">
                          {getAllowedProductActions(product.status, "admin").map((status) => {
                            const meta = PRODUCT_ACTION_META[status];
                            if (!meta) return null;
                            const Icon = meta.Icon;
                            return (
                              <button
                                className={meta.className}
                                key={status}
                                onClick={() => updateProductStatus(product.id, status)}
                                title={meta.title}
                                type="button"
                              >
                                <Icon size={16} />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </article>
          );
        })}
      </section>

      {contractModal ? (
        <div className="admin-contract-modal-backdrop" role="presentation">
          <div aria-modal="true" className="admin-contract-modal" role="dialog">
            <div className="admin-contract-modal-head">
              <strong>Confirm Contract Action: {contractModal.action.label}</strong>
              <button className="icon-button" onClick={closeContractModal} title="Close" type="button">
                <XCircle size={16} />
              </button>
            </div>
            <p className="admin-contract-modal-sub">
              {contractModal.shopName}
            </p>
            {(contractModal.action.key === "suspend" || contractModal.action.key === "terminate") ? (
              <p className="admin-contract-modal-warning">
                This is a high-impact seller control action. Confirm reason and evidence in your note before proceeding.
              </p>
            ) : null}
            <label className="admin-contract-field">
              <span>Admin note (required)</span>
              <textarea
                rows={4}
                value={contractForm.note}
                onChange={(event) => setContractForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="Summarize risk signals, expected actions, and context for follow-up."
              />
            </label>
            {contractModal.action.deadline ? (
              <label className="admin-contract-field">
                <span>Deadline (optional)</span>
                <input
                  type="date"
                  value={contractForm.deadline}
                  onChange={(event) => setContractForm((current) => ({ ...current, deadline: event.target.value }))}
                />
              </label>
            ) : null}
            {contractError ? <p className="admin-contract-error">{contractError}</p> : null}
            <div className="admin-contract-modal-actions">
              <button className="secondary-action compact" disabled={contractActionMutation.isPending} onClick={confirmContractAction} type="button">
                {contractActionMutation.isPending ? "Saving…" : "Confirm"}
              </button>
              <button className="ghost-action compact" onClick={closeContractModal} type="button">
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
