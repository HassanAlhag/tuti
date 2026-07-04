const cx = (...parts) => parts.filter(Boolean).join(" ");

function clampQuantity(value, min, max) {
  const numeric = Number(value);
  const fallback = Number.isFinite(Number(min)) ? Number(min) : 0;
  const lower = Number.isFinite(Number(min)) ? Number(min) : 0;
  const upper = Number.isFinite(Number(max)) ? Number(max) : Infinity;
  return Math.max(lower, Math.min(upper, Number.isFinite(numeric) ? numeric : fallback));
}

export function TutiQuantityControl({
  value = 1,
  min = 1,
  max,
  onChange,
  disabled = false,
  size = "md",
  label = "Quantity",
  className = "",
}) {
  const current = clampQuantity(value, min, max);
  const lower = Number.isFinite(Number(min)) ? Number(min) : 0;
  const upper = Number.isFinite(Number(max)) ? Number(max) : Infinity;

  function update(nextValue) {
    if (disabled) return;
    onChange?.(clampQuantity(nextValue, lower, upper));
  }

  return (
    <div className={cx("tuti-quantity", `tuti-quantity--${size}`, className)} aria-label={label}>
      <button
        type="button"
        className="tuti-quantity__button"
        onClick={() => update(current - 1)}
        disabled={disabled || current <= lower}
        aria-label={`Decrease ${label.toLowerCase()}`}
      >
        <span aria-hidden="true">−</span>
      </button>
      <span className="tuti-quantity__value" aria-live="polite">{current}</span>
      <button
        type="button"
        className="tuti-quantity__button"
        onClick={() => update(current + 1)}
        disabled={disabled || current >= upper}
        aria-label={`Increase ${label.toLowerCase()}`}
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
