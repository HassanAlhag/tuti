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

export function AdminRoleMatrix({ roles }) {
  return (
    <main className="workspace">
      <PageTitle
        kicker="Role based access"
        title="Seller, customer, support, admin"
        description="Seller accounts are separated from customer and admin accounts. MongoDB user roles can plug into these boundaries later."
      />
      <section className="role-matrix">
        {roles.map((role) => (
          <article className="role-card" key={role.id}>
            <div className="role-card-head">
              <span>
                {role.id === "customer" ? <UserCircle size={20} /> : null}
                {role.id === "seller" ? <Warehouse size={20} /> : null}
                {role.id === "support" ? <Headphones size={20} /> : null}
                {role.id === "admin" ? <Crown size={20} /> : null}
              </span>
              <div>
                <h2>{role.name}</h2>
                <p>{role.label}</p>
              </div>
            </div>
            <div className="permission-list">
              {role.permissions.map((permission) => (
                <span key={permission}>
                  <CheckCircle2 size={15} />
                  {permission}
                </span>
              ))}
            </div>
            <p className="role-boundary">{role.boundary}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
