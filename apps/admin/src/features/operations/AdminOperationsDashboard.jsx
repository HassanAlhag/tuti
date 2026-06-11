import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeDollarSign,
  BarChart2,
  Clock,
  CreditCard,
  Headphones,
  LayoutDashboard,
  LockKeyhole,
  Package,
  Settings2,
  Ticket,
  Truck,
  WalletCards,
  ArrowRight,
} from "lucide-react";
import { adminOperationsApi } from "@tuti/shared/api/client.js";
import { EmptyState } from "@tuti/shared/components/EmptyState.jsx";
import { PageTitle } from "@tuti/shared/components/PageTitle.jsx";
import { PanelHeader } from "@tuti/shared/components/PanelHeader.jsx";
import { StatusBadge } from "@tuti/shared/components/StatusBadge.jsx";
import { formatCurrency } from "@tuti/shared/utils/money.js";

const QUEUE_LIMIT_OPTIONS = [5, 10];

const snapshotIconMap = {
  newOrders: Package,
  readyForDelivery: Truck,
  activeDeliveryOffers: Ticket,
  assignedDeliveries: Truck,
  deliveredToday: Clock,
  openDisputes: Headphones,
  openSupportTickets: Ticket,
  pendingPayouts: CreditCard,
  driverCodOutstanding: WalletCards,
};

const queueIconMap = {
  readyUnassignedOrders: Package,
  expiredDeliveryOffers: Ticket,
  highCodDrivers: WalletCards,
  unsettledCodOrders: LockKeyhole,
  disputesWaitingForAdmin: Headphones,
  supportWaitingForAdmin: Ticket,
  earningsReadyForRelease: BadgeDollarSign,
  payoutsInProgress: CreditCard,
  failedPayouts: BarChart2,
};

function toneFromPriority(priority) {
  if (priority === "urgent" || priority === "high") return "danger";
  if (priority === "normal") return "brand";
  if (priority === "low") return "success";
  return "muted";
}

function toneFromRisk(risk) {
  if (risk === "high" || risk === "danger") return "danger";
  if (risk === "warning") return "warning";
  if (risk === "success") return "success";
  if (risk === "brand") return "brand";
  return "muted";
}

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

function OverviewTile({ icon: Icon, label, metric, hint, route, onNavigate, money = false }) {
  return (
    <button className="ops-overview-tile" type="button" onClick={() => onNavigate(route)}>
      <span className="ops-overview-icon"><Icon size={18} /></span>
      <div className="ops-overview-copy">
        <span>{label}</span>
        <strong>{money ? formatCurrency(metric || 0) : metric}</strong>
        <small>{hint}</small>
      </div>
      <ArrowRight size={16} className="ops-overview-chevron" />
    </button>
  );
}

function QueueRow({ item, onNavigate }) {
  const priorityTone = toneFromPriority(item.priority);
  const riskTone = toneFromRisk(item.risk);

  return (
    <article className="ops-queue-row">
      <div className="ops-queue-copy">
        <strong>{item.reference || item.id}</strong>
        <span>{item.title}</span>
        <small>{item.subtitle}</small>
      </div>
      <div className="ops-queue-meta">
        {typeof item.amount === "number" ? <strong>{formatCurrency(item.amount)}</strong> : <span>—</span>}
        <div className="ops-queue-badges">
          <StatusBadge status={item.status || "—"} />
          {item.priority ? <span className={`ops-mini-pill ${priorityTone}`}>{item.priority}</span> : null}
          {item.risk ? <span className={`ops-mini-pill ${riskTone}`}>{item.risk}</span> : null}
        </div>
        <small>{formatDateTime(item.updatedAt || item.createdAt)}</small>
      </div>
      <button className="secondary-action compact" type="button" onClick={() => onNavigate(item.route)}>
        Open
      </button>
    </article>
  );
}

function QueueCard({ icon: Icon = LayoutDashboard, title, total, items, route, onNavigate, emptyText }) {
  return (
    <section className="panel ops-queue-card">
      <PanelHeader icon={Icon} title={title} action={`${total} total`} />
      <div className="ops-queue-card-body">
        {items.length ? (
          items.map((item) => <QueueRow key={item.id} item={item} onNavigate={onNavigate} />)
        ) : (
          <EmptyState icon={LayoutDashboard} text={emptyText || "Nothing queued right now."} />
        )}
      </div>
      <button className="ghost-action compact ops-card-foot" type="button" onClick={() => onNavigate(route)}>
        View all
      </button>
    </section>
  );
}

function FinanceMetric({ label, value, note, money = false }) {
  return (
    <article className="ops-finance-card">
      <span>{label}</span>
      <strong>{money ? formatCurrency(value || 0) : value}</strong>
      <small>{note}</small>
    </article>
  );
}

export function AdminOperationsDashboard() {
  const [queueLimit, setQueueLimit] = useState(5);
  const summaryQuery = useQuery({
    queryKey: ["admin-operations-summary", queueLimit],
    queryFn: () => adminOperationsApi.summary({ queueLimit }),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const summary = summaryQuery.data || null;
  const snapshotEntries = useMemo(() => Object.entries(summary?.snapshot || {}), [summary]);
  const queueEntries = useMemo(() => Object.entries(summary?.queues || {}), [summary]);
  const finance = summary?.finance || null;
  const quickLinks = summary?.quickLinks || [];

  function navigate(route) {
    if (!route) return;
    window.history.pushState(null, "", route);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  return (
    <main className="workspace ops-dashboard">
      <PageTitle
        kicker="Control room"
        title="Operations dashboard"
        description="A read-only snapshot of orders, delivery, support, disputes, and finance in one place."
      />

      <section className="ops-toolbar panel">
        <div>
          <strong>Operations scope</strong>
          <p>Support Tickets stay separate from formal Disputes. This dashboard only links into existing admin areas.</p>
        </div>
        <label className="ops-limit-picker">
          <span>Queue size</span>
          <select value={queueLimit} onChange={(event) => setQueueLimit(Math.min(10, Math.max(5, Number(event.target.value) || 5)))}>
            {QUEUE_LIMIT_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </section>

      {summaryQuery.isError ? (
        <section className="panel ops-state-card">
          <EmptyState icon={BarChart2} text={summaryQuery.error?.message || "Unable to load operations summary."} />
        </section>
      ) : summaryQuery.isLoading && !summary ? (
        <section className="panel ops-state-card">
          <EmptyState icon={BarChart2} text="Loading operations summary…" />
        </section>
      ) : null}

      <section className="metric-grid ops-overview-grid">
        {snapshotEntries.map(([key, item]) => {
          const Icon = snapshotIconMap[key] || LayoutDashboard;
          const isMoney = key === "driverCodOutstanding";
          return (
            <OverviewTile
              key={key}
              icon={Icon}
              label={item.label}
              metric={item.count}
              hint={item.route}
              route={item.route}
              onNavigate={navigate}
              money={isMoney}
            />
          );
        })}
      </section>

      <section className="panel ops-finance-band">
        <PanelHeader icon={BadgeDollarSign} title="Finance overview" action="Read-only balances" />
        <div className="ops-finance-grid">
          {finance ? (
            <>
              <FinanceMetric label="Pending seller balance" value={finance.totalPendingSellerBalance} note="Still in hold" money />
              <FinanceMetric label="Available seller balance" value={finance.totalAvailableSellerBalance} note="Ready for payout" money />
              <FinanceMetric label="Hold / dispute balance" value={finance.totalHoldSellerBalance} note="Frozen for review" money />
              <FinanceMetric label="Paid seller balance" value={finance.totalPaidSellerBalance} note="Already paid" money />
              <FinanceMetric label="Driver COD outstanding" value={finance.totalDriverCodOutstanding} note="Cash still with drivers" money />
              <FinanceMetric label="Pending payouts" value={finance.totalPendingPayouts.amount} note={`${finance.totalPendingPayouts.count} pending`} money />
              <FinanceMetric label="Processing payouts" value={finance.totalProcessingPayouts.amount} note={`${finance.totalProcessingPayouts.count} processing`} money />
              <FinanceMetric label="Completed this month" value={finance.totalCompletedPayoutsThisMonth.amount} note={`${finance.totalCompletedPayoutsThisMonth.count} completed`} money />
            </>
          ) : (
            <EmptyState icon={WalletCards} text="No finance data available." />
          )}
        </div>
      </section>

      <section className="ops-queues-header panel">
        <div>
          <strong>Action queues</strong>
          <p>Queues stay capped and read-only. Open any row to jump into the existing admin area.</p>
        </div>
      </section>

      <section className="ops-queue-grid">
        {queueEntries.map(([key, queue]) => {
          const titleMap = {
            readyUnassignedOrders: "Orders ready for delivery, no driver assigned",
            expiredDeliveryOffers: "Expired / unaccepted delivery offers",
            highCodDrivers: "Drivers above COD threshold",
            unsettledCodOrders: "COD-collected orders not yet settled",
            disputesWaitingForAdmin: "Disputes waiting for admin",
            supportWaitingForAdmin: "Support tickets waiting for admin",
            earningsReadyForRelease: "Seller earnings ready for release",
            payoutsInProgress: "Payouts pending / processing",
            failedPayouts: "Failed payouts",
          };
          return (
            <QueueCard
              key={key}
              icon={queueIconMap[key] || LayoutDashboard}
              title={titleMap[key] || key}
              total={queue.total || 0}
              items={queue.items || []}
              route={
                key === "supportWaitingForAdmin"
                  ? "/admin/support-tickets"
                  : key === "disputesWaitingForAdmin"
                    ? "/admin/support?section=support"
                    : key === "earningsReadyForRelease" || key === "payoutsInProgress" || key === "failedPayouts"
                      ? "/admin/payouts"
                      : key === "highCodDrivers" || key === "expiredDeliveryOffers" || key === "readyUnassignedOrders" || key === "unsettledCodOrders"
                        ? "/admin/drivers"
                        : "/admin/orders"
              }
              onNavigate={navigate}
              emptyText="No records in this queue right now."
            />
          );
        })}
      </section>

      <section className="panel ops-links-band">
        <PanelHeader icon={Settings2} title="Quick links" action="Jump to existing areas" />
        <div className="ops-links-grid">
          {quickLinks.map((link) => (
            <button key={link.id} className="ops-link-card" type="button" onClick={() => navigate(link.route)}>
              <strong>{link.label}</strong>
              <span>{link.description}</span>
              <small>{link.route}</small>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
