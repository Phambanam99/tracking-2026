import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const gatewayHttpTarget = process.env.VITE_DEV_GATEWAY_HTTP_TARGET ?? "http://localhost:18080";
const gatewayWsTarget = process.env.VITE_DEV_GATEWAY_WS_TARGET ?? "ws://localhost:18080";
const geoserverTarget = process.env.VITE_DEV_GEOSERVER_TARGET ?? "http://localhost:8600";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    sourcemap: false,        // Tắt source maps trong production
    minify: 'esbuild',       // Minify JS/CSS
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
      "/geoserver": {
        target: geoserverTarget,
        changeOrigin: true,
      },
    },
  },
}));
