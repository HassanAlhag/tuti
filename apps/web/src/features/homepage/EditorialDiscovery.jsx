import { ArrowRight } from "lucide-react";
import cakeCategoryImage from "../../assets/category-cakes.jpg";
import giftSetImage from "../../assets/category-gift-sets.jpg";
import perfumeImage from "../../assets/category-perfumes.jpg";
import ch2Image from "../../assets/home-ch2-sweet.png";
import ch3Image from "../../assets/home-ch3-personalise.png";

export function EditorialDiscovery({
  onGoToGifting,
  onGoToFragranceFinder,
  onGoToShops,
  onGoToJournal,
  onGoToSell,
}) {
  const links = [
    {
      key: "gifting",
      label: "Gifting",
      desc: "Curated gift ideas for every person and every occasion.",
      image: giftSetImage,
      onClick: onGoToGifting,
    },
    {
      key: "fragrance-finder",
      label: "Find a Scent",
      desc: "Answer a few questions. Discover your signature.",
      image: perfumeImage,
      onClick: onGoToFragranceFinder,
    },
    {
      key: "shops",
      label: "Boutiques",
      desc: "Browse all independent sellers on the Tuti marketplace.",
      image: ch2Image,
      onClick: onGoToShops,
    },
    {
      key: "journal",
      label: "Journal",
      desc: "Stories, guides and inspiration from the world of scent.",
      image: ch3Image,
      onClick: onGoToJournal,
    },
    {
      key: "sell",
      label: "Sell on Tuti",
      desc: "Bring your boutique to Tuti's audience across the UAE.",
      image: cakeCategoryImage,
      onClick: onGoToSell,
    },
  ];

  return (
    <section className="editorial-discovery" aria-labelledby="editorial-discovery-title">
      <div className="editorial-discovery-inner">
        <div className="editorial-discovery-head">
          <span className="eyebrow">Explore Tuti</span>
          <h2 id="editorial-discovery-title">There is always more to discover.</h2>
          <p>Gifting guides, fragrance discovery, boutique sellers and a platform for makers.</p>
        </div>

        <nav className="editorial-links" aria-label="Discover more">
          {links.map((link) => (
            <button
              key={link.key}
              className="editorial-link"
              type="button"
              onClick={link.onClick}
              aria-label={link.label}
            >
              <div className="editorial-link-image">
                <img src={link.image} alt="" />
              </div>
              <div className="editorial-link-copy">
                <span className="editorial-link-label">{link.label}</span>
                <span className="editorial-link-desc">{link.desc}</span>
                <span className="editorial-link-arrow">
                  Explore <ArrowRight size={12} />
                </span>
              </div>
            </button>
          ))}
        </nav>
      </div>
    </section>
  );
}
