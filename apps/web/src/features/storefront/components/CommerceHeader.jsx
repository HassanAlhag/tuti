import { Home, LogIn, Menu, Search, UserCircle } from "lucide-react";
import { useAuthStore } from "@tuti/shared/store/authStore.js";

export function CommerceHeader({ family, families, query, setFamily, setQuery, onSignIn }) {
  const { user, isAuthenticated } = useAuthStore();

  const greeting = isAuthenticated()
    ? `Hello, ${user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "there"}`
    : "Hello, guest";

  const accountLabel = isAuthenticated() ? "My account & orders" : "Sign in";

  return (
    <section className="commerce-header">
      <button className="commerce-menu" type="button" title="Departments">
        <Menu size={20} />
      </button>

      <div className="delivery-chip">
        <Home size={17} />
        <span>
          Deliver to
          <strong>UAE</strong>
        </span>
      </div>

      <label className="commerce-search">
        <select value={family} onChange={(e) => setFamily(e.target.value)}>
          {families.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Search perfumes, cakes, gift sets…"
          aria-label="Search products"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Search size={20} />
      </label>

      <button
        className="commerce-account"
        onClick={onSignIn}
        type="button"
        title={accountLabel}
      >
        <UserCircle size={18} />
        <span>
          {greeting}
          <strong>{accountLabel}</strong>
        </span>
      </button>
    </section>
  );
}
