import "./polyfills";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { Web3Providers } from "./components/Web3Providers.tsx";
import { PrimeGateWalletProvider } from "./hooks/usePrimeGateWallet.ts";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <Web3Providers>
    <PrimeGateWalletProvider>
      <App />
    </PrimeGateWalletProvider>
  </Web3Providers>,
);
