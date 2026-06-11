import { Star, Store } from "lucide-react";
import { PanelHeader } from "@tuti/shared/components/PanelHeader.jsx";

function Leaderboard({ icon, title, rows }) {
  return (
    <section className="leader-panel">
      <PanelHeader icon={icon} title={title} action="Weighted ranking" />
      <div className="rank-list">
        {rows.map((row, index) => (
          <div className="rank-row" key={row.id}>
            <span className="rank-index">{index + 1}</span>
            <div>
              <strong>{row.name}</strong>
              <span>{row.meta}</span>
            </div>
            <strong>{row.score}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export function RankingSection({ getShop, topPerfumes, topShops }) {
  return (
    <section className="leader-grid" id="leaders">
      <Leaderboard
        icon={Star}
        title="Top rated perfumes"
        rows={topPerfumes.slice(0, 4).map((product) => ({
          id: product.id,
          name: product.name,
          meta: getShop(product.shopId)?.name,
          score: product.score,
        }))}
      />
      <Leaderboard
        icon={Store}
        title="Top rated shops"
        rows={topShops.slice(0, 4).map((shop) => ({
          id: shop.id,
          name: shop.name,
          meta: shop.city,
          score: shop.score,
        }))}
      />
    </section>
  );
}
