import { create } from "zustand";
import { authApi } from "../api/client.js";

export const useWishlistStore = create((set, get) => ({
  ids: new Set(),

  hydrate(wishlistArray) {
    set({ ids: new Set((wishlistArray || []).map((w) => w.productId)) });
  },

  async toggle(productId, productName = "") {
    const prev = new Set(get().ids);
    const saving = new Set(prev);
    if (saving.has(productId)) { saving.delete(productId); } else { saving.add(productId); }
    set({ ids: saving }); // optimistic
    try {
      const result = await authApi.toggleWishlist(productId, productName);
      set({ ids: new Set((result.wishlist || []).map((w) => w.productId)) });
    } catch {
      set({ ids: prev }); // rollback on error
    }
  },

  has(productId) {
    return get().ids.has(productId);
  },
}));
