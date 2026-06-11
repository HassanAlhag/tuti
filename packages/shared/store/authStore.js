import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user:         null,
      accessToken:  null,
      refreshToken: null,

      setAuth: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),
      clearAuth: () => set({ user: null, accessToken: null, refreshToken: null }),
      updateAccessToken: (accessToken) => set({ accessToken }),
      updateUser: (partial) => set((state) => ({ user: state.user ? { ...state.user, ...partial } : state.user })),

      isAuthenticated: () => Boolean(get().accessToken),
      isAdmin:   () => get().user?.role === "admin",
      isSeller:  () => get().user?.role === "seller",
      isCustomer:() => get().user?.role === "customer",
    }),
    {
      name: "tuti-auth",
      partialState: (state) => ({
        user:         state.user,
        accessToken:  state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
