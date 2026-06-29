import { useState } from "react";
import { ArrowRight, Droplet, Gift, PackageSearch, PartyPopper, Sparkles, Store, Wand2 } from "lucide-react";

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

function ShortcutTile({ shortcut, onSelect, featured = false }) {
  const Icon = shortcut.icon;
  return (
    <button
      className={`shortcut-tile shortcut-tile--${shortcut.tone}${featured ? " shortcut-tile--featured" : ""}`}
      type="button"
      onClick={onSelect}
    >
      <span className="shortcut-icon" aria-hidden="true">
        <Icon size={featured ? 22 : 20} strokeWidth={1.75} />
      </span>
      <span className="shortcut-copy">
        <span className="shortcut-title">{shortcut.title}</span>
        <span className="shortcut-helper">{shortcut.helper}</span>
      </span>
      {featured ? <ArrowRight size={16} aria-hidden="true" className="shortcut-arrow" /> : null}
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
  const [prompt, setPrompt] = useState("");
  const aiShortcuts = SHORTCUTS.filter((s) => s.tone === "ai");
  const brandShortcuts = SHORTCUTS.filter((s) => s.tone === "brand");

  function handlePromptSubmit(event) {
    event.preventDefault();
    onFindGift?.();
  }

  return (
    <section className="gifting-shortcuts" aria-labelledby="gifting-shortcuts-title">
      <div className="gifting-shortcuts-panel">
        <div className="gifting-shortcuts-head">
          <span className="gifting-shortcuts-badge">
            <Wand2 size={12} aria-hidden="true" />
            AI-assisted
          </span>
          <span className="gifting-shortcuts-label" id="gifting-shortcuts-title">Tell Tuti what you&rsquo;re gifting</span>
          <p>Describe the moment, or jump straight to a shortcut below.</p>
        </div>

        <form className="gifting-ai-bar" onSubmit={handlePromptSubmit}>
          <Sparkles size={18} aria-hidden="true" className="gifting-ai-bar-icon" />
          <input
            type="text"
            className="gifting-ai-bar-input"
            placeholder="e.g. A birthday gift for my sister who loves florals…"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            aria-label="Describe the gift you're looking for"
          />
          <button className="gifting-ai-bar-submit" type="submit" aria-label="Find gift ideas">
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </form>

        <div className="gifting-shortcuts-tiers">
          <div className="gifting-shortcuts-row gifting-shortcuts-row--ai">
            {aiShortcuts.map((shortcut) => (
              <ShortcutTile key={shortcut.id} shortcut={shortcut} onSelect={handlers[shortcut.action]} featured />
            ))}
          </div>
          <div className="gifting-shortcuts-row gifting-shortcuts-row--brand">
            {brandShortcuts.map((shortcut) => (
              <ShortcutTile key={shortcut.id} shortcut={shortcut} onSelect={handlers[shortcut.action]} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
