import { useAuthStore } from "../store/authStore.js";

const API_BASE = import.meta.env?.VITE_API_URL
  || (import.meta.env?.DEV ? "http://localhost:5055/api" : "/api");

async function refreshAccessToken() {
  const { refreshToken, updateAccessToken, clearAuth } = useAuthStore.getState();
  if (!refreshToken) { clearAuth(); return null; }
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) { clearAuth(); return null; }
  const payload = await res.json();
  updateAccessToken(payload.data.accessToken);
  return payload.data.accessToken;
}

async function request(path, options = {}, retry = true) {
  const { accessToken } = useAuthStore.getState();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (response.status === 401 && retry) {
    const token = await refreshAccessToken();
    if (token) return request(path, options, false);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "API request failed.");
  return payload.data;
}

export const authApi = {
  register: (p) => request("/auth/register", { method: "POST", body: JSON.stringify(p) }),
  login:    (p) => request("/auth/login",    { method: "POST", body: JSON.stringify(p) }),
  logout:   ()  => request("/auth/logout",   { method: "POST" }),
  me:       ()  => request("/auth/me"),
};

export const marketplaceApi = {
  getStorefront: ()        => request("/marketplace/storefront"),
  getSeller: (shopId)      => request(`/marketplace/seller${shopId ? `?shopId=${encodeURIComponent(shopId)}` : ""}`),
  getAdmin:  ()            => request("/marketplace/admin"),
  getAdminAnalyticsSummary: () => request("/marketplace/admin/analytics/summary"),
  listAdminCustomers: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString();
    return request(`/marketplace/admin/customers${q ? `?${q}` : ""}`);
  },
  search: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString();
    return request(`/marketplace/search${q ? `?${q}` : ""}`);
  },
  createReview:      (p)             => request("/marketplace/reviews", { method: "POST", body: JSON.stringify(p) }),
  createSellerProduct: (p)           => request("/marketplace/seller/products", { method: "POST", body: JSON.stringify(p) }),
  updateProductStatus: (id, status)  => request(`/marketplace/admin/products/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  updatePayoutStatus:  (id, status)  => request(`/marketplace/admin/payouts/${id}/status`,   { method: "PATCH", body: JSON.stringify({ status }) }),
  capturePayment:      (id)          => request(`/marketplace/admin/payments/${id}/capture`, { method: "PATCH" }),
  updateShopPaymentRules: (shopId, rules) =>
    request(`/marketplace/admin/shops/${shopId}/payment-rules`, { method: "PATCH", body: JSON.stringify(rules) }),
  addShopAdminNotice: (shopId, payload) =>
    request(`/marketplace/admin/shops/${shopId}/notices`, { method: "POST", body: JSON.stringify(payload) }),
  updateShopContractStatus: (shopId, payload) =>
    request(`/marketplace/admin/shops/${shopId}/contract-status`, { method: "PATCH", body: JSON.stringify(payload) }),
  submitSellerActionPlan: (noticeId, plan) =>
    request(`/marketplace/seller/notices/${noticeId}/action-plan`, { method: "PATCH", body: JSON.stringify({ plan }) }),
  updateSellerProduct: (productId, payload) =>
    request(`/marketplace/seller/products/${productId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  updateSellerStock: (productId, payload) =>
    request(`/marketplace/seller/products/${productId}/stock`, { method: "PATCH", body: JSON.stringify(payload) }),
  listSalesReps: () => request("/marketplace/admin/sales-reps"),
  createSalesRep: (payload) => request("/marketplace/admin/sales-reps", { method: "POST", body: JSON.stringify(payload) }),
  listReferrals: () => request("/marketplace/admin/referrals"),
  listCommissionEntries: () => request("/marketplace/admin/commission-entries"),
  getCommissionPlans: () => request("/marketplace/admin/commission-plans"),
};

export const adminMerchandisingApi = {
  listFeaturedSellers: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString();
    return request(`/admin/merchandising/featured-sellers${q ? `?${q}` : ""}`);
  },
  listFeaturedProducts: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString();
    return request(`/admin/merchandising/featured-products${q ? `?${q}` : ""}`);
  },
  listBrandProfiles: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString();
    return request(`/admin/merchandising/seller-brand-profiles${q ? `?${q}` : ""}`);
  },
  createFeaturedSeller: (payload) => request("/admin/merchandising/featured-sellers", { method: "POST", body: JSON.stringify(payload) }),
  updateFeaturedSeller: (id, payload) => request(`/admin/merchandising/featured-sellers/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteFeaturedSeller: (id) => request(`/admin/merchandising/featured-sellers/${id}`, { method: "DELETE" }),
  createFeaturedProduct: (payload) => request("/admin/merchandising/featured-products", { method: "POST", body: JSON.stringify(payload) }),
  updateFeaturedProduct: (id, payload) => request(`/admin/merchandising/featured-products/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteFeaturedProduct: (id) => request(`/admin/merchandising/featured-products/${id}`, { method: "DELETE" }),
  listCollections: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString();
    return request(`/admin/merchandising/collections${q ? `?${q}` : ""}`);
  },
  getCollection: (id) => request(`/admin/merchandising/collections/${id}`),
  createCollection: (payload) => request("/admin/merchandising/collections", { method: "POST", body: JSON.stringify(payload) }),
  updateCollection: (id, payload) => request(`/admin/merchandising/collections/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteCollection: (id) => request(`/admin/merchandising/collections/${id}`, { method: "DELETE" }),
};

export const sellerBrandProfileApi = {
  get: () => request("/seller/brand-profile"),
  update: (payload) => request("/seller/brand-profile", { method: "PATCH", body: JSON.stringify(payload) }),
  preview: () => request("/seller/brand-profile/preview"),
};

export const sellerPerformanceApi = {
  getSummary: (range = "30d") => {
    const safeRange = ["7d", "30d", "90d"].includes(range) ? range : "30d";
    const q = new URLSearchParams({ range: safeRange }).toString();
    return request(`/seller/performance-summary?${q}`);
  },
};

export const publicSellerBrandApi = {
  getProfile: (slug) => request(`/public/sellers/${encodeURIComponent(slug)}`),
  getProducts: (slug) => request(`/public/sellers/${encodeURIComponent(slug)}/products`),
};

export const publicMerchandisingApi = {
  getFeaturedSellers: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString();
    return request(`/public/merchandising/featured-sellers${q ? `?${q}` : ""}`);
  },
  getFeaturedProducts: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString();
    return request(`/public/merchandising/featured-products${q ? `?${q}` : ""}`);
  },
};

export const publicCollectionsApi = {
  list: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString();
    return request(`/public/collections${q ? `?${q}` : ""}`);
  },
  getBySlug: (slug) => request(`/public/collections/${encodeURIComponent(slug)}`),
};

export const marketplaceEventsApi = {
  track: (eventOrEvents) => {
    const payload = Array.isArray(eventOrEvents)
      ? { events: eventOrEvents }
      : eventOrEvents;
    return request("/events/marketplace", { method: "POST", body: JSON.stringify(payload) });
  },
};

export const adminOperationsApi = {
  summary: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString();
    return request(`/marketplace/admin/operations/summary${q ? `?${q}` : ""}`);
  },
};

export const ordersApi = {
  create:         (p, idempotencyKey) => request("/orders", {
    method: "POST",
    body: JSON.stringify(p),
    ...(idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : {}),
  }),
  list:           (params = {})    => request(`/orders?${new URLSearchParams(params)}`),
  get:            (id, guestToken) => request(`/orders/${id}${guestToken ? `?token=${encodeURIComponent(guestToken)}` : ""}`),
  updateStatus:   (id, status, opts = {}) => request(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, ...opts }) }),
  customerAction: (id, action, note) => request(`/orders/${id}/customer-action`, { method: "PATCH", body: JSON.stringify({ action, ...(note ? { note } : {}) }) }),
  updateSupportCase: (id, payload) => request(`/orders/${id}/support-case`, { method: "PATCH", body: JSON.stringify(payload) }),
  updateResolutionDecision: (id, payload) => request(`/orders/${id}/resolution-decision`, { method: "PATCH", body: JSON.stringify(payload) }),
  finalizeResolutionDecision: (id) => request(`/orders/${id}/resolution-decision/finalize`, { method: "POST", body: JSON.stringify({}) }),
};

export const notificationsApi = {
  list:       (unreadOnly = false) => request(`/notifications${unreadOnly ? "?unread=true" : ""}`),
  count:      ()  => request("/notifications/count"),
  markRead:   (id) => request(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead:()  => request("/notifications/read-all", { method: "PATCH" }),
};

export const usersApi = {
  list:  (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString();
    return request(`/users${q ? `?${q}` : ""}`);
  },
  roles: ()           => request("/users/roles"),
  create:(p)          => request("/users",               { method: "POST",  body: JSON.stringify(p) }),
  update:(id, p)      => request(`/users/${id}`,         { method: "PATCH", body: JSON.stringify(p) }),
  resetPassword: (id, password) => request(`/users/${id}/password`, { method: "PATCH", body: JSON.stringify({ password }) }),
};

export const sellerApplicationsApi = {
  create: (payload) =>
    request("/seller-applications", { method: "POST", body: JSON.stringify(payload) }),
  list: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString();
    return request(`/seller-applications${q ? `?${q}` : ""}`);
  },
  get:            (id)          => request(`/seller-applications/${id}`),
  update:         (id, payload) => request(`/seller-applications/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  addNote:        (id, payload) => request(`/seller-applications/${id}/notes`, { method: "POST", body: JSON.stringify(payload) }),
  deleteNote:     (id, noteId)  => request(`/seller-applications/${id}/notes/${noteId}`, { method: "DELETE" }),
  updateChecklist:(id, payload) => request(`/seller-applications/${id}/checklist`, { method: "PATCH", body: JSON.stringify(payload) }),
  convertToSeller:(id)          => request(`/seller-applications/${id}/convert-to-seller`, { method: "POST", body: JSON.stringify({}) }),
};

export const crmApi = {
  listCustomers:  (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString();
    return request(`/crm/customers${q ? `?${q}` : ""}`);
  },
  getCustomer:    (id)             => request(`/crm/customers/${id}`),
  updateCustomer: (id, payload)    => request(`/crm/customers/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  addNote:        (id, payload)    => request(`/crm/customers/${id}/notes`, { method: "POST", body: JSON.stringify(payload) }),
  deleteNote:     (id, noteId)     => request(`/crm/customers/${id}/notes/${noteId}`, { method: "DELETE" }),
};

export const supportTicketsApi = {
  create: (payload) => request("/support/tickets", { method: "POST", body: JSON.stringify(payload) }),
  list: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString();
    return request(`/support/tickets${q ? `?${q}` : ""}`);
  },
  get: (ticketId) => request(`/support/tickets/${ticketId}`),
  reply: (ticketId, payload) => request(`/support/tickets/${ticketId}/replies`, { method: "POST", body: JSON.stringify(payload) }),
  adminList: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString();
    return request(`/admin/support/tickets${q ? `?${q}` : ""}`);
  },
  adminGet: (ticketId) => request(`/admin/support/tickets/${ticketId}`),
  updateStatus: (ticketId, status) => request(`/admin/support/tickets/${ticketId}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  assign: (ticketId, payload) => request(`/admin/support/tickets/${ticketId}/assign`, { method: "PATCH", body: JSON.stringify(payload) }),
  addInternalNote: (ticketId, payload) => request(`/admin/support/tickets/${ticketId}/internal-notes`, { method: "POST", body: JSON.stringify(payload) }),
  convertToDispute: (ticketId, payload) => request(`/admin/support/tickets/${ticketId}/convert-dispute`, { method: "POST", body: JSON.stringify(payload) }),
};

export const driversApi = {
  list:            (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString();
    return request(`/drivers${q ? `?${q}` : ""}`);
  },
  get:             (id)                  => request(`/drivers/${id}`),
  create:          (payload)             => request("/drivers", { method: "POST", body: JSON.stringify(payload) }),
  update:          (id, payload)         => request(`/drivers/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  assign:          (driverId, orderId)   => request(`/drivers/${driverId}/assign/${orderId}`, { method: "POST", body: JSON.stringify({}) }),
  recordDelivery:  (driverId, orderId, payload) => request(`/drivers/${driverId}/orders/${orderId}/delivery`, { method: "PATCH", body: JSON.stringify(payload) }),
  remitCod:        (driverId, amount)    => request(`/drivers/${driverId}/cod-remit`, { method: "PATCH", body: JSON.stringify({ amount }) }),
  // COD settlement (admin only)
  getCodSettlementCandidates: (driverId) =>
    request(`/marketplace/admin/drivers/${driverId}/cod-settlement-candidates`),
  settleCodOrders: (driverId, payload) =>
    request(`/marketplace/admin/drivers/${driverId}/cod-settlements`, { method: "POST", body: JSON.stringify(payload) }),
};

export const driverPortalApi = {
  me: () => request("/driver/me"),
  listDeliveries: () => request("/driver/deliveries"),
  getDelivery: (orderId) => request(`/driver/deliveries/${orderId}`),
  recordDelivery: (orderId, payload) => request(`/driver/deliveries/${orderId}/delivery`, { method: "PATCH", body: JSON.stringify(payload) }),
};

export const sellerDriversApi = {
  list: () => request("/marketplace/seller/drivers"),
  create: (payload) => request("/marketplace/seller/drivers", { method: "POST", body: JSON.stringify(payload) }),
  update: (id, payload) => request(`/marketplace/seller/drivers/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  createLogin: (driverId, payload = {}) =>
    request(`/marketplace/seller/drivers/${driverId}/login`, { method: "POST", body: JSON.stringify(payload) }),
  assign: (driverId, orderId, payload = {}) =>
    request(`/marketplace/seller/drivers/${driverId}/assign/${orderId}`, { method: "POST", body: JSON.stringify(payload) }),
  recordDelivery: (driverId, orderId, payload) =>
    request(`/marketplace/seller/drivers/${driverId}/orders/${orderId}/delivery`, { method: "PATCH", body: JSON.stringify(payload) }),
  getCodSummary: () => request("/marketplace/seller/drivers/cod-summary"),
};

export const sellerDeliveryOffersApi = {
  create: (payload) => request("/marketplace/seller/delivery-offers", { method: "POST", body: JSON.stringify(payload) }),
  list: () => request("/marketplace/seller/delivery-offers"),
  get: (id) => request(`/marketplace/seller/delivery-offers/${id}`),
  cancel: (id) => request(`/marketplace/seller/delivery-offers/${id}/cancel`, { method: "PATCH" }),
};

export const driverOffersApi = {
  list: () => request("/driver/offers"),
  accept: (id) => request(`/driver/offers/${id}/accept`, { method: "POST", body: JSON.stringify({}) }),
};

export const adminDeliveryOffersApi = {
  list: () => request("/marketplace/admin/delivery-offers"),
};

// ── Finance: admin payout management ────────────────────────────────────────
export const adminPayoutsApi = {
  getPreview:  (shopId)           => request(`/marketplace/admin/shops/${shopId}/payout-preview`),
  getReleasePreview:  (shopId)    => request(`/marketplace/admin/shops/${shopId}/release-preview`),
  list:        (params = {})      => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "")).toString();
    return request(`/marketplace/admin/payouts${q ? `?${q}` : ""}`);
  },
  create:      (payload)          => request("/marketplace/admin/payouts", { method: "POST", body: JSON.stringify(payload) }),
  get:         (id)               => request(`/marketplace/admin/payouts/${id}`),
  updateStatus:(id, status, reason = "") =>
    request(`/marketplace/admin/payouts/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, reason }) }),
  releaseEarnings: (shopId, payload = {}) =>
    request(`/marketplace/admin/shops/${shopId}/release-earnings`, { method: "POST", body: JSON.stringify(payload) }),
};

// ── Finance: seller read-only balance / transactions / payouts ───────────────
export const sellerFinanceApi = {
  getBalance:      ()                  => request("/marketplace/seller/balance"),
  getTransactions: (params = {})       => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null)).toString();
    return request(`/marketplace/seller/transactions${q ? `?${q}` : ""}`);
  },
  getPayouts:      (params = {})       => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null)).toString();
    return request(`/marketplace/seller/payouts${q ? `?${q}` : ""}`);
  },
};

export const srPortalApi = {
  me: () => request("/sr/me"),
  referrals: () => request("/sr/referrals"),
  commissions: () => request("/sr/commissions"),
  commissionPlans: () => request("/sr/commission-plans"),
};

export const uploadApi = {
  uploadImage: (file) => {
    const { accessToken } = useAuthStore.getState();
    const form = new FormData();
    form.append("image", file);
    return fetch(`${API_BASE}/upload`, {
      method: "POST",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: form,
    }).then((r) => r.json()).then((p) => { if (!p.data) throw new Error(p.error || "Upload failed."); return p.data; });
  },
};
