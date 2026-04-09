/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_APTOS_WALLET_NAME?: string;
  readonly VITE_PRIMEGATE_REGISTRY_ADDRESS?: string;
  readonly VITE_SHELBY_API_KEY?: string;
  readonly VITE_SHELBY_RPC_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
