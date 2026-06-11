import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { resolve } from "path";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@tuti/shared": resolve(root, "../../packages/shared"),
      "@": resolve(root, "src"),
    },
  },
  server: {
    port: 5177,
    proxy: {
      "/api": { target: "http://localhost:5055", changeOrigin: true },
    },
  },
});
