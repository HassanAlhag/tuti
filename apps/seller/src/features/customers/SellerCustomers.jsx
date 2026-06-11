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

/* ─── Customers ────────────────────────────────────────────────── */
export function SellerCustomers({ seller }) {
  const { user }  = useAuthStore();
  const customers = seller?.customers || [];
  const [query, setQuery] = useState("");

  const { data } = useQuery({
    queryKey: ["seller-customer-orders", user?.sub],
    queryFn:  () => ordersApi.list({ limit: 50 }),
    enabled:  Boolean(user),
  });

  const orders = data?.orders || [];
  const orderMap = useMemo(() => {
    const map = new Map();
    for (const o of orders) {
      const cur = map.get(o.customerEmail) || { count: 0, value: 0 };
      cur.count++;
      cur.value += o.subtotal;
      map.set(o.customerEmail, cur);
    }
    return map;
  }, [orders]);

  const filtered = customers.filter((c) => {
    const q = query.trim().toLowerCase();
    return !q || [c.name, c.email, c.phone, c.segment, c.city, ...(c.tags || [])].join(" ").toLowerCase().includes(q);
  });

  const openTickets = customers.reduce((s, c) => s + c.openTickets, 0);
  const repeats     = customers.filter((c) => c.orders > 1).length;

  return (
    <div className="sd-section">
      <div className="sd-section-header">
        <div>
          <h2 className="sd-section-title">Customers</h2>
          <p className="sd-section-sub">{customers.length} known buyers · {repeats} repeat</p>
        </div>
      </div>

      <section className="sd-metric-grid">
        <MetricCard icon={Users}           label="Known"    value={customers.length}                                       note={`${repeats} repeat`} />
        <MetricCard icon={BadgeDollarSign} label="LTV"      value={formatCurrency(customers.reduce((s, c) => s + c.lifetimeValue, 0))} note="All buyers" />
        <MetricCard icon={Headphones}      label="Tickets"  value={openTickets}                                            note="Open issues" />
        <MetricCard icon={Star}            label="VIP"      value={customers.filter((c) => c.status === "VIP").length}     note="High-touch" />
      </section>

      <div className="sd-panel">
        <div className="sd-toolbar">
          <label className="sd-search">
            <Search size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, city, tag…" />
          </label>
          <span className="sd-toolbar-count">
            {query ? `${filtered.length} of ${customers.length}` : `${customers.length} customer${customers.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Users} text={query ? "No customers match." : "No customers yet."} />
        ) : (
          <div className="sd-customer-grid">
            {filtered.map((c) => {
              const shopData = orderMap.get(c.email);
              const riskTone = c.risk === "High" ? "danger" : c.risk === "Medium" ? "warning" : "success";
              return (
                <article className="sd-customer-card" key={c.id}>
                  <div className="sd-customer-head">
                    <span className="sd-customer-avatar">{c.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}</span>
                    <div className="sd-customer-meta">
                      <strong>{c.name}</strong>
                      <span>{c.segment}</span>
                    </div>
                    <span className={`risk ${riskTone}`}>{c.risk}</span>
                  </div>

                  <div className="sd-customer-kpis">
                    <div className="sd-kpi">
                      <strong>{shopData?.count || 0}</strong>
                      <span>Orders</span>
                    </div>
                    <div className="sd-kpi">
                      <strong>{formatCurrency(shopData?.value || 0)}</strong>
                      <span>Value</span>
                    </div>
                    <div className="sd-kpi">
                      <strong>{c.loyaltyPoints}</strong>
                      <span>Points</span>
                    </div>
                  </div>

                  <div className="sd-customer-contact">
                    <span><Mail size={12} />{c.email}</span>
                    <span><Phone size={12} />{c.phone}</span>
                    <span><MapPin size={12} />{c.city}</span>
                    {c.lastOrderAt && <span><CalendarClock size={12} />Last order {c.lastOrderAt}</span>}
                  </div>

                  {(c.preferredCategories || []).length > 0 && (
                    <div className="sd-tags">
                      {c.preferredCategories.slice(0, 3).map((t) => <span key={t}>{t}</span>)}
                    </div>
                  )}

                  {c.notes && <p className="sd-customer-note">{c.notes}</p>}

                  <div className="sd-customer-actions">
                    <button className="secondary-action compact" type="button"><MessageSquare size={13} />Message</button>
                    <button className="ghost-action compact" type="button"><CalendarClock size={13} />Occasion</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
