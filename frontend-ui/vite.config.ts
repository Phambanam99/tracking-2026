import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:18080",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:18080",
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
