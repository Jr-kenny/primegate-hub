import { MotionConfig } from "framer-motion";

import App from "./App";
import { ThemeProvider } from "./components/theme/ThemeProvider";
import { Web3Providers } from "./components/Web3Providers";
import { PrimeGateWalletProvider } from "./hooks/usePrimeGateWallet";

export default function PrimeGateRuntime() {
  return (
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <Web3Providers>
          <PrimeGateWalletProvider>
            <App />
          </PrimeGateWalletProvider>
        </Web3Providers>
      </MotionConfig>
    </ThemeProvider>
  );
}
