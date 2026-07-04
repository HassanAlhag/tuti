import { formatTutiPrice, toNumber } from "./commerceUtils.js";

const cx = (...parts) => parts.filter(Boolean).join(" ");

export function TutiPrice({
  price,
  compareAtPrice,
  currency = "AED",
  size = "md",
  align = "left",
  className = "",
}) {
  const amount = toNumber(price);
  const compareAmount = toNumber(compareAtPrice);
  const hasCompare = compareAmount != null && amount != null && compareAmount > amount;

  return (
    <div className={cx("tuti-price", `tuti-price--${size}`, `tuti-price--${align}`, className)}>
      <strong className="tuti-price__current">
        {amount == null ? "Price on request" : formatTutiPrice(amount, currency)}
      </strong>
      {hasCompare ? (
        <del className="tuti-price__compare">{formatTutiPrice(compareAmount, currency)}</del>
      ) : null}
    </div>
  );
}
