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

const EMPTY_ARRAY = [];

/* ─── Drivers ─────────────────────────────────────────────────── */
export function SellerDrivers({ seller }) {
  const shop = seller?.shop;
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const shopId = shop?.id || user?.shopId || "";

  const [driverModal, setDriverModal] = useState(null);
  const [driverForm, setDriverForm] = useState(null);
  const [driverError, setDriverError] = useState("");
  const [driverLoginResult, setDriverLoginResult] = useState(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({ driverId: "", orderId: "", force: false });
  const [assignError, setAssignError] = useState("");
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState(null);
  const [broadcastError, setBroadcastError] = useState("");
  const [broadcastSuccess, setBroadcastSuccess] = useState("");
  const [deliveryModal, setDeliveryModal] = useState(null);
  const [deliveryForm, setDeliveryForm] = useState({ codCollected: false, note: "" });
  const [deliveryError, setDeliveryError] = useState("");

  const { data: driversData, isLoading: driversLoading, error: driversFetchError } = useQuery({
    queryKey: ["seller-drivers", user?.sub],
    queryFn:  () => sellerDriversApi.list(),
    enabled:  Boolean(user && shopId),
  });

  const { data: driverCodSummary, isLoading: codLoading, error: codFetchError } = useQuery({
    queryKey: ["seller-drivers-cod-summary", user?.sub],
    queryFn:  () => sellerDriversApi.getCodSummary(),
    enabled:  Boolean(user && shopId),
  });

  const { data: ordersData, isLoading: ordersLoading, error: ordersFetchError } = useQuery({
    queryKey: ["seller-driver-orders", user?.sub],
    queryFn:  () => ordersApi.list({ limit: 100 }),
    enabled:  Boolean(user && shopId),
  });

  const { data: deliveryOffersData, isLoading: offersLoading, error: offersFetchError } = useQuery({
    queryKey: ["seller-delivery-offers", user?.sub],
    queryFn:  () => sellerDeliveryOffersApi.list(),
    enabled:  Boolean(user && shopId),
  });

  const drivers = driversData || EMPTY_ARRAY;
  const allOrders = ordersData?.orders || EMPTY_ARRAY;
  const deliveryOffers = deliveryOffersData || EMPTY_ARRAY;

  const ownOrders = useMemo(() => allOrders.filter((order) => ownShopOrder(order, shopId)), [allOrders, shopId]);
  const assignableOrders = useMemo(
    () => ownOrders.filter((order) => isDriverAssignableOrder(order, shopId)),
    [ownOrders, shopId]
  );
  const broadcastableOrders = assignableOrders;
  const activeDrivers = useMemo(() => drivers.filter((driver) => isSellerDriverActive(driver)), [drivers]);
  const onDeliveryDrivers = useMemo(() => drivers.filter((driver) => driver.status === "on_delivery"), [drivers]);
  const broadcastZone = String(broadcastForm?.deliveryZone || "").trim();
  const broadcastEligibleDrivers = useMemo(
    () => activeDrivers.filter((driver) => driverMatchesBroadcastZone(driver, broadcastZone)),
    [activeDrivers, broadcastZone]
  );
  const activeAssignments = useMemo(
    () => ownOrders.filter((order) => order.driverAssignment?.driverId && !order.driverAssignment?.deliveredAt),
    [ownOrders]
  );
  const activeAssignmentMap = useMemo(() => {
    const map = new Map();
    for (const order of activeAssignments) {
      map.set(order.driverAssignment.driverId, order);
    }
    return map;
  }, [activeAssignments]);

  const pendingCodTotal = drivers.reduce((sum, driver) => sum + Number(driver.codBalance || 0), 0);
  const driverCount = drivers.length;
  const activeCount = activeDrivers.length;
  const assignableCount = assignableOrders.length;
  const onDeliveryCount = onDeliveryDrivers.length;
  const codBalance = Number(driverCodSummary?.codBalance ?? pendingCodTotal) || 0;

  useEffect(() => {
    if (!driverModal) {
      setDriverForm(null);
      setDriverError("");
      return;
    }
    if (driverModal.mode === "edit" && driverModal.driver) {
      setDriverForm({
        name: driverModal.driver.name || "",
        phone: driverModal.driver.phone || "",
        email: driverModal.driver.email || "",
        vehicleType: driverModal.driver.vehicleType || "motorcycle",
        zone: driverModal.driver.zone || "",
        status: driverModal.driver.status || "active",
        createLogin: false,
        loginEmail: driverModal.driver.loginEmail || driverModal.driver.email || "",
      });
    } else {
      setDriverForm({
        name: "",
        phone: "",
        email: "",
        vehicleType: "motorcycle",
        zone: "",
        status: "active",
        createLogin: false,
        loginEmail: "",
      });
    }
    setDriverError("");
  }, [driverModal]);

  useEffect(() => {
    if (!assignModalOpen) {
      setAssignForm((current) => {
        if (!current || (current.driverId === "" && current.orderId === "" && current.force === false)) {
          return current;
        }
        return { driverId: "", orderId: "", force: false };
      });
      setAssignError("");
      return;
    }
    setAssignForm((current) => {
      const next = {
        driverId: current?.driverId || activeDrivers[0]?.id || "",
        orderId: current?.orderId || assignableOrders[0]?.orderId || "",
        force: Boolean(current?.force),
      };
      if (
        current
        && current.driverId === next.driverId
        && current.orderId === next.orderId
        && current.force === next.force
      ) {
        return current;
      }
      return next;
    });
    setAssignError("");
  }, [assignModalOpen, activeDrivers, assignableOrders]);

  useEffect(() => {
    if (!deliveryModal) {
      setDeliveryForm({ codCollected: false, note: "" });
      setDeliveryError("");
      return;
    }
    setDeliveryForm({ codCollected: false, note: "" });
    setDeliveryError("");
  }, [deliveryModal]);

  useEffect(() => {
    if (!broadcastSuccess) return undefined;
    const timer = window.setTimeout(() => setBroadcastSuccess(""), 2400);
    return () => window.clearTimeout(timer);
  }, [broadcastSuccess]);

  useEffect(() => {
    if (!broadcastModalOpen) {
      setBroadcastForm((current) => (current === null ? current : null));
      setBroadcastError((current) => (current === "" ? current : ""));
      return;
    }
    const defaultOrder = broadcastForm?.orderId || broadcastableOrders[0]?.orderId || "";
    const defaultOrderData = broadcastableOrders.find((order) => order.orderId === defaultOrder) || null;
    const defaultZone = broadcastForm?.deliveryZone || resolveOrderDeliveryZone(defaultOrderData);
    const nextForm = {
      orderId: defaultOrder,
      deliveryZone: defaultZone,
      expiresMinutes: broadcastForm?.expiresMinutes || 30,
      notes: broadcastForm?.notes || "",
    };
    setBroadcastForm((current) => {
      if (
        current
        && current.orderId === nextForm.orderId
        && current.deliveryZone === nextForm.deliveryZone
        && current.expiresMinutes === nextForm.expiresMinutes
        && current.notes === nextForm.notes
      ) {
        return current;
      }
      return nextForm;
    });
    setBroadcastError("");
  }, [broadcastModalOpen, broadcastableOrders]);

  useEffect(() => {
    if (!broadcastForm?.orderId) return;
    const selectedOrder = broadcastableOrders.find((order) => order.orderId === broadcastForm.orderId);
    if (!selectedOrder) return;
    const nextZone = resolveOrderDeliveryZone(selectedOrder);
    if (!broadcastForm.deliveryZone && nextZone) {
      setBroadcastForm((current) => current ? { ...current, deliveryZone: nextZone } : current);
    }
  }, [broadcastForm?.orderId, broadcastForm?.deliveryZone, broadcastableOrders]);

  function invalidateDriverData() {
    qc.invalidateQueries({ queryKey: ["seller-drivers"] });
    qc.invalidateQueries({ queryKey: ["seller-drivers-cod-summary"] });
    qc.invalidateQueries({ queryKey: ["seller-driver-orders"] });
    qc.invalidateQueries({ queryKey: ["seller-orders"] });
    qc.invalidateQueries({ queryKey: ["seller-delivery-offers"] });
  }

  function friendlyDriverError(message) {
    const text = String(message || "Unable to complete the action.");
    if (text.includes("active driver assignment")) {
      return "This order already has a driver assigned. Enable Force assign to replace the current driver.";
    }
    if (text.includes("inactive")) {
      return "This driver is inactive. Pick an active driver for assignment.";
    }
    if (text.includes("already has a linked login")) {
      return "This driver already has a linked login.";
    }
    if (text.includes("Login email is required")) {
      return "Add a login email to create driver access.";
    }
    if (text.includes("Email already registered")) {
      return "That login email is already in use. Use a different email.";
    }
    if (text.includes("Order not found or not assigned to this driver")) {
      return "This order is not assigned to the selected driver.";
    }
    if (text.includes("Seller shop context required")) {
      return "Seller shop context is missing. Please reload the page and try again.";
    }
    return text;
  }

  function friendlyBroadcastError(message) {
    const text = String(message || "Unable to complete the broadcast.");
    if (text.includes("No active drivers match")) {
      return "No active drivers match the selected delivery zone.";
    }
    if (text.includes("No active drivers are available")) {
      return "No active drivers are available for broadcast.";
    }
    if (text.includes("active driver assignment")) {
      return "This order already has an active driver assignment. Use direct assign if you want to replace it.";
    }
    if (text.includes("not found or not assigned")) {
      return "This order is no longer eligible for broadcast.";
    }
    if (text.includes("no longer open") || text.includes("cancelled") || text.includes("expired")) {
      return "This delivery offer is no longer available.";
    }
    return text;
  }

  const driverMutation = useMutation({
    mutationFn: ({ mode, id, payload }) => (mode === "edit" ? sellerDriversApi.update(id, payload) : sellerDriversApi.create(payload)),
    onSuccess: (_data, vars) => {
      invalidateDriverData();
      setDriverModal(null);
      setDriverError("");
      if (_data?.tempPassword) {
        setDriverLoginResult({
          driverName: _data.name || vars?.payload?.name || "Driver",
          loginEmail: _data.loginEmail || vars?.payload?.loginEmail || vars?.payload?.email || "",
          tempPassword: _data.tempPassword,
        });
      }
      if (vars.mode !== "edit") {
        setAssignForm((current) => ({
          ...current,
          driverId: current.driverId || "",
        }));
      }
    },
    onError: (error) => setDriverError(friendlyDriverError(error?.message)),
  });

  const assignMutation = useMutation({
    mutationFn: ({ driverId, orderId, payload }) => sellerDriversApi.assign(driverId, orderId, payload),
    onSuccess: () => {
      invalidateDriverData();
      setAssignModalOpen(false);
      setAssignError("");
    },
    onError: (error) => setAssignError(friendlyDriverError(error?.message)),
  });

  const deliveryMutation = useMutation({
    mutationFn: ({ driverId, orderId, payload }) => sellerDriversApi.recordDelivery(driverId, orderId, payload),
    onSuccess: () => {
      invalidateDriverData();
      setDeliveryModal(null);
      setDeliveryError("");
    },
    onError: (error) => setDeliveryError(friendlyDriverError(error?.message)),
  });

  const broadcastMutation = useMutation({
    mutationFn: (payload) => sellerDeliveryOffersApi.create(payload),
    onSuccess: (_data) => {
      invalidateDriverData();
      setBroadcastModalOpen(false);
      setBroadcastError("");
      setBroadcastSuccess(`Offer sent to eligible drivers.`);
    },
    onError: (error) => setBroadcastError(friendlyBroadcastError(error?.message)),
  });

  const cancelOfferMutation = useMutation({
    mutationFn: (offerId) => sellerDeliveryOffersApi.cancel(offerId),
    onSuccess: () => {
      invalidateDriverData();
      setBroadcastSuccess("Offer cancelled.");
      setBroadcastError("");
    },
    onError: (error) => setBroadcastError(friendlyBroadcastError(error?.message)),
  });

  function handleBroadcastSubmit(event) {
    event.preventDefault();
    setBroadcastError("");
    setBroadcastSuccess("");
    if (!broadcastForm?.orderId) {
      setBroadcastError("Pick an eligible order.");
      return;
    }
    if (!activeDrivers.length) {
      setBroadcastError("No active drivers are available for broadcast.");
      return;
    }
    const selectedOrder = broadcastableOrders.find((order) => order.orderId === broadcastForm.orderId) || null;
    const expiresMinutes = Math.max(1, Number(broadcastForm.expiresMinutes) || 30);
    const expiresAt = new Date(Date.now() + expiresMinutes * 60000).toISOString();
    broadcastMutation.mutate({
      orderId: broadcastForm.orderId,
      deliveryZone: String(broadcastForm.deliveryZone || "").trim(),
      deliveryAddressSummary: String(selectedOrder?.deliveryAddress || resolveOrderDeliveryZone(selectedOrder) || "").trim(),
      codAmount: selectedOrder?.paymentMethod === "cod" ? Number(selectedOrder?.subtotal || 0) : 0,
      expiresAt,
      notes: String(broadcastForm.notes || "").trim(),
    });
  }

  function handleCancelOffer(offerId) {
    setBroadcastError("");
    setBroadcastSuccess("");
    cancelOfferMutation.mutate(offerId);
  }

  if (!shop) return <EmptyState icon={Truck} text="Loading drivers…" />;

  const operationalError = driversFetchError?.message || ordersFetchError?.message || codFetchError?.message || offersFetchError?.message;
  const hasHardError = Boolean(operationalError);
  const showNoDrivers = !driversLoading && !hasHardError && drivers.length === 0;
  const showNoActiveDrivers = !driversLoading && !hasHardError && activeCount === 0;
  const showNoAssignableOrders = !ordersLoading && !hasHardError && assignableCount === 0;
  const showNoBroadcastableOrders = !ordersLoading && !hasHardError && broadcastableOrders.length === 0;

  return (
    <div className="sd-section">
      <SellerPageHeader
        eyebrow="Seller operations"
        title="Drivers"
        subtitle="Manage your shop drivers, delivery assignments, and COD tracking from one calm workspace."
        meta={(
          <span className="sd-type-pill sd-type-pill--sm">
            <Truck size={12} />
            Seller-owned delivery
          </span>
        )}
        actions={(
          <>
            <button
              className="secondary-action compact"
              type="button"
              onClick={() => {
                setDriverModal({ mode: "add" });
              }}
            >
              <Truck size={14} />
              Add driver
            </button>
            <button
              className="primary-action compact"
              type="button"
              onClick={() => {
                setAssignModalOpen(true);
              }}
              disabled={!activeDrivers.length || !assignableOrders.length}
            >
              <ShoppingBag size={14} />
              Assign driver to order
            </button>
            <button
              className="secondary-action compact"
              type="button"
              onClick={() => {
                setBroadcastModalOpen(true);
              }}
            >
              <Truck size={14} />
              Broadcast to drivers
            </button>
          </>
        )}
      />

      <div className="sd-drivers-note">
        <ShieldCheck size={14} />
        <span>Drivers are managed by your shop. Admin can monitor delivery and COD balance.</span>
      </div>

      <div className="sd-driver-broadcast-note">
        <Sparkles size={14} />
        <span>Broadcast lets your active drivers in the selected zone accept the delivery. First accepted driver gets the parcel.</span>
      </div>

      {driverLoginResult ? (
        <div className="sd-driver-login-result">
          <div className="sd-driver-login-result-copy">
            <strong>Driver login created</strong>
            <span>{driverLoginResult.driverName}{driverLoginResult.loginEmail ? ` · ${driverLoginResult.loginEmail}` : ""}</span>
            <small>Copy this temporary password now. It will not be shown again.</small>
          </div>
          <code>{driverLoginResult.tempPassword}</code>
          <div className="sd-driver-login-result-actions">
            <button
              className="secondary-action compact"
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(driverLoginResult.tempPassword);
                } catch {
                  // Copy is optional. If the clipboard is unavailable, keep the message visible.
                }
              }}
            >
              Copy
            </button>
            <button
              className="ghost-action compact"
              type="button"
              onClick={() => setDriverLoginResult(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {hasHardError ? (
        <div className="sd-drivers-error">
          <AlertTriangle size={14} />
          <span>{friendlyDriverError(operationalError)}</span>
        </div>
      ) : null}

      {broadcastSuccess ? (
        <div className="sd-driver-success-strip">
          <CheckCircle2 size={14} />
          <span>{broadcastSuccess}</span>
        </div>
      ) : null}

      {broadcastError ? (
        <div className="sd-drivers-error">
          <AlertTriangle size={14} />
          <span>{broadcastError}</span>
        </div>
      ) : null}

      <section className="sd-metric-grid sd-driver-metrics">
        <MetricCard icon={Truck}         label="Active drivers"    value={activeCount}                     note={`${driverCount} total`} />
        <MetricCard icon={Truck}         label="On delivery"       value={onDeliveryCount}                 note="Orders in hand" />
        <MetricCard icon={WalletCards}   label="Pending COD"       value={formatCurrency(codBalance)}      note="Cash tracking only" />
        <MetricCard icon={ShoppingBag}   label="Assignable orders" value={assignableCount}                 note="Ready for Delivery only" />
      </section>

      {showNoActiveDrivers ? (
        <div className="sd-driver-empty-strip">
          <AlertTriangle size={14} />
          <span>No active drivers yet. Add a driver before assigning deliveries.</span>
        </div>
      ) : null}

      {showNoAssignableOrders ? (
        <div className="sd-driver-empty-strip sd-driver-empty-strip--soft">
          <ShoppingBag size={14} />
          <span>No assignable orders right now. Eligible orders must be Ready for Delivery.</span>
        </div>
      ) : null}

      {showNoBroadcastableOrders ? (
        <div className="sd-driver-empty-strip sd-driver-empty-strip--soft">
          <Truck size={14} />
          <span>No broadcastable orders right now. Broadcast uses the same Ready for Delivery eligibility.</span>
        </div>
      ) : null}

      <section className="sd-drivers-layout">
        <div className="sd-panel">
          <PanelHeader icon={Truck} title="Driver roster" action={`${driverCount} drivers`} />
          {driversLoading ? (
            <div className="sd-loading">Loading drivers…</div>
          ) : showNoDrivers ? (
            <EmptyState icon={Truck} text="No drivers yet. Add your first driver to start delivery tracking." />
          ) : (
            <div className="sd-driver-list">
              {drivers.map((driver) => {
                const activeOrder = activeAssignmentMap.get(driver.id) || null;
                const driverTone = driverStatusTone(driver);
                return (
                  <article className="sd-driver-row" key={driver.id}>
                    <div className="sd-driver-main">
                      <span className="sd-driver-avatar">
                        {String(driver.name || "D").split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "DR"}
                      </span>
                      <div className="sd-driver-copy">
                        <strong>{driver.name}</strong>
                        <span>
                          {driver.phone}
                          {driver.email ? ` · ${driver.email}` : ""}
                        </span>
                        <small>{formatDriverVehicle(driver.vehicleType)} · {driver.zone || "No zone set"}</small>
                        {driver.loginEnabled ? <small className="sd-driver-login-linked">Login linked</small> : null}
                      </div>
                    </div>

                    <div className="sd-driver-stats">
                      <span>
                        <strong>{driver.totalDeliveries || 0}</strong>
                        <small>Deliveries</small>
                      </span>
                      <span>
                        <strong>{formatCurrency(driver.codBalance || 0)}</strong>
                        <small>COD balance</small>
                      </span>
                    </div>

                    <div className="sd-driver-status-col">
                      <span className={`sd-driver-status sd-driver-status--${driverTone}`}>
                        {formatDriverStatus(driver.status)}
                      </span>
                      {activeOrder ? (
                        <span className="sd-driver-assignment-chip">
                          {activeOrder.orderId} · {activeOrder.status}
                        </span>
                      ) : (
                        <span className="sd-driver-assignment-empty">No active assignment</span>
                      )}
                    </div>

                    <div className="sd-driver-actions">
                      <button
                        className="ghost-action compact"
                        type="button"
                        onClick={() => {
                          setDriverModal({ mode: "edit", driver });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="secondary-action compact"
                        type="button"
                        onClick={() => {
                          setAssignModalOpen(true);
                          setAssignForm((current) => ({
                            ...current,
                            driverId: driver.id,
                            orderId: current.orderId || assignableOrders[0]?.orderId || "",
                          }));
                        }}
                        disabled={!isSellerDriverActive(driver) || !assignableOrders.length}
                      >
                        Assign
                      </button>
                      <button
                        className="primary-action compact"
                        type="button"
                        onClick={() => {
                          if (!activeOrder) return;
                          setDeliveryModal({ driverId: driver.id, orderId: activeOrder.orderId, driverName: driver.name });
                        }}
                        disabled={!activeOrder}
                      >
                        Record delivery
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="sd-drivers-side">
          <div className="sd-panel">
            <PanelHeader icon={ShoppingBag} title="Active assignments" action={`${activeAssignments.length} open`} />
            {ordersLoading ? (
              <div className="sd-loading">Loading orders…</div>
            ) : activeAssignments.length === 0 ? (
              <EmptyState icon={ShoppingBag} text="No active driver assignments yet." />
            ) : (
              <div className="sd-driver-assignment-list">
                {activeAssignments.map((order) => {
                  const assignedDriver = drivers.find((driver) => driver.id === order.driverAssignment.driverId);
                  return (
                    <article className="sd-driver-assignment-row" key={order.orderId}>
                      <div>
                        <strong>{order.orderId}</strong>
                        <span>{order.customerName}</span>
                        <small>
                          {assignedDriver?.name || order.driverAssignment.driverName || "Assigned driver"}
                          {" · "}
                          {order.status}
                        </small>
                      </div>
                      <div className="sd-driver-assignment-meta">
                        <strong>{formatCurrency(order.subtotal)}</strong>
                        <button
                          className="secondary-action compact"
                          type="button"
                          onClick={() => setDeliveryModal({
                            driverId: order.driverAssignment.driverId,
                            orderId: order.orderId,
                            driverName: assignedDriver?.name || order.driverAssignment.driverName || "Driver",
                          })}
                        >
                          Record delivery
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div className="sd-panel">
            <PanelHeader icon={WalletCards} title="COD summary" action="Cash tracking only" />
            {codLoading ? (
              <div className="sd-loading">Loading COD summary…</div>
            ) : (
              <div className="sd-driver-cod-summary">
                <div className="sd-driver-cod-note">
                  <ShieldCheck size={13} />
                  <span>COD balance is cash tracking only. No payment transfer is executed.</span>
                </div>
                <div className="sd-driver-cod-grid">
                  <div>
                    <strong>{formatCurrency(codBalance)}</strong>
                    <span>Pending COD</span>
                  </div>
                  <div>
                    <strong>{driverCodSummary?.totalDeliveries ?? 0}</strong>
                    <span>Total deliveries</span>
                  </div>
                  <div>
                    <strong>{driverCodSummary?.activeDrivers ?? activeCount}</strong>
                    <span>Active drivers</span>
                  </div>
                  <div>
                    <strong>{driverCodSummary?.onDeliveryDrivers ?? onDeliveryCount}</strong>
                    <span>On delivery</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="sd-panel">
            <PanelHeader icon={Sparkles} title="Delivery offers" action={`${deliveryOffers.length} offers`} />
            {offersLoading ? (
              <div className="sd-loading">Loading offers…</div>
          ) : deliveryOffers.length === 0 ? (
              <EmptyState icon={Truck} text="No delivery offers yet. Broadcast an eligible order to your active drivers." />
            ) : (
              <div className="sd-driver-offer-list">
                {deliveryOffers.map((offer) => (
                  <article className="sd-driver-offer-row" key={offer.id}>
                    <div className="sd-driver-offer-main">
                      <strong>{offer.orderId}</strong>
                      <span>{offer.deliveryZone || "Any zone"}</span>
                      <small>{offer.shopName || "Seller shop"}</small>
                    </div>
                    <div className="sd-driver-offer-meta">
                      <StatusBadge status={offer.status} />
                      <small>{formatOfferCountdown(offer.expiresAt)}</small>
                      {offer.acceptedDriverName ? <span>Accepted by {offer.acceptedDriverName}</span> : null}
                    </div>
                    {offer.notes ? <p className="sd-driver-offer-notes">{offer.notes}</p> : null}
                    <div className="sd-driver-offer-footer">
                      <small>Expires {formatOfferExpiry(offer.expiresAt)}</small>
                      {offer.status === "Open" ? (
                        <button
                          className="ghost-action compact"
                          type="button"
                          onClick={() => handleCancelOffer(offer.id)}
                          disabled={cancelOfferMutation.isPending}
                        >
                          {cancelOfferMutation.isPending ? "Cancelling…" : "Cancel"}
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {broadcastModalOpen && broadcastForm ? (
        <div className="sd-modal-overlay" role="presentation" onClick={() => !broadcastMutation.isPending && setBroadcastModalOpen(false)}>
          <div className="sd-modal" role="dialog" aria-modal="true" aria-label="Broadcast delivery offer" onClick={(event) => event.stopPropagation()}>
            <div className="sd-modal-head">
              <div>
                <strong>Broadcast to drivers</strong>
                <p>Broadcast lets your active drivers in the selected zone accept the delivery. First accepted driver gets the parcel.</p>
              </div>
              <button className="ghost-action compact" type="button" onClick={() => setBroadcastModalOpen(false)}>Close</button>
            </div>

            <div className="sd-modal-callout sd-modal-callout--brand">
              Active drivers in this zone will receive the offer. Direct assignment stays available if you want to choose a specific driver.
            </div>

            <form className="sd-modal-form" onSubmit={handleBroadcastSubmit}>
              <div className="sd-modal-grid">
                <label className="sd-field">
                  <span>Eligible order</span>
                  <select
                    value={broadcastForm.orderId}
                    onChange={(e) => {
                      const selectedOrder = broadcastableOrders.find((order) => order.orderId === e.target.value) || null;
                      const nextZone = resolveOrderDeliveryZone(selectedOrder);
                      setBroadcastForm((current) => ({
                        ...(current || {}),
                        orderId: e.target.value,
                        deliveryZone: current?.deliveryZone || nextZone,
                      }));
                    }}
                    disabled={!broadcastableOrders.length}
                  >
                    <option value="">{broadcastableOrders.length ? "Select order" : "No eligible orders"}</option>
                    {broadcastableOrders.map((order) => (
                      <option key={order.orderId} value={order.orderId}>
                        {order.orderId} · {order.customerName} · {order.status}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="sd-field">
                  <span>Expiry duration</span>
                  <select
                    value={broadcastForm.expiresMinutes}
                    onChange={(e) => setBroadcastForm((current) => ({ ...(current || {}), expiresMinutes: Number(e.target.value) }))}
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>60 minutes</option>
                    <option value={120}>2 hours</option>
                  </select>
                </label>

                <label className="sd-field wide">
                  <span>Delivery zone / location</span>
                  <input
                    value={broadcastForm.deliveryZone}
                    onChange={(e) => setBroadcastForm((current) => ({ ...(current || {}), deliveryZone: e.target.value }))}
                    placeholder="Jumeirah, Downtown, Marina…"
                  />
                </label>

                <label className="sd-field wide">
                  <span>Notes optional</span>
                  <textarea
                    rows={3}
                    value={broadcastForm.notes}
                    onChange={(e) => setBroadcastForm((current) => ({ ...(current || {}), notes: e.target.value }))}
                    placeholder="Add route hints, handoff notes, or special delivery instructions"
                  />
                </label>
              </div>

              <div className="sd-driver-broadcast-preview">
                <div>
                  <strong>{broadcastEligibleDrivers.length}</strong>
                  <span>active drivers in this zone</span>
                </div>
                <div>
                  <strong>{broadcastableOrders.length}</strong>
                  <span>eligible orders available</span>
                </div>
              </div>

              <p className="sd-modal-note">
                {broadcastEligibleDrivers.length ? `Active drivers in ${broadcastZone || "the selected zone"} can accept this offer.` : "No active drivers match this zone yet."}
              </p>

              {broadcastError ? <p className="sd-modal-error">{broadcastError}</p> : null}

              <div className="sd-modal-actions">
                <button className="ghost-action compact" type="button" onClick={() => setBroadcastModalOpen(false)}>Cancel</button>
                <button className="primary-action compact" type="submit" disabled={broadcastMutation.isPending || !broadcastableOrders.length || !activeDrivers.length}>
                  {broadcastMutation.isPending ? "Sending…" : "Broadcast offer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {driverModal && driverForm && (
        <div className="sd-modal-overlay" role="presentation" onClick={() => !driverMutation.isPending && setDriverModal(null)}>
          <div className="sd-modal" role="dialog" aria-modal="true" aria-label={driverModal.mode === "edit" ? "Edit driver" : "Add driver"} onClick={(event) => event.stopPropagation()}>
            <div className="sd-modal-head">
              <div>
                <strong>{driverModal.mode === "edit" ? "Edit driver" : "Add driver"}</strong>
                <p>{driverModal.mode === "edit" ? "Update your shop driver details and status." : "Create a new seller-owned driver for delivery assignments."}</p>
              </div>
              <button className="ghost-action compact" type="button" onClick={() => setDriverModal(null)}>Close</button>
            </div>

            <form
              className="sd-modal-form"
              onSubmit={(e) => {
                e.preventDefault();
                setDriverError("");
                const payload = {
                  name: driverForm.name.trim(),
                  phone: driverForm.phone.trim(),
                  vehicleType: driverForm.vehicleType,
                  zone: driverForm.zone.trim(),
                };
                if (driverForm.email.trim()) {
                  payload.email = driverForm.email.trim();
                }
                if (driverForm.createLogin && !driverModal.driver?.userId) {
                  payload.createLogin = true;
                  if (driverForm.loginEmail.trim()) {
                    payload.loginEmail = driverForm.loginEmail.trim();
                  }
                }
                if (driverModal.mode === "edit") {
                  payload.status = driverForm.status;
                }
                if (!payload.name || !payload.phone) {
                  setDriverError("Driver name and phone are required.");
                  return;
                }
                driverMutation.mutate({
                  mode: driverModal.mode,
                  id: driverModal.driver?.id,
                  payload,
                });
              }}
            >
              <div className="sd-modal-grid">
                <label className="sd-field">
                  <span>Name</span>
                  <input value={driverForm.name} onChange={(e) => setDriverForm((current) => ({ ...current, name: e.target.value }))} />
                </label>
                <label className="sd-field">
                  <span>Phone</span>
                  <input value={driverForm.phone} onChange={(e) => setDriverForm((current) => ({ ...current, phone: e.target.value }))} />
                </label>
                <label className="sd-field">
                  <span>Email optional</span>
                  <input value={driverForm.email} onChange={(e) => setDriverForm((current) => ({ ...current, email: e.target.value }))} />
                </label>
                <label className="sd-field">
                  <span>Vehicle type</span>
                  <select value={driverForm.vehicleType} onChange={(e) => setDriverForm((current) => ({ ...current, vehicleType: e.target.value }))}>
                    <option value="motorcycle">Motorcycle</option>
                    <option value="car">Car</option>
                    <option value="van">Van</option>
                  </select>
                </label>
                <label className="sd-field wide">
                  <span>Zone</span>
                  <input value={driverForm.zone} onChange={(e) => setDriverForm((current) => ({ ...current, zone: e.target.value }))} />
                </label>
                <label className="sd-field">
                  <span>Status</span>
                  <select
                    value={driverForm.status}
                    disabled={driverModal.mode !== "edit"}
                    onChange={(e) => setDriverForm((current) => ({ ...current, status: e.target.value }))}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="on_delivery">On delivery</option>
                  </select>
                </label>
              </div>

              {!driverModal.driver?.userId ? (
                <div className="sd-driver-login-block">
                  <label className="sd-field sd-field--check">
                    <input
                      type="checkbox"
                      checked={Boolean(driverForm.createLogin)}
                      onChange={(e) => setDriverForm((current) => ({ ...current, createLogin: e.target.checked }))}
                    />
                    <span>Create login for this driver</span>
                  </label>
                  {driverForm.createLogin ? (
                    <label className="sd-field">
                      <span>Login email</span>
                      <input
                        type="email"
                        value={driverForm.loginEmail}
                        onChange={(e) => setDriverForm((current) => ({ ...current, loginEmail: e.target.value }))}
                        placeholder="driver@shop.com"
                      />
                    </label>
                  ) : null}
                  {driverForm.createLogin ? (
                    <p className="sd-modal-note">
                      Temporary password will be shown once after saving.
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="sd-driver-login-linked-note">
                  <ShieldCheck size={13} />
                  <span>Login already linked for this driver.</span>
                </div>
              )}

              {driverModal.mode === "add" ? (
                <p className="sd-modal-note">
                  New drivers start active. Pause them later from Edit if needed.
                </p>
              ) : null}

              {driverError ? <p className="sd-modal-error">{driverError}</p> : null}

              <div className="sd-modal-actions">
                <button className="ghost-action compact" type="button" onClick={() => setDriverModal(null)}>Cancel</button>
                <button className="primary-action compact" type="submit" disabled={driverMutation.isPending}>
                  {driverMutation.isPending ? "Saving…" : driverModal.mode === "edit" ? "Save driver" : "Create driver"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {assignModalOpen && (
        <div className="sd-modal-overlay" role="presentation" onClick={() => !assignMutation.isPending && setAssignModalOpen(false)}>
          <div className="sd-modal" role="dialog" aria-modal="true" aria-label="Assign driver" onClick={(event) => event.stopPropagation()}>
            <div className="sd-modal-head">
              <div>
                <strong>Assign driver to order</strong>
                <p>Choose one of your active drivers and one of your eligible orders.</p>
              </div>
              <button className="ghost-action compact" type="button" onClick={() => setAssignModalOpen(false)}>Close</button>
            </div>

            <div className="sd-modal-callout">
              Drivers are managed by your shop. Admin can monitor delivery and COD balance.
            </div>

            <form
              className="sd-modal-form"
              onSubmit={(e) => {
                e.preventDefault();
                setAssignError("");
                if (!assignForm.driverId) {
                  setAssignError("Pick an active driver.");
                  return;
                }
                if (!assignForm.orderId) {
                  setAssignError("Pick an eligible order.");
                  return;
                }
                assignMutation.mutate({
                  driverId: assignForm.driverId,
                  orderId: assignForm.orderId,
                  payload: { force: Boolean(assignForm.force) },
                });
              }}
            >
              <div className="sd-modal-grid">
                <label className="sd-field">
                  <span>Driver</span>
                  <select
                    value={assignForm.driverId}
                    onChange={(e) => setAssignForm((current) => ({ ...current, driverId: e.target.value }))}
                    disabled={!activeDrivers.length}
                  >
                    <option value="">{activeDrivers.length ? "Select driver" : "No active drivers"}</option>
                    {activeDrivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name} · {formatDriverVehicle(driver.vehicleType)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sd-field">
                  <span>Order</span>
                  <select
                    value={assignForm.orderId}
                    onChange={(e) => setAssignForm((current) => ({ ...current, orderId: e.target.value }))}
                    disabled={!assignableOrders.length}
                  >
                    <option value="">{assignableOrders.length ? "Select order" : "No assignable orders"}</option>
                    {assignableOrders.map((order) => (
                      <option key={order.orderId} value={order.orderId}>
                        {order.orderId} · {order.customerName} · {order.status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="sd-field sd-field--check">
                <input
                  type="checkbox"
                  checked={assignForm.force}
                  onChange={(e) => setAssignForm((current) => ({ ...current, force: e.target.checked }))}
                />
                <span>Force replace any active driver assignment on this order</span>
              </label>

              <p className="sd-modal-note">
                Eligible orders are Ready for Delivery only. Use Force only when replacing the current driver.
              </p>

              {assignError ? <p className="sd-modal-error">{assignError}</p> : null}

              <div className="sd-modal-actions">
                <button className="ghost-action compact" type="button" onClick={() => setAssignModalOpen(false)}>Cancel</button>
                <button className="primary-action compact" type="submit" disabled={assignMutation.isPending || !activeDrivers.length || !assignableOrders.length}>
                  {assignMutation.isPending ? "Assigning…" : "Assign driver"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deliveryModal && (
        <div className="sd-modal-overlay" role="presentation" onClick={() => !deliveryMutation.isPending && setDeliveryModal(null)}>
          <div className="sd-modal" role="dialog" aria-modal="true" aria-label="Record delivery" onClick={(event) => event.stopPropagation()}>
            <div className="sd-modal-head">
              <div>
                <strong>Record delivery</strong>
                <p>{deliveryModal.orderId} · {deliveryModal.driverName}</p>
              </div>
              <button className="ghost-action compact" type="button" onClick={() => setDeliveryModal(null)}>Close</button>
            </div>

            <div className="sd-modal-callout">
              COD collected will increase the driver cash balance for remittance tracking. No money transfer is executed.
            </div>

            <form
              className="sd-modal-form"
              onSubmit={(e) => {
                e.preventDefault();
                setDeliveryError("");
                deliveryMutation.mutate({
                  driverId: deliveryModal.driverId,
                  orderId: deliveryModal.orderId,
                  payload: {
                    codCollected: Boolean(deliveryForm.codCollected),
                    note: deliveryForm.note.trim(),
                  },
                });
              }}
            >
              <label className="sd-field sd-field--check">
                <input
                  type="checkbox"
                  checked={deliveryForm.codCollected}
                  onChange={(e) => setDeliveryForm((current) => ({ ...current, codCollected: e.target.checked }))}
                />
                <span>COD collected</span>
              </label>

              <label className="sd-field">
                <span>Delivery note optional</span>
                <textarea
                  rows={3}
                  value={deliveryForm.note}
                  onChange={(e) => setDeliveryForm((current) => ({ ...current, note: e.target.value }))}
                  placeholder="Add a handover note, cash count, or customer update"
                />
              </label>

              {deliveryError ? <p className="sd-modal-error">{deliveryError}</p> : null}

              <div className="sd-modal-actions">
                <button className="ghost-action compact" type="button" onClick={() => setDeliveryModal(null)}>Cancel</button>
                <button className="primary-action compact" type="submit" disabled={deliveryMutation.isPending}>
                  {deliveryMutation.isPending ? "Saving…" : "Record delivery"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
