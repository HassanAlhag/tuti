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

export function AdminClients({ adminData }) {
  const customers = adminData.customers || [];
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [page, setPage] = useState(1);

  const segments = useMemo(() => ["all", ...new Set(customers.map((customer) => customer.segment))], [customers]);
  const customerDirectory = useQuery({
    queryKey: ["admin-customers", query, segment, riskFilter, page],
    queryFn: () => marketplaceApi.listAdminCustomers({
      q: query,
      segment: segment === "all" ? "" : segment,
      risk: riskFilter === "all" ? "" : riskFilter,
      page,
      limit: 6,
    }),
    keepPreviousData: true,
  });
  const filteredCustomers = customerDirectory.data?.customers || [];
  const directoryTotal = customerDirectory.data?.total ?? customers.length;
  const directoryPages = customerDirectory.data?.pages || 1;

  const totalLtv = customers.reduce((sum, customer) => sum + customer.lifetimeValue, 0);
  const openTickets = customers.reduce((sum, customer) => sum + customer.openTickets, 0);
  const vipCustomers = customers.filter((customer) => customer.status === "VIP").length;
  const atRiskCustomers = customers.filter((customer) => customer.risk !== "Low" || customer.openTickets > 0);

  return (
    <main className="workspace">
      <PageTitle
        kicker="Client management"
        title="Customer intelligence"
        description="Manage client value, support risk, loyalty, preferred occasions, and care follow-ups from one operational view."
      />

      <section className="metric-grid">
        <MetricCard icon={Users} label="Clients" value={customers.length} note={`${vipCustomers} VIP accounts`} />
        <MetricCard icon={CircleDollarSign} label="Lifetime value" value={formatCurrency(totalLtv)} note="Across seeded profiles" />
        <MetricCard icon={Headphones} label="Open tickets" value={openTickets} note="Needs service action" />
        <MetricCard icon={AlertTriangle} label="Risk watch" value={atRiskCustomers.length} note="Medium/high or open issues" />
      </section>

      <section className="management-toolbar">
        <label className="management-search">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            placeholder="Search client, phone, city, tag..."
          />
        </label>
        <div className="segment-tabs" aria-label="Client segments">
          {segments.map((item) => (
            <button
              key={item}
              className={segment === item ? "filter-tab active" : "filter-tab"}
              onClick={() => { setSegment(item); setPage(1); }}
              type="button"
            >
              {item === "all" ? "All clients" : item}
            </button>
          ))}
          {["all", "Low", "Medium", "High"].map((risk) => (
            <button
              key={risk}
              className={riskFilter === risk ? "filter-tab active" : "filter-tab"}
              onClick={() => { setRiskFilter(risk); setPage(1); }}
              type="button"
            >
              {risk === "all" ? "All risk" : `${risk} risk`}
            </button>
          ))}
        </div>
      </section>

      <section className="dashboard-grid split-strong">
        <section className="panel">
          <PanelHeader icon={UserCheck} title="Client directory" action={`${directoryTotal} matched`} />
          <div className="customer-management-grid">
            {filteredCustomers.map((customer) => (
              <article className="customer-card" key={customer.id}>
                <div className="customer-card-head">
                  <span className="customer-avatar">{customer.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
                  <div>
                    <h3>{customer.name}</h3>
                    <p>{customer.segment} · {customer.city}</p>
                  </div>
                  <span className={`risk ${managementRiskClass(customer.risk)}`}>{customer.risk}</span>
                </div>

                <div className="customer-kpi-row">
                  <span><strong>{customer.orders}</strong> Orders</span>
                  <span><strong>{formatCurrency(customer.lifetimeValue)}</strong> LTV</span>
                  <span><strong>{customer.loyaltyPoints}</strong> Points</span>
                </div>

                <div className="customer-contact">
                  <span><Mail size={14} /> {customer.email}</span>
                  <span><Phone size={14} /> {customer.phone}</span>
                  <span><CalendarClock size={14} /> Last order {customer.lastOrderAt}</span>
                </div>

                <div className="customer-tags">
                  {[customer.status, ...(customer.tags || [])].slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}
                </div>

                <p className="customer-note">{customer.notes}</p>

                <div className="seller-action-row">
                  <button className="secondary-action compact" type="button">
                    <MessageSquare size={15} />
                    Service note
                  </button>
                  <button className="ghost-action compact" type="button">
                    <Eye size={15} />
                    View history
                  </button>
                </div>
              </article>
            ))}
          </div>
          <div className="directory-pagination">
            <button className="ghost-action compact" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">
              Previous
            </button>
            <span>Page {page} of {directoryPages}</span>
            <button className="ghost-action compact" disabled={page >= directoryPages} onClick={() => setPage((current) => Math.min(directoryPages, current + 1))} type="button">
              Next
            </button>
          </div>
        </section>

        <aside className="panel">
          <PanelHeader icon={Headphones} title="Care queue" action={`${atRiskCustomers.length} priority`} />
          <div className="management-priority-list">
            {atRiskCustomers.map((customer) => (
              <article className="management-priority-row" key={customer.id}>
                <span className={`priority-dot ${managementRiskClass(customer.risk)}`} />
                <div>
                  <strong>{customer.name}</strong>
                  <p>{customer.openTickets} open ticket{customer.openTickets === 1 ? "" : "s"} · {customer.notes}</p>
                </div>
                <button className="icon-button" title="Open client" type="button">
                  <Eye size={17} />
                </button>
              </article>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}

/* ─── Per-seller payment rules editor ──────────────────────────── */
