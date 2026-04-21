import App from "./App";
import { Web3Providers } from "./components/Web3Providers";
import { PrimeGateWalletProvider } from "./hooks/usePrimeGateWallet";

export default function PrimeGateRuntime() {
  return (
    <Web3Providers>
      <PrimeGateWalletProvider>
        <App />
      </PrimeGateWalletProvider>
    </Web3Providers>
  );
}
