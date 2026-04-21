import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const localApiProxyTarget = env.LOCAL_API_PROXY_TARGET?.trim() || "http://127.0.0.1:3000";

  return {
    assetsInclude: ["**/*.wasm"],
    build: {
      chunkSizeWarningLimit: 650,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              return undefined;
            }

            if (id.includes("@shelby-protocol")) {
              return "shelby";
            }

            if (id.includes("@aptos-labs/siwa")) {
              return "aptos-siwa";
            }

            if (
              id.includes("@aptos-connect") ||
              id.includes("@identity-connect") ||
              id.includes("@aptos-labs/wallet-adapter") ||
              id.includes("@aptos-labs/wallet-standard")
            ) {
              return "aptos-wallet";
            }

            const tsSdkModuleMatch = id.match(/@aptos-labs[\\/]+ts-sdk[\\/]dist[\\/]esm[\\/](.+)\.mjs$/);
            if (tsSdkModuleMatch) {
              return `aptos-sdk-${tsSdkModuleMatch[1].replace(/[\\/]/g, "-")}`;
            }

            if (id.includes("@aptos-labs/ts-sdk")) {
              return "aptos-sdk";
            }

            return undefined;
          },
        },
      },
    },
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
    plugins: [react()],
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
