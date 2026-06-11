import { useState } from "react";
import { BookOpen, Package, Sparkles } from "lucide-react";
import { AdminFeaturedProducts } from "./AdminFeaturedProducts.jsx";
import { AdminCollections } from "./AdminCollections.jsx";
import { AdminFeaturedSellers } from "./AdminFeaturedSellers.jsx";

export function AdminMerchandising({ adminData }) {
  const [activeTab, setActiveTab] = useState("featured-sellers");

  return (
    <main className="workspace merch-page merch-section-shell">
      <div className="segment-tabs merch-section-tabs" aria-label="Merchandising sections">
        <button
          type="button"
          className={activeTab === "featured-sellers" ? "filter-tab active" : "filter-tab"}
          onClick={() => setActiveTab("featured-sellers")}
        >
          <Sparkles size={15} />
          Featured Sellers
        </button>
        <button
          type="button"
          className={activeTab === "featured-products" ? "filter-tab active" : "filter-tab"}
          onClick={() => setActiveTab("featured-products")}
        >
          <Package size={15} />
          Featured Products
        </button>
        <button
          type="button"
          className={activeTab === "collections" ? "filter-tab active" : "filter-tab"}
          onClick={() => setActiveTab("collections")}
        >
          <BookOpen size={15} />
          Collections
        </button>
      </div>

      {activeTab === "featured-sellers" ? (
        <AdminFeaturedSellers />
      ) : activeTab === "featured-products" ? (
        <AdminFeaturedProducts adminData={adminData} />
      ) : (
        <AdminCollections adminData={adminData} />
      )}
    </main>
  );
}
