import { ArrowRight } from "lucide-react";
import cakeCategoryImage from "../../assets/category-cakes.jpg";
import giftSetImage from "../../assets/category-gift-sets.jpg";
import perfumeImage from "../../assets/category-perfumes.jpg";

/*
 * OCCASIONS — static config for the three core gifting moments.
 * slug:          occasion identifier forwarded to onShopOccasion (future API hook point)
 * dest:          shop category for routing; each occasion maps to a distinct category
 * imagePosition: CSS object-position value for image framing
 * seasonal:      renders the "Seasonal edit" pill and a restrained warm overlay
 */
const OCCASIONS = [
  {
    key: "birthday",
    slug: "birthday",
    modifier: "occasion-panel--birthday",
    eyebrow: "Celebrate them",
    title: "Birthday",
    desc: "Perfumes, cakes and gift sets that feel like they were chosen just for them.",
    cta: "Shop birthday gifts",
    image: cakeCategoryImage,
    imagePosition: "center",
    dest: "cake",
    seasonal: false,
  },
  {
    key: "eid",
    slug: "eid",
    modifier: "occasion-panel--eid",
    eyebrow: "Gift the season",
    title: "Eid",
    desc: "Oud, amber and curated sets — gifts worthy of the occasion.",
    cta: "Shop Eid gifts",
    image: perfumeImage,
    imagePosition: "center 30%",
    dest: "perfume",
    seasonal: true,
  },
  {
    key: "wedding",
    slug: "wedding",
    modifier: "occasion-panel--wedding",
    eyebrow: "Mark the moment",
    title: "Wedding",
    desc: "Thoughtful gifts for the couple, the guests and everyone in between.",
    cta: "Shop wedding gifts",
    image: giftSetImage,
    imagePosition: "center",
    dest: "gift_box",
    seasonal: false,
  },
];

export function OccasionJourney({ onShopOccasion }) {
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
              className={`occasion-panel ${occasion.modifier}${occasion.seasonal ? " occasion-panel--seasonal" : ""}`}
              type="button"
              onClick={() => onShopOccasion(occasion.slug)}
              aria-label={occasion.cta}
            >
              <div className="occasion-panel-bg">
                <div className="occasion-panel-bg-fallback" aria-hidden="true" />
                <img
                  src={occasion.image}
                  alt=""
                  style={{ objectPosition: occasion.imagePosition }}
                />
              </div>
              {occasion.seasonal && (
                <span className="occasion-seasonal-label" aria-hidden="true">Seasonal edit</span>
              )}
              <div className="occasion-copy">
                <span className="occasion-eyebrow">{occasion.eyebrow}</span>
                <span className="occasion-title">{occasion.title}</span>
                <p className="occasion-desc">{occasion.desc}</p>
                <span className="occasion-cta">
                  {occasion.cta} <ArrowRight size={13} aria-hidden="true" />
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
