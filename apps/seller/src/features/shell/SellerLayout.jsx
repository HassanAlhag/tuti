/**
 * Seller portal shell — sidebar + topbar + content area.
 * Imports entirely from @tuti/shared. No client/admin code here.
 */

import {
  ArrowLeft, BadgeDollarSign, BarChart2, CheckCircle2, MessageSquare,
  LayoutDashboard, Package, Plus, ShoppingBag, Sparkles, Truck, Users, WalletCards,
} from "lucide-react";
import { brand }            from "@tuti/shared/brand.js";
import { useAuthStore }     from "@tuti/shared/store/authStore.js";
import { formatCurrency }   from "@tuti/shared/utils/money.js";
import { NotificationBell } from "../notifications/NotificationBell.jsx";

const NAV_GROUPS = [
  {
    label: "Manage",
    items: [
      { id: "overview",  label: "Overview",  icon: LayoutDashboard },
      { id: "brand",     label: "Brand",     icon: Sparkles },
      { id: "products",  label: "Products",  icon: Package },
      { id: "orders",    label: "Orders",    icon: ShoppingBag },
      { id: "drivers",   label: "Drivers",   icon: Truck },
    ],
  },
  {
    label: "Insights",
    items: [
      { id: "customers", label: "Customers", icon: Users },
      { id: "analytics", label: "Analytics", icon: BarChart2 },
      { id: "payouts",   label: "Payouts",   icon: BadgeDollarSign },
    ],
  },
  {
    label: "Help",
    items: [
      { id: "support", label: "Support", icon: MessageSquare },
    ],
  },
];

const ALL_SECTIONS = NAV_GROUPS.flatMap((g) => g.items);

export function SellerLayout({ activeSection, onSectionChange, shopName, shop, onBack, onNotificationNavigate, children }) {
  const { user }       = useAuthStore();
  const activeItem     = ALL_SECTIONS.find((s) => s.id === activeSection);
  const ActiveIcon     = activeItem?.icon;
  const displayName    = shopName || user?.name || "My shop";
  const shopStatus     = shop?.status        || "Pending review";
  const fulfillment    = Number(shop?.fulfillmentRate || 0);
  const pendingBalance = Number(shop?.pendingBalance  || 0);

  return (
    <div className="sd-shell">
      <aside className="sd-sidebar" aria-label="Seller navigation">
        <div className="sd-sidebar-brand">
          <div className="sd-brand-mark"><span>{brand.mark}</span></div>
          <div className="sd-brand-text">
            <strong>Seller Central</strong>
            <span className="sd-shop-name">{displayName}</span>
          </div>
        </div>

        <nav className="sd-nav" aria-label="Seller sections">
          {NAV_GROUPS.map((group) => (
            <div className="sd-nav-group" key={group.label}>
              <span className="sd-nav-group-label">{group.label}</span>
              {group.items.map(({ id, label, icon: Icon }) => (
                <button
                  key={id} type="button"
                  className={activeSection === id ? "sd-nav-btn active" : "sd-nav-btn"}
                  onClick={() => onSectionChange(id)}
                >
                  <Icon size={16} />{label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <button className="sd-back-btn" type="button" onClick={onBack}>
          <ArrowLeft size={15} />Back to store
        </button>

        {/* Live shop stats at the bottom of the sidebar */}
        <div className="sd-sidebar-status">
          <div className="sd-sidebar-status-label">
            <span>Shop status</span>
            <strong>{shopStatus}</strong>
          </div>
          <div className="sd-sidebar-status-grid">
            <span><CheckCircle2 size={13} />{fulfillment}%</span>
            <span><WalletCards  size={13} />{formatCurrency(pendingBalance, true)}</span>
          </div>
        </div>
      </aside>

      <div className="sd-main">
        <header className="sd-topbar">
          <div className="sd-topbar-section">
            {ActiveIcon && <ActiveIcon size={18} className="sd-topbar-icon" />}
            <span className="sd-topbar-title">{activeItem?.label}</span>
          </div>
          <div className="sd-topbar-right">
            <button className="secondary-action compact sd-topbar-action" type="button" onClick={() => onSectionChange("orders")}>
              <ShoppingBag size={14} />Orders
            </button>
            <button className="primary-action compact sd-topbar-action" type="button" onClick={() => onSectionChange("products")}>
              <Plus size={14} />Add product
            </button>
            <NotificationBell onNotificationNavigate={onNotificationNavigate} />
            <div className="sd-topbar-shop">
              <span className="sd-topbar-avatar">{displayName.charAt(0).toUpperCase()}</span>
              <span className="sd-topbar-shop-name">{displayName}</span>
            </div>
          </div>
        </header>

        <div className="sd-content">{children}</div>
      </div>
    </div>
  );
}
