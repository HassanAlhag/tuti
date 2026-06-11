import { Crown, ShieldCheck, Store, UserCircle, Waves } from "lucide-react";
import { brand } from "@tuti/shared/brand.js";

export function AboutPage({ roles }) {
  return (
    <main className="page-shell">
      <section className="about-hero">
        <span className="brand-mark large">{brand.mark}</span>
        <div>
          <span className="eyebrow">{brand.origin}</span>
          <h1>{brand.name} is named after Tuti Island</h1>
          <p>
            Tuti is built as a warm, premium marketplace for discovering new perfume shops, with trusted ratings and separate seller/admin systems from the beginning.
          </p>
        </div>
      </section>

      <section className="about-story-grid">
        <article>
          <Waves size={22} />
          <h2>The name</h2>
          <p>
            Tuti Island sits where the Blue and White Nile meet. The brand borrows that idea: different perfume makers, customers, reviews, and shops meeting in one marketplace.
          </p>
        </article>
        <article>
          <ShieldCheck size={22} />
          <h2>The trust layer</h2>
          <p>
            Reviews, verified purchase signals, payment reserves, dispute handling, and admin approvals are treated as core marketplace features.
          </p>
        </article>
      </section>

      <section className="role-matrix">
        {roles.map((role) => (
          <article className="role-card" key={role.id}>
            <div className="role-card-head">
              <span>
                {role.id === "customer" ? <UserCircle size={20} /> : null}
                {role.id === "seller" ? <Store size={20} /> : null}
                {role.id === "support" ? <ShieldCheck size={20} /> : null}
                {role.id === "admin" ? <Crown size={20} /> : null}
              </span>
              <div>
                <h2>{role.name}</h2>
                <p>{role.label}</p>
              </div>
            </div>
            <p className="role-boundary">{role.boundary}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
