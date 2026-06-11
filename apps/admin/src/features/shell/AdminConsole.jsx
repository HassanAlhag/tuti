import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Award,
  BarChart2,
  Building2,
  ClipboardCheck,
  CreditCard,
  Crown,
  Sparkles,
  Headphones,
  LayoutDashboard,
  Settings2,
  ShoppingBag,
  Ticket,
  Truck,
  UserCheck,
  UserCog,
  Users,
  WalletCards,
} from "lucide-react";
import { marketplaceApi } from "@tuti/shared/api/client.js";
import { NotificationBell } from "@tuti/shared/components/NotificationBell.jsx";
import { brand } from "@tuti/shared/brand.js";
import { AdminUsers } from "../users/AdminUsers.jsx";
import { AdminCRM } from "../crm/AdminCRM.jsx";
import { AdminDrivers } from "../drivers/AdminDrivers.jsx";
import { AdminOperationsDashboard } from "../operations/AdminOperationsDashboard.jsx";
import { AdminPayouts } from "../payouts/AdminPayouts.jsx";
import { AdminSellerPipeline } from "../sellers/AdminSellerPipeline.jsx";
import { AdminSupportTickets } from "../support-tickets/AdminSupportTickets.jsx";
import { AdminDashboard } from "../overview/AdminDashboard.jsx";
import { PaymentsCenter } from "../finance/PaymentsCenter.jsx";
import { AnalyticsDashboard } from "../analytics/AnalyticsDashboard.jsx";
import { AdminOrders } from "../orders/AdminOrders.jsx";
import { AdminClients } from "../crm/AdminClients.jsx";
import { AdminShops } from "../sellers/AdminShops.jsx";
import { AdminAuditLog } from "../settings/AdminAuditLog.jsx";
import { AdminRoleMatrix } from "../settings/AdminRoleMatrix.jsx";
import { AdminSupport } from "../disputes/AdminSupport.jsx";
import { AdminSalesReps } from "../users/AdminSalesReps.jsx";
import { AdminMerchandising } from "../merchandising/AdminMerchandising.jsx";

export function AdminConsole({
  activeSection,
  adminData,
  capturePayment,
  goToStore,
  setActiveSection,
  updatePayout,
  updateProductStatus,
}) {
  const [deepLinkTarget, setDeepLinkTarget] = useState({ orderId: "", shopId: "", notice: "" });
  const { data: analyticsSummary } = useQuery({
    queryKey: ["admin-analytics-summary"],
    queryFn: () => marketplaceApi.getAdminAnalyticsSummary(),
    retry: 1,
  });

  const navGroups = [
    {
      label: "Core operations",
      items: [
        { id: "overview", label: "Dashboard", icon: LayoutDashboard },
        { id: "operations", label: "Operations", icon: Settings2 },
        { id: "orders", label: "Orders", icon: ShoppingBag },
        { id: "payments", label: "Payments", icon: CreditCard },
        { id: "payouts", label: "Payouts", icon: WalletCards },
      ],
    },
    {
      label: "People",
      items: [
        { id: "seller-pipeline", label: "Seller Pipeline", icon: ClipboardCheck },
        { id: "shops", label: "Sellers", icon: Building2 },
        { id: "crm", label: "Customer CRM", icon: UserCheck },
        { id: "clients", label: "Clients", icon: UserCheck },
        { id: "users", label: "Users", icon: UserCog },
      ],
    },
    {
      label: "Merchandising",
      items: [
        { id: "merchandising", label: "Merchandising", icon: Sparkles },
      ],
    },
    {
      label: "Operations",
      items: [
        { id: "drivers", label: "Drivers", icon: Truck },
        { id: "support-tickets", label: "Support Tickets", icon: Ticket },
        { id: "support", label: "Disputes", icon: Headphones },
        { id: "analytics", label: "Analytics", icon: BarChart2 },
      ],
    },
    {
      label: "Governance",
      items: [
        { id: "roles", label: "Roles", icon: Users },
        { id: "sales-reps", label: "Sales Reps", icon: Award },
        { id: "audit", label: "Audit log", icon: Settings2 },
      ],
    },
  ];

  const content = {
    overview: (
      <AdminDashboard
        adminData={adminData}
        analyticsSummary={analyticsSummary}
        updatePayout={updatePayout}
        updateProductStatus={updateProductStatus}
      />
    ),
    payments: (
      <PaymentsCenter
        adminData={adminData}
        capturePayment={capturePayment}
        updatePayout={updatePayout}
      />
    ),
    payouts: <AdminPayouts />,
    orders: <AdminOrders focusedOrderId={deepLinkTarget.orderId} onFocusHandled={(notice) => setDeepLinkTarget((current) => ({ ...current, notice: notice || "" }))} />,
    operations: <AdminOperationsDashboard onNavigate={setActiveSection} />,
    users: <AdminUsers />,
    "seller-pipeline": <AdminSellerPipeline onViewInSellers={() => setActiveSection("shops")} />,
    crm: <AdminCRM />,
    drivers: <AdminDrivers />,
    "support-tickets": <AdminSupportTickets />,
    clients: <AdminClients adminData={adminData} />,
    analytics: <AnalyticsDashboard adminData={adminData} analyticsSummary={analyticsSummary} />,
    shops: <AdminShops adminData={adminData} updateProductStatus={updateProductStatus} focusedShopId={deepLinkTarget.shopId} onFocusHandled={(notice) => setDeepLinkTarget((current) => ({ ...current, notice: notice || "" }))} onGoToSection={setActiveSection} />,
    support: <AdminSupport adminData={adminData} focusedOrderId={deepLinkTarget.orderId} onFocusHandled={(notice) => setDeepLinkTarget((current) => ({ ...current, notice: notice || "" }))} />,
    roles: <AdminRoleMatrix roles={adminData.roles} />,
    "sales-reps": <AdminSalesReps />,
    audit: <AdminAuditLog adminData={adminData} />,
    merchandising: <AdminMerchandising adminData={adminData} />,
  }[activeSection];

  useEffect(() => {
    function applyQuerySelection() {
      const params = new URLSearchParams(window.location.search);
      const section = params.get("section");
      const orderId = params.get("order") || "";
      const shopId = params.get("shop") || "";
      const allowed = new Set(["overview", "operations", "payments", "payouts", "orders", "users", "seller-pipeline", "crm", "drivers", "clients", "shops", "analytics", "support", "support-tickets", "roles", "sales-reps", "audit", "merchandising"]);
      if (section && allowed.has(section)) {
        setActiveSection(section);
      }
      setDeepLinkTarget((current) => ({
        ...current,
        orderId,
        shopId,
      }));
    }

    applyQuerySelection();
    window.addEventListener("popstate", applyQuerySelection);
    return () => window.removeEventListener("popstate", applyQuerySelection);
  }, [setActiveSection]);

  function handleNotificationNavigate(_notification, path) {
    if (!path) return;
    window.history.pushState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <button className="brand-lockup admin-brand" onClick={() => setActiveSection("overview")} type="button">
          <span className="brand-mark">{brand.mark}</span>
          <span>
            <strong>Admin Console</strong>
            <small>Separate control room</small>
          </span>
        </button>

        <nav className="admin-nav" aria-label="Admin sections">
          {navGroups.map((group) => (
            <div className="admin-nav-group" key={group.label}>
              <span className="admin-nav-group-label">{group.label}</span>
              {group.items.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    className={activeSection === section.id ? "admin-nav-button active" : "admin-nav-button"}
                    onClick={() => setActiveSection(section.id)}
                    type="button"
                  >
                    <Icon size={18} />
                    {section.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <button className="admin-back-button" onClick={() => goToStore()} type="button">
          <ArrowLeft size={17} />
          Back to Tuti
        </button>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="eyebrow">Owner access</span>
            <h1>Tuti operations</h1>
          </div>
          <div className="admin-topbar-actions">
            <NotificationBell onNotificationNavigate={handleNotificationNavigate} />
            <span className="admin-user">
              <Crown size={17} />
              Tuti owner
            </span>
          </div>
        </header>

        {deepLinkTarget.notice ? <p className="admin-deeplink-note">{deepLinkTarget.notice}</p> : null}
        {content}
      </section>
    </div>
  );
}
