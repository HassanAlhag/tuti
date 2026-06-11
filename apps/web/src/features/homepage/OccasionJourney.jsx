import { ArrowRight } from "lucide-react";
import cakeCategoryImage from "../../assets/category-cakes.jpg";
import giftSetImage from "../../assets/category-gift-sets.jpg";
import perfumeImage from "../../assets/category-perfumes.jpg";

const OCCASIONS = [
  {
    key: "birthday",
    modifier: "occasion-panel--birthday",
    eyebrow: "Celebrate them",
    title: "Birthday",
    desc: "Perfumes, cakes and gift sets that feel like they were chosen just for them.",
    cta: "Shop birthday gifts",
    image: cakeCategoryImage,
    dest: "gift_box",
  },
  {
    key: "eid",
    modifier: "occasion-panel--eid",
    eyebrow: "Gift the season",
    title: "Eid",
    desc: "Oud, amber and curated sets — gifts worthy of the occasion.",
    cta: "Shop Eid gifts",
    image: perfumeImage,
    dest: "perfume",
  },
  {
    key: "wedding",
    modifier: "occasion-panel--wedding",
    eyebrow: "Mark the moment",
    title: "Wedding",
    desc: "Thoughtful gifts for the couple, the guests and everyone in between.",
    cta: "Shop wedding gifts",
    image: giftSetImage,
    dest: "gift_box",
  },
];

export function OccasionJourney({ onShopCategory }) {
  return (
    <section className="home-section" aria-labelledby="occasion-heading">
      <div className="occasion-stage">
        <div className="occasion-heading">
          <span className="eyebrow">Gift by occasion</span>
          <h2 id="occasion-heading">The moment calls for it.</h2>
          <p>Every celebration deserves a gift that feels considered.</p>
        </div>

        <div className="occasion-panels">
          {OCCASIONS.map((occasion) => (
            <button
              key={occasion.key}
              className={`occasion-panel ${occasion.modifier}`}
              type="button"
              onClick={() => onShopCategory(occasion.dest)}
              aria-label={`${occasion.cta} — ${occasion.title}`}
            >
              <div className="occasion-panel-bg">
                <img
                  src={occasion.image}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              </div>
              <div className="occasion-copy">
                <span className="occasion-eyebrow">{occasion.eyebrow}</span>
                <h3 className="occasion-title">{occasion.title}</h3>
                <p className="occasion-desc">{occasion.desc}</p>
                <span className="occasion-cta">
                  {occasion.cta} <ArrowRight size={13} />
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
