import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  KeyRound,
  Mail,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Store,
  UserCog,
  Users,
  XCircle,
} from "lucide-react";
import { usersApi } from "@tuti/shared/api/client.js";
import { EmptyState } from "@tuti/shared/components/EmptyState.jsx";
import { MetricCard } from "@tuti/shared/components/MetricCard.jsx";
import { PageTitle } from "@tuti/shared/components/PageTitle.jsx";
import { PanelHeader } from "@tuti/shared/components/PanelHeader.jsx";
import { StatusBadge } from "@tuti/shared/components/StatusBadge.jsx";

const ROLE_LABELS = {
  customer: "Customer",
  seller: "Seller",
  support: "Support",
  admin: "Admin",
};

const SHOP_TYPES = [
  { value: "perfume", label: "Perfume shop" },
  { value: "cake", label: "Cake shop" },
  { value: "dessert", label: "Dessert & sweets" },
  { value: "gift_box", label: "Gift boxes" },
  { value: "mixed", label: "Mixed boutique" },
];

const emptyCreateForm = {
  name: "",
  email: "",
  password: "",
  role: "customer",
  isActive: true,
  shopName: "",
  shopCity: "Dubai",
  shopStory: "",
  shopCategories: ["perfume"],
  deliveryModel: "seller_delivery",
};

function groupPermissions(permissions = []) {
  return permissions.reduce((groups, permission) => {
    const group = permission.group || "General";
    return { ...groups, [group]: [...(groups[group] || []), permission] };
  }, {});
}

function PermissionGrid({ permissions, selected, onToggle }) {
  const grouped = useMemo(() => groupPermissions(permissions), [permissions]);
  const selectedSet = new Set(selected || []);

  return (
    <div className="permission-grid">
      {Object.entries(grouped).map(([group, items]) => (
        <section className="permission-group" key={group}>
          <strong>{group}</strong>
          <div>
            {items.map((permission) => {
              const active = selectedSet.has(permission.id);
              return (
                <button
                  className={active ? "permission-toggle active" : "permission-toggle"}
                  key={permission.id}
                  onClick={() => onToggle(permission.id)}
                  type="button"
                >
                  {active ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                  {permission.label}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function ShopCategoryPicker({ value, onChange }) {
  const selected = value || [];
  function toggle(category) {
    const set = new Set(selected);
    if (set.has(category)) set.delete(category);
    else set.add(category);
    onChange(set.size ? [...set] : [category]);
  }

  return (
    <div className="user-shop-type-grid">
      {SHOP_TYPES.map((type) => (
        <button
          className={selected.includes(type.value) ? "shop-type-option active" : "shop-type-option"}
          key={type.value}
          onClick={() => toggle(type.value)}
          type="button"
        >
          {type.label}
        </button>
      ))}
    </div>
  );
}

export function AdminUsers() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [editDraft, setEditDraft] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [notice, setNotice] = useState("");

  const rolesQuery = useQuery({
    queryKey: ["user-roles"],
    queryFn: usersApi.roles,
  });

  const usersQuery = useQuery({
    queryKey: ["admin-users", query, role, status, page],
    queryFn: () => usersApi.list({
      q: query,
      role: role === "all" ? "" : role,
      status: status === "all" ? "" : status,
      page,
      limit: 8,
    }),
    keepPreviousData: true,
  });

  const roles = rolesQuery.data?.roles || [];
  const permissions = rolesQuery.data?.permissions || [];
  const defaults = rolesQuery.data?.defaults || {};
  const users = usersQuery.data?.users || [];
  const selectedUser = users.find((user) => user.id === selectedId) || users[0] || null;
  const metrics = usersQuery.data?.metrics || { total: 0, active: 0, suspended: 0, roles: {} };
  const pages = usersQuery.data?.pages || 1;

  useEffect(() => {
    if (!selectedId && users[0]) setSelectedId(users[0].id);
  }, [selectedId, users]);

  useEffect(() => {
    if (!selectedUser) {
      setEditDraft(null);
      return;
    }
    setEditDraft({
      name: selectedUser.name,
      email: selectedUser.email,
      role: selectedUser.role,
      isActive: selectedUser.isActive !== false,
      permissions: selectedUser.permissions || defaults[selectedUser.role] || [],
      shopName: selectedUser.shop?.name || "",
      shopCity: selectedUser.shop?.city || "Dubai",
      shopStory: selectedUser.shop?.story || "",
      shopCategories: selectedUser.shopCategories?.length ? selectedUser.shopCategories : selectedUser.shop?.categories || ["mixed"],
      deliveryModel: selectedUser.shop?.deliveryModel || "seller_delivery",
    });
    setNewPassword("");
    setNotice("");
  }, [defaults, selectedUser]);

  const invalidateUsers = () => {
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["user-roles"] });
  };

  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: (user) => {
      setSelectedId(user.id);
      setCreateForm(emptyCreateForm);
      setNotice(`${user.name} can now sign in.`);
      invalidateUsers();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, payload }) => usersApi.update(userId, payload),
    onSuccess: (user) => {
      setSelectedId(user.id);
      setNotice(`${user.name} updated.`);
      invalidateUsers();
    },
  });

  const passwordMutation = useMutation({
    mutationFn: ({ userId, password }) => usersApi.resetPassword(userId, password),
    onSuccess: () => {
      setNewPassword("");
      setNotice("Password updated.");
    },
  });

  function updateCreate(field, value) {
    setCreateForm((current) => ({ ...current, [field]: value }));
  }

  function updateEdit(field, value) {
    setEditDraft((current) => ({ ...current, [field]: value }));
  }

  function submitCreate(event) {
    event.preventDefault();
    const payload = { ...createForm };
    if (payload.role !== "seller") {
      delete payload.shopName;
      delete payload.shopCity;
      delete payload.shopStory;
      delete payload.shopCategories;
      delete payload.deliveryModel;
    }
    createMutation.mutate(payload);
  }

  function submitEdit(event) {
    event.preventDefault();
    if (!selectedUser || !editDraft) return;
    const payload = { ...editDraft };
    if (payload.role !== "seller") {
      delete payload.shopName;
      delete payload.shopCity;
      delete payload.shopStory;
      delete payload.shopCategories;
      delete payload.deliveryModel;
    }
    updateMutation.mutate({ userId: selectedUser.id, payload });
  }

  function toggleEditPermission(permission) {
    const set = new Set(editDraft.permissions || []);
    if (set.has(permission)) set.delete(permission);
    else set.add(permission);
    updateEdit("permissions", [...set]);
  }

  return (
    <main className="workspace">
      <PageTitle
        kicker="User module"
        title="Accounts, roles, and permissions"
        description="Create login accounts for customers, sellers, support, and admins. Control account status and exact permission access from one place."
      />

      <section className="metric-grid">
        <MetricCard icon={Users} label="Total users" value={metrics.total} note={`${metrics.active} active`} />
        <MetricCard icon={Store} label="Sellers" value={metrics.roles?.seller || 0} note="Seller dashboard access" />
        <MetricCard icon={ShieldCheck} label="Admins" value={(metrics.roles?.admin || 0) + (metrics.roles?.support || 0)} note="Admin/support access" />
        <MetricCard icon={XCircle} label="Suspended" value={metrics.suspended} note="Login blocked" />
      </section>

      <section className="management-toolbar">
        <label className="management-search">
          <Search size={17} />
          <input
            onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            placeholder="Search name, email, shop..."
            value={query}
          />
        </label>
        <div className="segment-tabs" aria-label="User filters">
          {["all", "customer", "seller", "support", "admin"].map((item) => (
            <button
              className={role === item ? "filter-tab active" : "filter-tab"}
              key={item}
              onClick={() => { setRole(item); setPage(1); }}
              type="button"
            >
              {item === "all" ? "All roles" : ROLE_LABELS[item]}
            </button>
          ))}
          {["all", "active", "suspended"].map((item) => (
            <button
              className={status === item ? "filter-tab active" : "filter-tab"}
              key={item}
              onClick={() => { setStatus(item); setPage(1); }}
              type="button"
            >
              {item === "all" ? "All status" : item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
      </section>

      {notice && <p className="seller-note success">{notice}</p>}
      {(createMutation.error || updateMutation.error || passwordMutation.error) && (
        <p className="error-note">{createMutation.error?.message || updateMutation.error?.message || passwordMutation.error?.message}</p>
      )}

      <section className="user-admin-grid">
        <form className="panel user-create-panel" onSubmit={submitCreate}>
          <PanelHeader icon={Plus} title="Create login account" action="New user" />
          <div className="user-form-grid">
            <label>
              <span>Name</span>
              <input value={createForm.name} onChange={(event) => updateCreate("name", event.target.value)} placeholder="Full name" required />
            </label>
            <label>
              <span>Email</span>
              <input type="email" value={createForm.email} onChange={(event) => updateCreate("email", event.target.value)} placeholder="user@tuti.dev" required />
            </label>
            <label>
              <span>Password</span>
              <input type="password" value={createForm.password} onChange={(event) => updateCreate("password", event.target.value)} placeholder="Min 8 characters" required />
            </label>
            <label>
              <span>Role</span>
              <select value={createForm.role} onChange={(event) => updateCreate("role", event.target.value)}>
                {roles.map((item) => <option key={item.id} value={item.id}>{ROLE_LABELS[item.id] || item.name}</option>)}
              </select>
            </label>
          </div>

          <label className="toggle-row user-active-toggle">
            <span>
              <strong>Account active</strong>
              <small>Active users can log in immediately.</small>
            </span>
            <input type="checkbox" checked={createForm.isActive} onChange={(event) => updateCreate("isActive", event.target.checked)} />
          </label>

          {createForm.role === "seller" && (
            <div className="seller-user-fields">
              <div className="user-form-grid">
                <label>
                  <span>Shop name</span>
                  <input value={createForm.shopName} onChange={(event) => updateCreate("shopName", event.target.value)} placeholder="Seller boutique name" />
                </label>
                <label>
                  <span>City</span>
                  <input value={createForm.shopCity} onChange={(event) => updateCreate("shopCity", event.target.value)} placeholder="Dubai" />
                </label>
              </div>
              <ShopCategoryPicker value={createForm.shopCategories} onChange={(value) => updateCreate("shopCategories", value)} />
            </div>
          )}

          <button className="primary-action full-width" disabled={createMutation.isPending} type="submit">
            <Plus size={17} />
            {createMutation.isPending ? "Creating..." : "Create account"}
          </button>
        </form>

        <section className="panel user-list-panel">
          <PanelHeader icon={Users} title="User directory" action={`${usersQuery.data?.total || 0} matched`} />
          {usersQuery.isLoading ? (
            <div className="app-status">Loading users...</div>
          ) : users.length === 0 ? (
            <EmptyState icon={Users} text="No users found." />
          ) : (
            <div className="user-directory-list">
              {users.map((user) => (
                <button
                  className={selectedUser?.id === user.id ? "user-directory-row active" : "user-directory-row"}
                  key={user.id}
                  onClick={() => setSelectedId(user.id)}
                  type="button"
                >
                  <span className="customer-avatar">{user.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
                  <div>
                    <strong>{user.name}</strong>
                    <small><Mail size={13} /> {user.email}</small>
                  </div>
                  <span className="client-role-chip">{ROLE_LABELS[user.role] || user.role}</span>
                  <StatusBadge status={user.status} />
                </button>
              ))}
            </div>
          )}
          <div className="directory-pagination">
            <button className="ghost-action compact" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button">
              Previous
            </button>
            <span>Page {page} of {pages}</span>
            <button className="ghost-action compact" disabled={page >= pages} onClick={() => setPage((current) => Math.min(pages, current + 1))} type="button">
              Next
            </button>
          </div>
        </section>
      </section>

      {selectedUser && editDraft && (
        <section className="panel user-permission-panel">
          <PanelHeader icon={UserCog} title="Role and permissions" action={selectedUser.email} />
          <form className="user-edit-layout" onSubmit={submitEdit}>
            <div className="user-edit-main">
              <div className="user-form-grid">
                <label>
                  <span>Name</span>
                  <input value={editDraft.name} onChange={(event) => updateEdit("name", event.target.value)} />
                </label>
                <label>
                  <span>Email</span>
                  <input type="email" value={editDraft.email} onChange={(event) => updateEdit("email", event.target.value)} />
                </label>
                <label>
                  <span>Role</span>
                  <select
                    value={editDraft.role}
                    onChange={(event) => {
                      const nextRole = event.target.value;
                      setEditDraft((current) => ({
                        ...current,
                        role: nextRole,
                        permissions: defaults[nextRole] || [],
                      }));
                    }}
                  >
                    {roles.map((item) => <option key={item.id} value={item.id}>{ROLE_LABELS[item.id] || item.name}</option>)}
                  </select>
                </label>
                <label>
                  <span>Status</span>
                  <select value={editDraft.isActive ? "active" : "suspended"} onChange={(event) => updateEdit("isActive", event.target.value === "active")}>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </label>
              </div>

              {editDraft.role === "seller" && (
                <div className="seller-user-fields">
                  <div className="user-form-grid">
                    <label>
                      <span>Shop name</span>
                      <input value={editDraft.shopName} onChange={(event) => updateEdit("shopName", event.target.value)} />
                    </label>
                    <label>
                      <span>City</span>
                      <input value={editDraft.shopCity} onChange={(event) => updateEdit("shopCity", event.target.value)} />
                    </label>
                  </div>
                  <ShopCategoryPicker value={editDraft.shopCategories} onChange={(value) => updateEdit("shopCategories", value)} />
                </div>
              )}

              <PermissionGrid permissions={permissions} selected={editDraft.permissions} onToggle={toggleEditPermission} />

              <div className="user-edit-actions">
                <button className="secondary-action" onClick={() => updateEdit("permissions", defaults[editDraft.role] || [])} type="button">
                  <ShieldCheck size={17} />
                  Reset role defaults
                </button>
                <button className="primary-action" disabled={updateMutation.isPending} type="submit">
                  <Save size={17} />
                  {updateMutation.isPending ? "Saving..." : "Save user"}
                </button>
              </div>
            </div>

            <aside className="user-password-panel">
              <span><KeyRound size={18} /></span>
              <strong>Reset password</strong>
              <p>Set a temporary password so this user can sign in with their own account.</p>
              <input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password" type="password" />
              <button
                className="ghost-action compact"
                disabled={!newPassword || passwordMutation.isPending}
                onClick={() => passwordMutation.mutate({ userId: selectedUser.id, password: newPassword })}
                type="button"
              >
                <KeyRound size={15} />
                Update password
              </button>
            </aside>
          </form>
        </section>
      )}
    </main>
  );
}
