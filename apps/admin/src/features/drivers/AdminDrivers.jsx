import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Car,
  CircleDollarSign,
  Package,
  Phone,
  Plus,
  Search,
  Truck,
  UserCheck,
  WalletCards,
  X,
} from "lucide-react";
import { adminDeliveryOffersApi, driversApi, ordersApi } from "@tuti/shared/api/client.js";
import { EmptyState } from "@tuti/shared/components/EmptyState.jsx";
import { MetricCard } from "@tuti/shared/components/MetricCard.jsx";
import { PageTitle } from "@tuti/shared/components/PageTitle.jsx";
import { PanelHeader } from "@tuti/shared/components/PanelHeader.jsx";
import { formatCurrency } from "@tuti/shared/utils/money.js";

const VEHICLE_ICONS = { motorcycle: Truck, car: Car, van: Truck };
const STATUS_TONE   = { active: "success", inactive: "warning", on_delivery: "brand" };

const BLANK_FORM = { name: "", phone: "", email: "", vehicleType: "motorcycle", zone: "" };

const normalize = (value) => String(value || "").toLowerCase().trim();

const formatShortDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const formatOfferTimeRemaining = (value) => {
  if (!value) return "—";
  const expiresAt = new Date(value).getTime();
  if (Number.isNaN(expiresAt)) return "—";
  const delta = expiresAt - Date.now();
  if (delta <= 0) return "Expired";
  const minutes = Math.ceil(delta / 60000);
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours}h left`;
  const days = Math.ceil(hours / 24);
  return `${days}d left`;
};

const getOfferTone = (status) => {
  if (status === "Accepted") return "success";
  if (status === "Cancelled") return "danger";
  if (status === "Expired") return "warning";
  return "brand";
};

const getDriverShopLabel = (driver) => {
  if (!driver?.shopId) return "Platform driver";
  return driver.shopName || driver.shopId;
};

const getDriverShopKey = (driver) => (driver?.shopId ? driver.shopId : "__platform__");

const getOrderShopLabel = (order) => {
  if (!order) return "Shop not listed";
  if (order.shopName) return order.shopName;
  if (order.shop) return order.shop;
  if (order.shopId) return order.shopId;
  if (Array.isArray(order.shopNames) && order.shopNames.length) return order.shopNames.join(", ");
  if (Array.isArray(order.shopIds) && order.shopIds.length) return order.shopIds.join(", ");
  return "Shop not listed";
};

const isAssignableDriver = (driver) => driver?.status !== "inactive" && driver?.isActive !== false;

export function AdminDrivers() {
  const qc = useQueryClient();
  const [showCreate,    setShowCreate]    = useState(false);
  const [form,          setForm]          = useState(BLANK_FORM);
  const [createError,   setCreateError]   = useState("");
  const [searchTerm,    setSearchTerm]    = useState("");
  const [statusFilter,  setStatusFilter]  = useState("all");
  const [shopFilter,    setShopFilter]    = useState("all");
  const [offerSearchTerm, setOfferSearchTerm] = useState("");
  const [offerStatusFilter, setOfferStatusFilter] = useState("all");
  const [assigningOrder, setAssigningOrder] = useState(null); // orderId being assigned
  const [assignDriverId, setAssignDriverId] = useState("");
  const [assignError,   setAssignError]   = useState("");
  const [settleDriverId,   setSettleDriverId]   = useState(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());
  const [settleError,      setSettleError]      = useState("");
  const [settleResult,     setSettleResult]     = useState(null);

  // ── Data fetches ─────────────────────────────────────────────────────
  const { data: driversData, isLoading: driversLoading } = useQuery({
    queryKey: ["drivers"],
    queryFn:  () => driversApi.list(),
  });

  const { data: ordersData } = useQuery({
    queryKey: ["admin-orders-assignable"],
    queryFn:  () => ordersApi.list({ limit: 50 }),
  });

  const { data: deliveryOffersData, isLoading: deliveryOffersLoading } = useQuery({
    queryKey: ["admin-delivery-offers"],
    queryFn:  () => adminDeliveryOffersApi.list(),
  });

  const drivers = driversData?.drivers || [];
  const orders  = ordersData?.orders   || [];
  const deliveryOffers = Array.isArray(deliveryOffersData)
    ? deliveryOffersData
    : deliveryOffersData?.offers || deliveryOffersData?.deliveryOffers || [];
  const assignableOrders = orders.filter((o) => ["Ready for Delivery", "Shipped"].includes(o.status));
  const activeAssignableDrivers = drivers.filter(isAssignableDriver);

  const shopFilterOptions = [
    { value: "all", label: "All shops" },
    { value: "__platform__", label: "Platform drivers" },
    ...Array.from(
      new Map(
        drivers
          .filter((driver) => driver.shopId)
          .map((driver) => [driver.shopId, { value: driver.shopId, label: driver.shopName || driver.shopId }]),
      ).values(),
    ),
  ];

  const filteredDrivers = drivers.filter((driver) => {
    const driverStatus = driver.status || (driver.isActive ? "active" : "inactive");
    const driverShopKey = getDriverShopKey(driver);
    const matchesSearch = !normalize(searchTerm) || [
      driver.name,
      driver.phone,
      driver.email,
      driver.zone,
      driver.vehicleType,
      driver.shopName,
      driver.shopId,
    ].some((value) => normalize(value).includes(normalize(searchTerm)));
    const matchesStatus = statusFilter === "all" || driverStatus === statusFilter;
    const matchesShop = shopFilter === "all" || driverShopKey === shopFilter;
    return matchesSearch && matchesStatus && matchesShop;
  });
  const filteredDeliveryOffers = deliveryOffers.filter((offer) => {
    const matchesStatus = offerStatusFilter === "all" || normalize(offer.status) === normalize(offerStatusFilter);
    const matchesSearch = !normalize(offerSearchTerm) || [
      offer.orderId,
      offer.shopName,
      offer.shopId,
      offer.deliveryZone,
      offer.acceptedDriverName,
      offer.notes,
      String(offer.offeredDriverIds?.length || 0),
    ].some((value) => normalize(value).includes(normalize(offerSearchTerm)));
    return matchesStatus && matchesSearch;
  });
  const selectedAssignOrder = assignableOrders.find((order) => order.orderId === assigningOrder);
  const selectedAssignDriver = drivers.find((driver) => driver.id === assignDriverId);
  const offerStats = {
    total: deliveryOffers.length,
    open: deliveryOffers.filter((offer) => offer.status === "Open").length,
    accepted: deliveryOffers.filter((offer) => offer.status === "Accepted").length,
    expired: deliveryOffers.filter((offer) => offer.status === "Expired").length,
    cancelled: deliveryOffers.filter((offer) => offer.status === "Cancelled").length,
  };

  // ── Mutations ─────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (payload) => driversApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drivers"] });
      setShowCreate(false);
      setForm(BLANK_FORM);
      setCreateError("");
    },
    onError: (err) => setCreateError(err?.message || "Failed to create driver."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => driversApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drivers"] }),
  });

  const assignMutation = useMutation({
    mutationFn: ({ driverId, orderId }) => driversApi.assign(driverId, orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drivers"] });
      qc.invalidateQueries({ queryKey: ["admin-orders-assignable"] });
      setAssigningOrder(null);
      setAssignDriverId("");
      setAssignError("");
    },
    onError: (err) => setAssignError(err?.message || "Assignment failed."),
  });

  const { data: candidatesData, isLoading: candidatesLoading } = useQuery({
    queryKey: ["cod-candidates", settleDriverId],
    queryFn:  () => driversApi.getCodSettlementCandidates(settleDriverId),
    enabled:  Boolean(settleDriverId) && !settleResult,
  });
  const candidates = candidatesData?.data?.candidates || [];

  const settleMutation = useMutation({
    mutationFn: ({ driverId, orderIds }) => driversApi.settleCodOrders(driverId, { orderIds }),
    onSuccess: (data) => {
      setSettleResult(data?.data ?? data);
      setSettleError("");
      qc.invalidateQueries({ queryKey: ["drivers"] });
      qc.invalidateQueries({ queryKey: ["cod-candidates", settleDriverId] });
    },
    onError: (err) => setSettleError(err?.message || "Settlement failed."),
  });

  // ── Derived stats ─────────────────────────────────────────────────────
  const activeDrivers     = drivers.filter((d) => d.status === "active").length;
  const onDeliveryDrivers = drivers.filter((d) => d.status === "on_delivery").length;
  const totalCodBalance   = drivers.reduce((s, d) => s + (d.codBalance || 0), 0);
  const totalDeliveries   = drivers.reduce((s, d) => s + (d.totalDeliveries || 0), 0);

  return (
    <main className="workspace">
      <PageTitle
        kicker="Fleet"
        title="Drivers & COD Monitoring"
        description="Sellers manage their own drivers. Admin can monitor assignments, COD balances, and override when needed."
      />

      <p className="drivers-monitoring-note">
        Sellers manage their own drivers. Platform drivers remain visible for oversight, while admin can monitor assignments, COD balances, and override when needed.
      </p>

      <section className="metric-grid">
        <MetricCard icon={UserCheck}       label="Active drivers"   value={activeDrivers}                       note={`${onDeliveryDrivers} on delivery`} />
        <MetricCard icon={Truck}           label="Total deliveries" value={totalDeliveries}                     note="All time" />
        <MetricCard icon={WalletCards}     label="COD balance"      value={formatCurrency(totalCodBalance)}     note="Pending remittance" />
        <MetricCard icon={Package}         label="Assignable orders" value={assignableOrders.length}            note="Ready or shipped" />
      </section>

      {(assignableOrders.length === 0 || activeAssignableDrivers.length === 0) && (
        <div className="drivers-alert-row">
          <AlertTriangle size={14} />
          <span>
            {assignableOrders.length === 0
              ? "No assignable orders right now. Ready for Delivery and Shipped orders will appear here."
              : "No active drivers available for assignment. Activate a seller-owned driver or a platform driver to continue."}
          </span>
        </div>
      )}

      {/* Action bar */}
      <div className="drivers-toolbar">
        <div className="drivers-toolbar-filters">
          <label className="drivers-search-field">
            <Search size={14} />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search name, phone, zone, or shop"
            />
          </label>
          <label className="drivers-filter-select">
            <span>Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="on_delivery">On delivery</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="drivers-filter-select">
            <span>Shop</span>
            <select value={shopFilter} onChange={(e) => setShopFilter(e.target.value)}>
              {shopFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="drivers-toolbar-actions">
          <button className="primary-action compact" type="button" onClick={() => setShowCreate(true)}>
            <Plus size={15} /> Add driver
          </button>
          <button
            className="secondary-action compact"
            type="button"
            onClick={() => {
              if (!assignableOrders.length || !activeAssignableDrivers.length) return;
              setAssigningOrder(assignableOrders[0].orderId);
              setAssignDriverId("");
              setAssignError("");
            }}
            disabled={!assignableOrders.length || !activeAssignableDrivers.length}
            title={!assignableOrders.length || !activeAssignableDrivers.length ? "Need an eligible order and an active driver" : "Assign driver to order"}
          >
            <Truck size={15} /> Assign driver to order
          </button>
        </div>
      </div>

      {/* Create driver modal */}
      {showCreate && (
        <div className="drivers-modal-overlay">
          <div className="drivers-modal">
            <div className="drivers-modal-head">
              <strong>Add new driver</strong>
              <button className="icon-button" type="button" onClick={() => { setShowCreate(false); setCreateError(""); }}><X size={16} /></button>
            </div>
            <form
              className="drivers-create-form"
              onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }}
            >
              <label className="admin-contract-field">
                <span>Full name</span>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mohammed Al-Rashidi" />
              </label>
              <label className="admin-contract-field">
                <span>Phone</span>
                <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+971 55 000 1234" />
              </label>
              <label className="admin-contract-field">
                <span>Email (optional)</span>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="driver@example.com" />
              </label>
              <div className="drivers-form-row">
                <label className="admin-contract-field">
                  <span>Vehicle</span>
                  <select value={form.vehicleType} onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}>
                    <option value="motorcycle">Motorcycle</option>
                    <option value="car">Car</option>
                    <option value="van">Van</option>
                  </select>
                </label>
                <label className="admin-contract-field">
                  <span>Zone</span>
                  <input value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} placeholder="Dubai Marina" />
                </label>
              </div>
              {createError && <p className="admin-contract-error">{createError}</p>}
              <div className="admin-contract-modal-actions">
                <button className="ghost-action compact" type="button" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="primary-action compact" type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating…" : "Create driver"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign driver modal */}
      {assigningOrder && (
        <div className="drivers-modal-overlay">
          <div className="drivers-modal">
            <div className="drivers-modal-head">
              <strong>Assign driver to order</strong>
              <button className="icon-button" type="button" onClick={() => { setAssigningOrder(null); setAssignError(""); }}><X size={16} /></button>
            </div>
            <div className="drivers-assign-form">
              <p className="drivers-remit-note">
                Drivers are managed by your shop. Admin can monitor delivery and COD balance.
              </p>
              <label className="admin-contract-field">
                <span>Order</span>
                <select value={assigningOrder} onChange={(e) => setAssigningOrder(e.target.value)}>
                  {assignableOrders.map((o) => (
                    <option key={o.orderId} value={o.orderId}>
                      {o.orderId} · {o.customerName} · {o.status} · {getOrderShopLabel(o)}
                    </option>
                  ))}
                </select>
              </label>
              {selectedAssignOrder && (
                <div className="drivers-context-strip">
                  <strong>Selected order</strong>
                  <span>{selectedAssignOrder.orderId}</span>
                  <span>{selectedAssignOrder.customerName}</span>
                  <span>{getOrderShopLabel(selectedAssignOrder)}</span>
                </div>
              )}
              <label className="admin-contract-field">
                <span>Driver</span>
                <select value={assignDriverId} onChange={(e) => setAssignDriverId(e.target.value)}>
                  <option value="">— select driver —</option>
                  {drivers.filter(isAssignableDriver).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} · {d.zone || "No zone"} · {d.vehicleType} · {getDriverShopLabel(d)}
                    </option>
                  ))}
                </select>
              </label>
              {selectedAssignDriver && (
                <div className="drivers-context-strip">
                  <strong>Selected driver</strong>
                  <span>{selectedAssignDriver.name}</span>
                  <span>{getDriverShopLabel(selectedAssignDriver)}</span>
                  <span>{selectedAssignDriver.zone || "No zone"}</span>
                </div>
              )}
              {(!assignableOrders.length || !activeAssignableDrivers.length) && (
                <p className="drivers-empty-inline">
                  {!assignableOrders.length
                    ? "No eligible orders are ready for delivery yet."
                    : "No active drivers are available for assignment right now."}
                </p>
              )}
              {assignError && <p className="admin-contract-error">{assignError}</p>}
              <div className="admin-contract-modal-actions">
                <button className="ghost-action compact" type="button" onClick={() => setAssigningOrder(null)}>Cancel</button>
                <button
                  className="primary-action compact"
                  type="button"
                  disabled={!assignDriverId || assignMutation.isPending}
                  onClick={() => assignMutation.mutate({ driverId: assignDriverId, orderId: assigningOrder })}
                >
                  {assignMutation.isPending ? "Assigning…" : "Assign"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COD settlement modal */}
      {settleDriverId && !settleResult && (
        <div className="drivers-modal-overlay">
          <div className="drivers-modal drivers-modal--wide">
            <div className="drivers-modal-head">
              <strong>Settle COD orders</strong>
              <button className="icon-button" type="button" onClick={() => setSettleDriverId(null)}><X size={16} /></button>
            </div>
            <div className="drivers-assign-form">
              <p className="drivers-remit-note">
                <AlertTriangle size={13} />
                Confirm only after cash has been physically received from the driver.
              </p>
              {candidatesLoading ? (
                <p className="drivers-empty-inline">Loading eligible orders…</p>
              ) : candidates.length === 0 ? (
                <p className="drivers-empty-inline">No eligible COD orders to settle for this driver.</p>
              ) : (
                <div className="drivers-settle-list">
                  {candidates.map((c) => (
                    <label key={c.orderId} className="drivers-settle-row">
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.has(c.orderId)}
                        onChange={(e) => {
                          const next = new Set(selectedOrderIds);
                          e.target.checked ? next.add(c.orderId) : next.delete(c.orderId);
                          setSelectedOrderIds(next);
                        }}
                      />
                      <div className="drivers-settle-detail">
                        <strong>{c.orderId}</strong>
                        <span>{c.customerName}</span>
                        <span className="drivers-settle-shops">{c.shopIds?.join(", ")}</span>
                      </div>
                      <div className="drivers-settle-amounts">
                        <span>Cash <strong>{formatCurrency(c.codAmount)}</strong></span>
                        <span>Credit <strong>{formatCurrency(c.vendorNet)}</strong></span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {selectedOrderIds.size > 0 && (
                <div className="drivers-settle-summary">
                  <span>{selectedOrderIds.size} order{selectedOrderIds.size !== 1 ? "s" : ""} selected</span>
                  <strong>
                    {formatCurrency(
                      candidates
                        .filter((c) => selectedOrderIds.has(c.orderId))
                        .reduce((s, c) => s + c.codAmount, 0)
                    )} total cash
                  </strong>
                </div>
              )}
              {settleError && <p className="admin-contract-error">{settleError}</p>}
              <div className="admin-contract-modal-actions">
                <button className="ghost-action compact" type="button" onClick={() => setSettleDriverId(null)}>Cancel</button>
                <button
                  className="primary-action compact"
                  type="button"
                  disabled={selectedOrderIds.size === 0 || settleMutation.isPending}
                  onClick={() => settleMutation.mutate({ driverId: settleDriverId, orderIds: [...selectedOrderIds] })}
                >
                  {settleMutation.isPending ? "Settling…" : `Settle ${selectedOrderIds.size || ""} order${selectedOrderIds.size !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COD settlement success */}
      {settleResult && (
        <div className="drivers-modal-overlay">
          <div className="drivers-modal">
            <div className="drivers-modal-head">
              <strong>Settlement complete</strong>
              <button className="icon-button" type="button" onClick={() => { setSettleDriverId(null); setSettleResult(null); }}><X size={16} /></button>
            </div>
            <div className="drivers-assign-form">
              <p className="drivers-remit-note">
                {settleResult.settledOrders?.length} order{settleResult.settledOrders?.length !== 1 ? "s" : ""} settled.
                Cash received: {formatCurrency(settleResult.totalCashAmount)}.
                Driver balance now: {formatCurrency(settleResult.driverCodBalanceAfter)}.
              </p>
              <p className="drivers-cod-note">Ref: {settleResult.settlementRef}</p>
              <div className="admin-contract-modal-actions">
                <button className="primary-action compact" type="button" onClick={() => { setSettleDriverId(null); setSettleResult(null); }}>Done</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Driver table */}
      <section className="panel">
        <PanelHeader icon={Truck} title="Driver roster" action={`${filteredDrivers.length} shown`} />
        {driversLoading ? (
          <div className="app-status">Loading drivers…</div>
        ) : drivers.length === 0 ? (
          <EmptyState icon={Truck} text="No drivers yet. Add your first driver to start assigning deliveries." />
        ) : filteredDrivers.length === 0 ? (
          <EmptyState icon={Truck} text="No drivers match the current shop, status, or search filters." />
        ) : (
          <div className="drivers-table">
            <div className="drivers-table-head">
              <span>Driver</span>
              <span>Shop</span>
              <span>Vehicle / Zone</span>
              <span>Status</span>
              <span>Deliveries</span>
              <span>COD balance</span>
              <span>Actions</span>
            </div>
            {filteredDrivers.map((driver) => {
              const VehicleIcon = VEHICLE_ICONS[driver.vehicleType] || Truck;
              return (
                <div className="drivers-table-row" key={driver.id}>
                  <div className="drivers-driver-col">
                    <strong>{driver.name}</strong>
                    <span><Phone size={12} /> {driver.phone}</span>
                    {driver.email && <span>{driver.email}</span>}
                  </div>
                  <div className="drivers-shop-col">
                    <span className={`drivers-shop-badge ${driver.shopId ? "" : "drivers-shop-badge--platform"}`}>
                      {getDriverShopLabel(driver)}
                    </span>
                    {driver.shopId && <span>{driver.shopId}</span>}
                  </div>
                  <div className="drivers-vehicle-col">
                    <span><VehicleIcon size={13} /> {driver.vehicleType}</span>
                    {driver.zone && <span className="drivers-zone">{driver.zone}</span>}
                  </div>
                  <div className="drivers-status-col">
                    <span className={`drivers-status-badge drivers-status-badge--${STATUS_TONE[driver.status] || "warning"}`}>
                      {driver.status === "on_delivery" ? "On delivery" : driver.status === "active" ? "Active" : "Inactive"}
                    </span>
                    <div className="drivers-active-toggle">
                      <select
                        value={driver.status}
                        onChange={(e) => updateMutation.mutate({ id: driver.id, payload: { status: e.target.value } })}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="on_delivery">On delivery</option>
                      </select>
                    </div>
                  </div>
                  <div className="drivers-deliveries-col">
                    <strong>{driver.totalDeliveries || 0}</strong>
                    <span>total</span>
                  </div>
                  <div className="drivers-cod-col">
                    <strong className={driver.codBalance > 0 ? "drivers-cod-due" : ""}>{formatCurrency(driver.codBalance || 0)}</strong>
                    {driver.codBalance > 0 && (
                      <span className="drivers-cod-label">pending settlement</span>
                    )}
                  </div>
                  <div className="drivers-actions">
                    {driver.codBalance > 0 && (
                      <button
                        className="secondary-action compact"
                        type="button"
                        onClick={() => { setSettleDriverId(driver.id); setSelectedOrderIds(new Set()); setSettleResult(null); setSettleError(""); }}
                      >
                        <CircleDollarSign size={13} /> Settle COD
                      </button>
                    )}
                    <button
                      className="ghost-action compact"
                      type="button"
                      onClick={() => { setAssigningOrder(assignableOrders[0]?.orderId || ""); setAssignDriverId(driver.id); setAssignError(""); }}
                      disabled={!isAssignableDriver(driver) || !assignableOrders.length}
                      title="Assign to order"
                    >
                      <Package size={13} /> Assign
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Delivery offer monitoring */}
      <section className="panel drivers-offers-panel">
        <PanelHeader icon={Package} title="Broadcast delivery offers" action={`${deliveryOffers.length} total`} />
        <p className="drivers-offers-note">
          Sellers can broadcast eligible deliveries to their own drivers. First driver to accept gets the assignment.
        </p>
        <div className="drivers-offers-stats">
          <div className="drivers-offers-stat">
            <strong>{offerStats.open}</strong>
            <span>Open</span>
          </div>
          <div className="drivers-offers-stat">
            <strong>{offerStats.accepted}</strong>
            <span>Accepted</span>
          </div>
          <div className="drivers-offers-stat">
            <strong>{offerStats.expired}</strong>
            <span>Expired</span>
          </div>
          <div className="drivers-offers-stat">
            <strong>{offerStats.cancelled}</strong>
            <span>Cancelled</span>
          </div>
          <div className="drivers-offers-stat">
            <strong>{offerStats.total}</strong>
            <span>Total</span>
          </div>
        </div>
        <div className="drivers-offers-toolbar">
          <label className="drivers-search-field">
            <Search size={14} />
            <input
              type="search"
              value={offerSearchTerm}
              onChange={(e) => setOfferSearchTerm(e.target.value)}
              placeholder="Search order, shop, driver, or zone"
            />
          </label>
          <label className="drivers-filter-select">
            <span>Status</span>
            <select value={offerStatusFilter} onChange={(e) => setOfferStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="Open">Open</option>
              <option value="Accepted">Accepted</option>
              <option value="Expired">Expired</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </label>
        </div>
        {deliveryOffersLoading ? (
          <div className="app-status">Loading delivery offers…</div>
        ) : deliveryOffers.length === 0 ? (
          <EmptyState
            icon={Package}
            text="No broadcast delivery offers yet. Sellers will see them here once they start broadcasting eligible orders."
          />
        ) : filteredDeliveryOffers.length === 0 ? (
          <EmptyState
            icon={Package}
            text="No offers match the current search or status filter."
          />
        ) : (
          <div className="drivers-offers-table">
            <div className="drivers-offers-head">
              <span>Order</span>
              <span>Shop</span>
              <span>Zone</span>
              <span>Status</span>
              <span>Drivers</span>
              <span>Timing</span>
              <span>Notes</span>
            </div>
            {filteredDeliveryOffers.map((offer) => (
              <div className="drivers-offers-row" key={offer.id}>
                <div className="drivers-offers-order">
                  <strong>{offer.orderId}</strong>
                  <span>{offer.codAmount ? formatCurrency(offer.codAmount) : "No COD"}</span>
                </div>
                <div className="drivers-offers-shop">
                  <span className={`drivers-shop-badge ${offer.shopId ? "" : "drivers-shop-badge--platform"}`}>
                    {offer.shopName || "Shop not listed"}
                  </span>
                  <small>{offer.shopId || "No shop id"}</small>
                </div>
                <div className="drivers-offers-zone">
                  <strong>{offer.deliveryZone || "—"}</strong>
                  <span>{offer.deliveryAddressSummary || "No delivery summary"}</span>
                </div>
                <div className="drivers-offers-status">
                  <span className={`drivers-offers-status-badge drivers-offers-status-badge--${getOfferTone(offer.status)}`}>
                    {offer.status}
                  </span>
                  {offer.status === "Accepted" && offer.acceptedDriverName && (
                    <small>Accepted by {offer.acceptedDriverName}</small>
                  )}
                </div>
                <div className="drivers-offers-drivers">
                  <strong>{offer.offeredDriverIds?.length || 0}</strong>
                  <span>offered</span>
                </div>
                <div className="drivers-offers-timing">
                  <strong>{formatOfferTimeRemaining(offer.expiresAt)}</strong>
                  <span>Expires {formatShortDateTime(offer.expiresAt)}</span>
                  <small>Created {formatShortDateTime(offer.createdAt)}</small>
                </div>
                <div className="drivers-offers-notes">
                  <span>{offer.notes || "—"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* COD overview */}
      {drivers.some((d) => d.codBalance > 0) && (
        <section className="panel">
          <PanelHeader icon={WalletCards} title="Pending COD settlement" action={formatCurrency(totalCodBalance)} />
          <div className="drivers-cod-summary">
            {drivers.filter((d) => d.codBalance > 0).map((d) => (
              <div className="drivers-cod-row" key={d.id}>
                <div className="drivers-cod-driver">
                  <strong>{d.name}</strong>
                  <span>{d.zone || "No zone"}</span>
                </div>
                <span className={`drivers-shop-badge ${d.shopId ? "" : "drivers-shop-badge--platform"}`}>
                  {getDriverShopLabel(d)}
                </span>
                <strong className="drivers-cod-due">{formatCurrency(d.codBalance)}</strong>
                <button
                  className="secondary-action compact"
                  type="button"
                  onClick={() => { setSettleDriverId(d.id); setSelectedOrderIds(new Set()); setSettleResult(null); setSettleError(""); }}
                >
                  Settle orders
                </button>
              </div>
            ))}
            <p className="drivers-cod-note">
              <AlertTriangle size={13} />
              Select a driver to view and settle their COD-collected orders. Confirm only after cash is physically received.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
