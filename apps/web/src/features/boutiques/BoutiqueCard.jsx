import { ArrowRight, BadgeCheck, Star } from "lucide-react";
import { TutiCard } from "../../ui/customer/primitives/index.js";
import { getBoutiqueInitials } from "./boutiqueDirectory.js";

export function BoutiqueCard({ boutique, onVisit, className = "" }) {
  const {
    title,
    description,
    image,
    fallbackImage,
    categoryChips = [],
    rating,
    location,
    verified,
    slug,
    id,
  } = boutique;

  const visualSrc = image || fallbackImage || "";
  const metaLine = [categoryChips[0], location].filter(Boolean).join(" · ");

  return (
    <TutiCard
      as="button"
      type="button"
      variant="commerce"
      padding="none"
      interactive
      className={["boutique-card", className].filter(Boolean).join(" ")}
      onClick={() => onVisit?.(slug || id)}
    >
      <div
        className={visualSrc ? "boutique-card__media" : "boutique-card__media boutique-card__media--tinted"}
        style={!visualSrc ? { "--boutique-hue": getBoutiqueHue(slug || title) } : undefined}
      >
        {visualSrc ? <img src={visualSrc} alt="" loading="lazy" /> : null}
        {verified ? (
          <span className="boutique-card__badge">
            <BadgeCheck size={13} aria-hidden="true" />
            Verified
          </span>
        ) : null}
      </div>

      {/* Sibling of the (overflow: hidden) media box, not a child of it --
          straddles the media/body seam via grid self-alignment + a
          translateY nudge instead of absolute-positioning inside the
          clipped element, so the badge is never cut off. */}
      <span className="boutique-card__mark" aria-hidden="true">{getBoutiqueInitials(title)}</span>

      <div className="boutique-card__body">
        <h3 className="boutique-card__title">{title}</h3>
        {metaLine ? <p className="boutique-card__meta-line">{metaLine}</p> : null}
        {description ? <p className="boutique-card__desc">{description}</p> : null}

        <div className="boutique-card__footer-row">
          {categoryChips.length ? (
            <div className="boutique-card__chips">
              {categoryChips.map((chip) => (
                <span className="boutique-card__chip" key={chip}>{chip}</span>
              ))}
            </div>
          ) : null}
          {rating ? (
            <span className="boutique-card__rating">
              <Star size={13} aria-hidden="true" />
              {rating}
            </span>
          ) : null}
        </div>

        <span className="boutique-card__cta">
          Visit boutique <ArrowRight size={14} aria-hidden="true" />
        </span>
      </div>
    </TutiCard>
  );
}

/* Deterministic per-boutique hue so the no-photo fallback tint varies
   card to card instead of every boutique sharing one flat gradient. */
function getBoutiqueHue(seed) {
  const text = String(seed || "tuti");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 360;
  }
  return (hash + 360) % 360;
}
