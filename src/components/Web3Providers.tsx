import { useEffect, type ReactNode } from "react";
import { AptosWalletAdapterProvider, useWallet } from "@aptos-labs/wallet-adapter-react";

import { PRIMEGATE_APTOS_NETWORK } from "@/config/web3-constants";
import { setWalletAdapter } from "@/services/wallet";

const WalletBridge = ({ children }: { children: ReactNode }) => {
  const wallet = useWallet();

  useEffect(() => {
    setWalletAdapter(wallet);
    return () => {
      setWalletAdapter(null);
    };
  }, [wallet]);

  return <>{children}</>;
};

export const Web3Providers = ({ children }: { children: ReactNode }) => (
  <AptosWalletAdapterProvider
    autoConnect
    dappConfig={{ network: PRIMEGATE_APTOS_NETWORK }}
    disableTelemetry
    onError={(error) => {
      console.error("Aptos wallet adapter error", error);
    }}
  >
    <WalletBridge>{children}</WalletBridge>
  </AptosWalletAdapterProvider>
);
