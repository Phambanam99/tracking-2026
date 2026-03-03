import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const gatewayHttpTarget = process.env.VITE_DEV_GATEWAY_HTTP_TARGET ?? "http://localhost:18080";
const gatewayWsTarget = process.env.VITE_DEV_GATEWAY_WS_TARGET ?? "ws://localhost:18080";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }
          if (
            id.includes("node_modules/react/")
            || id.includes("node_modules/react-dom/")
            || id.includes("node_modules/scheduler/")
          ) {
            return "react-vendor";
          }
          if (id.includes("node_modules/ol")) {
            return "ol-vendor";
          }
          if (id.includes("node_modules/@stomp")) {
            return "stomp-vendor";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: gatewayHttpTarget,
        changeOrigin: true,
      },
      "/ws": {
        target: gatewayWsTarget,
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
