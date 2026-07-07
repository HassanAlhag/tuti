import { TutiButton, TutiCard, TutiMediaStage } from "../primitives/index.js";
import { TutiPrice } from "./TutiPrice.jsx";
import { TutiQuantityControl } from "./TutiQuantityControl.jsx";
import {
  getProductCategory,
  getProductId,
  getProductImage,
  getProductName,
  getProductPrice,
  getProductTypeLabel,
} from "./commerceUtils.js";

const cx = (...parts) => parts.filter(Boolean).join(" ");

export function TutiCartItem({
  item = {},
  onQuantityChange,
  onRemove,
  readonly = false,
  className = "",
}) {
  const itemId = getProductId(item);
  const quantity = Math.max(1, Number(item.quantity || 1));
  const price = getProductPrice(item);

  return (
    <TutiCard variant="commerce" padding="sm" className={cx("tuti-cart-item", className)}>
      <TutiMediaStage
        category={getProductCategory(item)}
        image={getProductImage(item)}
        alt={getProductName(item)}
        size="sm"
        className="tuti-cart-item__media"
      />
      <div className="tuti-cart-item__body">
        <div>
          <strong>{getProductName(item)}</strong>
          <span>{getProductTypeLabel(item)}</span>
        </div>
        {Array.isArray(item.includes) && item.includes.length ? (
          <small>{item.includes.slice(0, 2).join(" · ")}</small>
        ) : null}
      </div>
      <div className="tuti-cart-item__actions">
        <TutiPrice price={price != null ? price * quantity : null} size="sm" align="right" className="tuti-cart-item__price" />
        <div className="tuti-cart-item__controls">
          {readonly ? (
            <span className="tuti-cart-item__readonly-qty">Qty {quantity}</span>
          ) : (
            <TutiQuantityControl
              value={quantity}
              min={1}
              max={item.stock || undefined}
              size="sm"
              onChange={(nextQuantity) => onQuantityChange?.(itemId, nextQuantity, item)}
            />
          )}
          {!readonly && onRemove ? (
            <TutiButton variant="ghost" size="sm" onClick={() => onRemove(itemId, item)}>
              Remove
            </TutiButton>
          ) : null}
        </div>
      </div>
    </TutiCard>
  );
}
