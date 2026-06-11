import { CreditCard, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { BottleArt } from "@tuti/shared/components/BottleArt.jsx";
import { EmptyState } from "@tuti/shared/components/EmptyState.jsx";
import { PanelHeader } from "@tuti/shared/components/PanelHeader.jsx";
import { formatCurrency } from "@tuti/shared/utils/money.js";

function SummaryLine({ label, value, strong }) {
  return (
    <div className={strong ? "summary-line strong" : "summary-line"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getCartLineKey(item) {
  return item.cartLineId || item.id;
}

function CartConfigurationSummary({ item }) {
  if (item?.configuration?.type !== "build_your_box") return null;
  const { selectedPerfume, selectedTreat } = item.configuration;
  return (
    <span className="mini-cart-configuration">
      <em>Build Your Box</em>
      {selectedPerfume?.name ? <em>{selectedPerfume.name}</em> : null}
      {selectedTreat?.name ? <em>{selectedTreat.name}</em> : null}
    </span>
  );
}

function CartItemMetadataSummary({ item }) {
  const metadata = item?.metadata || {};
  const details = [];
  if (metadata.cakeWriting) details.push(`Cake writing: ${metadata.cakeWriting}`);
  if (metadata.allergyNote) details.push(`Allergy note: ${metadata.allergyNote}`);
  if (metadata.itemMessage) details.push(`Item message: ${metadata.itemMessage}`);
  if (metadata.giftWrap !== undefined) details.push(`Gift wrap: ${metadata.giftWrap ? "Yes" : "No"}`);
  if (!details.length) return null;
  return (
    <span className="mini-cart-metadata">
      {details.map((line) => <em key={line}>{line}</em>)}
    </span>
  );
}

export function CartPanel({
  cart,
  cartTotal,
  checkoutNote,
  platformFee,
  submitCheckout,
  updateCartQuantity,
  vendorNet,
}) {
  return (
    <aside className="cart-panel">
      <PanelHeader icon={ShoppingBag} title="Cart" action={`${cart.length} item${cart.length === 1 ? "" : "s"}`} />

      <div className="cart-items">
        {cart.length ? (
          cart.map((item) => (
            <div className="cart-item" key={getCartLineKey(item)}>
              <BottleArt product={item} compact />
              <div className="mini-cart-copy">
                <div className="mini-cart-line-head">
                  <strong>{item.name}</strong>
                  <span>{formatCurrency(item.price)}</span>
                </div>
                <span className="mini-cart-qty">Qty {item.quantity}</span>
                <CartConfigurationSummary item={item} />
                <CartItemMetadataSummary item={item} />
              </div>
              <div className="quantity-tools">
                <button className="icon-button" onClick={() => updateCartQuantity(getCartLineKey(item), item.quantity - 1)} title="Decrease" type="button">
                  <Minus size={16} />
                </button>
                <button className="icon-button" onClick={() => updateCartQuantity(getCartLineKey(item), item.quantity + 1)} title="Increase" type="button">
                  <Plus size={16} />
                </button>
                <button className="icon-button danger" onClick={() => updateCartQuantity(getCartLineKey(item), 0)} title="Remove" type="button">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <EmptyState icon={ShoppingBag} text="Your cart is empty. Add a perfume, cake, dessert, or gift box to continue checkout." />
        )}
      </div>

      <div className="checkout-box">
        <SummaryLine label="Subtotal" value={formatCurrency(cartTotal)} />
        <SummaryLine label="Delivery" value="Calculated at checkout" />
        <SummaryLine label="Total" value={formatCurrency(cartTotal)} strong />
        <button className="primary-action full-width" onClick={submitCheckout} type="button">
          <CreditCard size={18} />
          Review checkout
        </button>
        <p className="checkout-method-note">Cash on delivery is available. Your order summary will stay simple and easy to review.</p>
        {checkoutNote ? <p className="success-note">{checkoutNote}</p> : null}
      </div>
    </aside>
  );
}
