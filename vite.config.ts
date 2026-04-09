import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const localApiProxyTarget = env.LOCAL_API_PROXY_TARGET?.trim() || "http://127.0.0.1:3000";

  return {
    assetsInclude: ["**/*.wasm"],
    optimizeDeps: {
      exclude: [
        "@shelby-protocol/react",
        "@shelby-protocol/sdk",
        "@shelby-protocol/sdk/browser",
        "@shelby-protocol/clay-codes",
        "@shelby-protocol/reed-solomon",
      ],
    },
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      proxy: {
        "/api": {
          target: localApiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    define: {
      "process.env": {},
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        process: "process/browser",
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
  };
});
