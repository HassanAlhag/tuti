import { create } from "zustand";
import { authApi } from "../api/client.js";
import { useAuthStore } from "./authStore.js";

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
      // Keep the persisted auth-store snapshot of `user.wishlist` in sync —
      // App.jsx re-hydrates this store from `user.wishlist` on every fresh
      // page load, so without this a toggle would appear to revert after
      // a refresh (Phase 7, css-revamp-phase-7.md).
      useAuthStore.getState().updateUser({ wishlist: result.wishlist });
    } catch {
      set({ ids: prev }); // rollback on error
    }
  },

  has(productId) {
    return get().ids.has(productId);
  },
}));
