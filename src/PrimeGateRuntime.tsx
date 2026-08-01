import { MotionConfig } from "framer-motion";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import App from "./App";
import { ThemeProvider } from "./components/theme/ThemeProvider";
import { Web3Providers } from "./components/Web3Providers";
import { PrimeGateWalletProvider } from "./hooks/usePrimeGateWallet";

const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      retry: false,
    },
    queries: {
      retry: 2,
      staleTime: 30_000,
    },
  },
});

export default function PrimeGateRuntime() {
  return (
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <QueryClientProvider client={queryClient}>
          <Web3Providers>
            <PrimeGateWalletProvider>
              <App />
            </PrimeGateWalletProvider>
          </Web3Providers>
        </QueryClientProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
