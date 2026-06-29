import { useEffect, useRef } from "react";
import { Filter, X } from "lucide-react";

export function ShopFilterDrawer({
  open,
  onClose,
  orderedFamilies,
  family,
  setFamily,
  familyTones,
  hasFamilyFilter,
  onClearAll,
}) {
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    triggerRef.current = document.activeElement;
    dialogRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="shop-drawer-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="shop-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shop-drawer-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shop-drawer-head">
          <h2 id="shop-drawer-title">Filters</h2>
          <button className="shop-drawer-close" type="button" onClick={onClose} aria-label="Close filters">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="shop-family-filter">
          <div className="shop-filter-heading">
            <span>Fragrance family</span>
            {hasFamilyFilter ? (
              <button className="shop-filter-reset" type="button" onClick={() => setFamily("All")}>
                Reset
              </button>
            ) : null}
          </div>
          <div className="shop-family-chips" aria-label="Perfume families">
            {orderedFamilies.map((item) => (
              <button
                key={item}
                className={family === item ? "shop-family-chip active" : "shop-family-chip"}
                type="button"
                onClick={() => setFamily(item)}
              >
                <span className="shop-family-dot" style={{ "--family-tone": familyTones[item] || familyTones.All }} aria-hidden="true" />
                {item === "All" ? (
                  <>
                    <Filter size={14} aria-hidden="true" />
                    {item}
                  </>
                ) : (
                  item
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="shop-drawer-actions">
          <button className="ghost-action compact" type="button" onClick={onClearAll}>
            Clear all
          </button>
          <button className="primary-action compact" type="button" onClick={onClose}>
            Show results
          </button>
        </div>
      </div>
    </div>
  );
}
