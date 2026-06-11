import { create } from "zustand";
import { persist } from "zustand/middleware";

function makeCartLineId(productId) {
  if (globalThis.crypto?.randomUUID) return `line-${globalThis.crypto.randomUUID()}`;
  return `line-${productId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getCartLineKey(item) {
  return item.cartLineId || item.id;
}

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, quantity = 1, options = {}) => {
        const existing = options.separateLine ? null : get().items.find((i) => i.id === product.id && !i.metadata && !i.isSeparateLine);
        if (existing) {
          const existingLineKey = getCartLineKey(existing);
          set({ items: get().items.map((i) => getCartLineKey(i) === existingLineKey ? { ...i, quantity: i.quantity + quantity } : i) });
        } else {
          set({ items: [...get().items, { ...product, cartLineId: makeCartLineId(product.id), isSeparateLine: Boolean(options.separateLine), quantity }] });
        }
      },

      // quantity is the new absolute value; 0 or negative removes the item.
      // CartCheckoutPage passes -1 as a "remove this item" action, not a decrement.
      // To decrement by 1, callers must pass (item.quantity - 1).
      updateQuantity: (lineId, quantity) => {
        if (quantity <= 0) {
          set({ items: get().items.filter((i) => getCartLineKey(i) !== lineId) });
        } else {
          set({ items: get().items.map((i) => getCartLineKey(i) === lineId ? { ...i, quantity } : i) });
        }
      },

      removeItem: (lineId) => set({ items: get().items.filter((i) => getCartLineKey(i) !== lineId) }),
      updateItemMetadata: (lineId, metadata) => {
        set({
          items: get().items.map((i) => (
            getCartLineKey(i) === lineId
              ? { ...i, metadata: { ...(i.metadata || {}), ...(metadata || {}) } }
              : i
          )),
        });
      },
      clearCart:  () => set({ items: [] }),

      itemCount: () => get().items.reduce((s, i) => s + i.quantity, 0),
      total:     () => get().items.reduce((s, i) => s + i.price * i.quantity, 0),
    }),
    { name: "tuti-cart" }
  )
);
