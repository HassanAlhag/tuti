import { Droplet, Gift, PackageSearch, PartyPopper, Sparkles, Store } from "lucide-react";

const SHORTCUTS = [
  {
    id: "find-gift",
    icon: Sparkles,
    title: "Find the Perfect Gift",
    helper: "Let Tuti guide your choice",
    tone: "ai",
    action: "onFindGift",
  },
  {
    id: "find-scent",
    icon: Droplet,
    title: "Find a Scent",
    helper: "Discover your signature fragrance",
    tone: "ai",
    action: "onFindScent",
  },
  {
    id: "build-box",
    icon: Gift,
    title: "Build a Gift Box",
    helper: "Combine scent, sweets and a message",
    tone: "brand",
    action: "onBuildBox",
  },
  {
    id: "shop-occasion",
    icon: PartyPopper,
    title: "Shop by Occasion",
    helper: "Birthdays, Eid, weddings and more",
    tone: "brand",
    action: "onShopOccasion",
  },
  {
    id: "explore-boutiques",
    icon: Store,
    title: "Explore Boutiques",
    helper: "Independent sellers across the UAE",
    tone: "brand",
    action: "onExploreBoutiques",
  },
  {
    id: "track-order",
    icon: PackageSearch,
    title: "Track Your Order",
    helper: "Check your delivery status",
    tone: "brand",
    action: "onTrackOrder",
  },
];

function ShortcutTile({ shortcut, onSelect }) {
  const Icon = shortcut.icon;
  return (
    <button
      className={`shortcut-tile shortcut-tile--${shortcut.tone}`}
      type="button"
      onClick={onSelect}
    >
      <span className="shortcut-icon" aria-hidden="true">
        <Icon size={20} strokeWidth={1.75} />
      </span>
      <span className="shortcut-copy">
        <span className="shortcut-title">{shortcut.title}</span>
        <span className="shortcut-helper">{shortcut.helper}</span>
      </span>
    </button>
  );
}

export function GiftingShortcuts({
  onFindGift,
  onFindScent,
  onBuildBox,
  onShopOccasion,
  onExploreBoutiques,
  onTrackOrder,
}) {
  const handlers = { onFindGift, onFindScent, onBuildBox, onShopOccasion, onExploreBoutiques, onTrackOrder };

  return (
    <section className="gifting-shortcuts" aria-labelledby="gifting-shortcuts-title">
      <div className="gifting-shortcuts-panel">
        <div className="gifting-shortcuts-head">
          <span className="gifting-shortcuts-label" id="gifting-shortcuts-title">Start your journey</span>
          <p>Choose how you would like Tuti to help.</p>
        </div>
        <div className="gifting-shortcuts-grid">
          {SHORTCUTS.map((shortcut) => (
            <ShortcutTile key={shortcut.id} shortcut={shortcut} onSelect={handlers[shortcut.action]} />
          ))}
        </div>
      </div>
    </section>
  );
}
