import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { groupAndSortWallets, useWallet } from "@aptos-labs/wallet-adapter-react";
import { serializeSignInOutput } from "@aptos-labs/siwa";
import type { NetworkInfo } from "@aptos-labs/wallet-adapter-react";

import { PRIMEGATE_APTOS_NETWORK } from "@/config/web3-constants";
import { toast } from "@/hooks/use-toast";
import {
  getLastPrimeGateAuthDebug,
  logoutPrimeGateSession,
  requestWalletMessageChallenge,
  requestWalletSessionNonce,
  verifyWalletMessageSessionSignature,
  verifyWalletSessionSignature,
  type PrimeGateAuthDebugState,
} from "@/lib/registry-api";
import {
  getPrimeGateWalletAuthChainId,
  shouldUsePrimeGateWalletMessageAuth,
} from "@/lib/primegate-wallet-auth";
import { normalizeAptosAddress } from "@/services/aptos";
import {
  clearPrimeGateSession,
  getStoredPrimeGateSession,
  hasValidPrimeGateSession,
  persistPrimeGateSession,
  type PrimeGateSession,
} from "@/services/auth";
import { connectWallet, disconnectWallet } from "@/services/wallet";

type PrimeGateNetworkName = "devnet" | "local" | "mainnet" | "shelbynet" | "testnet";

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "PrimeGate sign-in did not complete.";
}

function serializePublicKeyValue(
  value:
    | {
        bcsToHex?: () => { toString: () => string };
        toString: () => string;
      }
    | Uint8Array
    | string[]
    | string
    | null
    | undefined,
) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length === 1 && typeof value[0] === "string") {
      return value[0];
    }

    return value.every((entry) => typeof entry === "string") ? value : null;
  }

  if (value instanceof Uint8Array) {
    return `0x${Array.from(value, (entry) => entry.toString(16).padStart(2, "0")).join("")}`;
  }

  if ("bcsToHex" in value && typeof value.bcsToHex === "function") {
    return value.bcsToHex().toString();
  }

  const serialized = value.toString();
  return serialized && serialized !== "[object Object]" ? serialized : null;
}

function serializeSignatureValue(
  value:
    | {
        bcsToHex?: () => { toString: () => string };
        toString: () => string;
      }
    | Uint8Array
    | string[]
    | string
    | null
    | undefined,
) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length === 1 && typeof value[0] === "string") {
      return value[0];
    }

    return value.every((entry) => typeof entry === "string") ? value : null;
  }

  if (value instanceof Uint8Array) {
    return `0x${Array.from(value, (entry) => entry.toString(16).padStart(2, "0")).join("")}`;
  }

  const serialized = value.toString();
  if (serialized && serialized !== "[object Object]") {
    return serialized;
  }

  if ("bcsToHex" in value && typeof value.bcsToHex === "function") {
    return value.bcsToHex().toString();
  }

  return null;
}

function hasSiwaFeature(wallet: { features?: Record<string, unknown> } | null | undefined) {
  return Boolean(wallet?.features?.["aptos:signIn"]);
}

function extractNamedWalletNetwork(
  network: { name?: string | null; chainId?: number | string | null; url?: string | null } | null,
): PrimeGateNetworkName | null {
  if (!network) {
    return null;
  }

  const normalizedName = network.name?.trim().toLowerCase();
  if (normalizedName) {
    if (normalizedName === "shelbynet" || normalizedName.endsWith(":shelbynet")) {
      return "shelbynet";
    }

    if (normalizedName === "testnet" || normalizedName.endsWith(":testnet")) {
      return "testnet";
    }

    if (normalizedName === "mainnet" || normalizedName.endsWith(":mainnet")) {
      return "mainnet";
    }

    if (normalizedName === "devnet" || normalizedName.endsWith(":devnet")) {
      return "devnet";
    }

    if (normalizedName === "local" || normalizedName.endsWith(":local")) {
      return "local";
    }
  }

  const normalizedUrl = network.url?.trim().toLowerCase();
  if (normalizedUrl?.includes("shelbynet")) {
    return "shelbynet";
  }

  if (network.chainId === 118 || network.chainId === "118" || network.chainId === "0x76") {
    return "shelbynet";
  }

  if (network.chainId === 2 || network.chainId === "2" || network.chainId === "0x2") {
    return "testnet";
  }

  if (network.chainId === 1 || network.chainId === "1" || network.chainId === "0x1") {
    return "mainnet";
  }

  return null;
}

function getStoredWalletName() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem("AptosWalletName");
}

function hasWalletNetworkFeature(
  wallet: { features?: Record<string, unknown> } | null | undefined,
): wallet is { features: Record<"aptos:network", { network: () => Promise<NetworkInfo> }> } {
  const feature = wallet?.features?.["aptos:network"];
  return Boolean(
    feature &&
      typeof feature === "object" &&
      "network" in feature &&
      typeof (feature as { network?: unknown }).network === "function",
  );
}

function usePrimeGateWalletState() {
  const wallet = useWallet();
  const [isVerifyingSession, setIsVerifyingSession] = useState(false);
  const [lastSessionDebug, setLastSessionDebug] = useState<PrimeGateAuthDebugState | null>(null);
  const [lastSessionError, setLastSessionError] = useState<string | null>(null);
  const [session, setSession] = useState<PrimeGateSession | null>(null);
  const [resolvedNetworkInfo, setResolvedNetworkInfo] = useState<NetworkInfo | null>(null);
  const [isRefreshingNetwork, setIsRefreshingNetwork] = useState(false);
  const pendingInteractiveSignInRef = useRef(false);
  const autoSignInAttemptedRef = useRef<string | null>(null);

  const address = useMemo(
    () => (wallet.account?.address ? normalizeAptosAddress(wallet.account.address) : null),
    [wallet.account?.address],
  );

  const groupedWallets = useMemo(
    () => groupAndSortWallets([...wallet.wallets, ...wallet.notDetectedWallets]),
    [wallet.notDetectedWallets, wallet.wallets],
  );
  const supportsSiwa = useMemo(() => hasSiwaFeature(wallet.wallet), [wallet.wallet]);
  const walletHasNetworkFeature = hasWalletNetworkFeature(wallet.wallet);
  const storedWalletName = getStoredWalletName();
  const isReconnectingWallet = Boolean(storedWalletName) && wallet.isLoading && !wallet.connected;

  useEffect(() => {
    if (!wallet.connected) {
      setResolvedNetworkInfo(null);
      setIsRefreshingNetwork(false);
      return;
    }

    if (!walletHasNetworkFeature) {
      setResolvedNetworkInfo(wallet.network);
      setIsRefreshingNetwork(false);
      return;
    }

    let cancelled = false;
    setIsRefreshingNetwork(true);

    void wallet.wallet.features["aptos:network"]
      .network()
      .then((networkInfo) => {
        if (!cancelled) {
          setResolvedNetworkInfo(networkInfo);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedNetworkInfo(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsRefreshingNetwork(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [wallet.connected, wallet.network, wallet.wallet, walletHasNetworkFeature]);

  const effectiveNetworkInfo = walletHasNetworkFeature ? resolvedNetworkInfo : wallet.network;
  const networkName = useMemo(() => extractNamedWalletNetwork(effectiveNetworkInfo), [effectiveNetworkInfo]);
  const walletNetworkDebug = useMemo(
    () => {
      const rawNetwork = wallet.network
        ? {
            chainId: wallet.network.chainId ?? null,
            name: wallet.network.name ?? null,
            url: wallet.network.url ?? null,
          }
        : null;
      const resolvedNetwork = resolvedNetworkInfo
        ? {
            chainId: resolvedNetworkInfo.chainId ?? null,
            name: resolvedNetworkInfo.name ?? null,
            url: resolvedNetworkInfo.url ?? null,
          }
        : null;

      return {
        adapter: rawNetwork,
        resolved: resolvedNetwork,
      };
    },
    [resolvedNetworkInfo, wallet.network],
  );
  const isWrongNetwork =
    wallet.connected &&
    !wallet.isLoading &&
    !isRefreshingNetwork &&
    networkName !== PRIMEGATE_APTOS_NETWORK;
  const usesWalletMessageAuth = shouldUsePrimeGateWalletMessageAuth(
    supportsSiwa,
    networkName === PRIMEGATE_APTOS_NETWORK,
  );

  useEffect(() => {
    const storedSession = getStoredPrimeGateSession();

    if (!address) {
      setSession(null);
      autoSignInAttemptedRef.current = null;
      return;
    }

    if (!storedSession) {
      setSession(null);
      return;
    }

    if (!hasValidPrimeGateSession(address) || storedSession.walletAddress !== address) {
      clearPrimeGateSession();
      setSession(null);
      return;
    }

    setSession(storedSession);
  }, [address]);

  const createPrimeGateSession = useCallback(async () => {
    if (!address) {
      throw new Error("Connect your wallet before signing in to PrimeGate.");
    }

    if (!wallet.connected || !wallet.account) {
      throw new Error("A connected wallet is required.");
    }

    if (!wallet.wallet?.name) {
      throw new Error("The connected wallet name was not available.");
    }

    if (usesWalletMessageAuth) {
      if (!wallet.signMessage) {
        throw new Error("The connected wallet does not support PrimeGate authentication.");
      }

      const publicKey = serializePublicKeyValue(wallet.account.publicKey);
      if (!publicKey) {
        throw new Error("The connected wallet did not expose a serializable public key.");
      }

      const challenge = await requestWalletMessageChallenge(
        address,
        getPrimeGateWalletAuthChainId(effectiveNetworkInfo) ?? undefined,
      );
      const output = await wallet.signMessage({
        address: true,
        application: true,
        chainId: true,
        message: challenge.message,
        nonce: challenge.nonce,
      });

      if (!output.address) {
        throw new Error("The connected wallet did not return the signed wallet address.");
      }

      const signature = serializeSignatureValue(output.signature);
      if (!signature) {
        throw new Error("The connected wallet did not return a serializable message signature.");
      }

      const nextSession = (
        await verifyWalletMessageSessionSignature({
          address: output.address,
          application: output.application ?? challenge.application,
          chainId: output.chainId ?? challenge.chainId,
          fullMessage: output.fullMessage,
          message: output.message ?? challenge.message,
          nonce: output.nonce ?? challenge.nonce,
          prefix: output.prefix,
          publicKey,
          signature,
          walletAddress: address,
        })
      ).session;

      persistPrimeGateSession(nextSession);
      setSession(nextSession);
      return nextSession;
    }

    if (!wallet.signIn) {
      throw new Error("The connected wallet does not support Sign in with Aptos.");
    }

    const challenge = await requestWalletSessionNonce(address);
    const output = await wallet.signIn({
      input: challenge.input,
      walletName: wallet.wallet.name,
    });

    if (!output) {
      throw new Error("Wallet sign-in was cancelled.");
    }

    const nextSession = (
      await verifyWalletSessionSignature({
        output: serializeSignInOutput(output),
      })
    ).session;

    persistPrimeGateSession(nextSession);
    setSession(nextSession);
    return nextSession;
  }, [address, effectiveNetworkInfo, usesWalletMessageAuth, wallet]);

  async function runSessionAttempt<T>(attempt: () => Promise<T>) {
    setIsVerifyingSession(true);
    setLastSessionDebug(null);
    setLastSessionError(null);

    try {
      return await attempt();
    } finally {
      setIsVerifyingSession(false);
    }
  }

  const clearSession = () => {
    pendingInteractiveSignInRef.current = false;
    clearPrimeGateSession();
    setLastSessionDebug(null);
    setLastSessionError(null);
    setSession(null);
    void logoutPrimeGateSession().catch((error) => {
      console.error("PrimeGate session logout failed", { error });
    });
  };

  const ensurePrimeGateSession = useCallback(async () => {
    pendingInteractiveSignInRef.current = false;

    if (!address) {
      throw new Error("Connect your wallet before signing in to PrimeGate.");
    }

    if (!wallet.connected || !wallet.account) {
      throw new Error("A connected wallet is required.");
    }

    const storedSession = getStoredPrimeGateSession();
    if (storedSession && hasValidPrimeGateSession(address) && storedSession.walletAddress === address) {
      setSession(storedSession);
      return storedSession;
    }

    try {
      return await runSessionAttempt(createPrimeGateSession);
    } catch (error) {
      const message = getErrorMessage(error);
      setLastSessionDebug(getLastPrimeGateAuthDebug());
      setLastSessionError(message);
      console.error("PrimeGate sign-in failed", {
        error,
        walletAddress: address,
        walletName: wallet.wallet?.name ?? null,
      });
      toast({
        title: "PrimeGate sign-in failed",
        description: message,
        variant: "destructive",
      });
      throw error;
    }
  }, [address, createPrimeGateSession, wallet.account, wallet.connected, wallet.wallet?.name]);

  const ensurePrimeGateSessionSilently = useCallback(async () => {
    pendingInteractiveSignInRef.current = false;

    if (!address) {
      throw new Error("Connect your wallet before signing in to PrimeGate.");
    }

    if (!wallet.connected || !wallet.account) {
      throw new Error("A connected wallet is required.");
    }

    const storedSession = getStoredPrimeGateSession();
    if (storedSession && hasValidPrimeGateSession(address) && storedSession.walletAddress === address) {
      setSession(storedSession);
      return storedSession;
    }

    try {
      return await runSessionAttempt(createPrimeGateSession);
    } catch (error) {
      const message = getErrorMessage(error);
      setLastSessionDebug(getLastPrimeGateAuthDebug());
      setLastSessionError(message);
      console.error("PrimeGate sign-in failed", {
        error,
        walletAddress: address,
        walletName: wallet.wallet?.name ?? null,
      });
      throw error;
    }
  }, [address, createPrimeGateSession, wallet.account, wallet.connected, wallet.wallet?.name]);

  useEffect(() => {
    if (!pendingInteractiveSignInRef.current) {
      return;
    }

    if (!wallet.connected || !wallet.account || !address || wallet.isLoading || session || isVerifyingSession) {
      return;
    }

    autoSignInAttemptedRef.current = address;
    pendingInteractiveSignInRef.current = false;
    void ensurePrimeGateSession().catch(() => {
      // ensurePrimeGateSession already records the error state.
    });
  }, [address, ensurePrimeGateSession, isVerifyingSession, session, wallet.account, wallet.connected, wallet.isLoading]);

  useEffect(() => {
    if (!address) {
      return;
    }

    if (!wallet.connected || !wallet.account || wallet.isLoading || session || isVerifyingSession) {
      return;
    }

    if (autoSignInAttemptedRef.current === address) {
      return;
    }

    autoSignInAttemptedRef.current = address;
    void ensurePrimeGateSessionSilently().catch(() => {
      // Silent auto sign-in; errors are logged but not surfaced as toasts.
    });
  }, [address, ensurePrimeGateSessionSilently, isVerifyingSession, session, wallet.account, wallet.connected, wallet.isLoading]);

  const connect = async (walletName?: string) => {
    setLastSessionError(null);
    setLastSessionDebug(null);
    try {
      pendingInteractiveSignInRef.current = true;
      await connectWallet(walletName);
    } catch (error) {
      pendingInteractiveSignInRef.current = false;
      const message = getErrorMessage(error);
      setLastSessionError(message);
      console.error("PrimeGate wallet connect failed", {
        error,
        requestedWalletName: walletName ?? null,
      });
      toast({
        title: "Wallet connection failed",
        description: message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const disconnect = async () => {
    pendingInteractiveSignInRef.current = false;
    clearPrimeGateSession();
    setLastSessionDebug(null);
    setLastSessionError(null);
    setSession(null);
    try {
      await disconnectWallet();
    } catch (error) {
      const message = getErrorMessage(error);
      setLastSessionError(message);
      console.error("PrimeGate wallet disconnect failed", { error });
      toast({
        title: "Wallet disconnect failed",
        description: message,
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    ...wallet,
    address,
    availableWallets: groupedWallets.availableWallets,
    clearSession,
    connect,
    disconnect,
    ensurePrimeGateSession,
    hasSession: Boolean(session),
    installableWallets: groupedWallets.installableWallets,
    isConnected: wallet.connected,
    isReconnectingWallet,
    isRefreshingNetwork,
    supportsSiwa,
    isVerifyingSession,
    isWrongNetwork,
    lastSessionDebug,
    lastSessionError,
    networkName,
    walletNetworkDebug,
    requiredNetworkName: PRIMEGATE_APTOS_NETWORK,
    session,
    shortAddress: address ? shortenAddress(address) : null,
    usesWalletMessageAuth,
  };
}

type PrimeGateWalletState = ReturnType<typeof usePrimeGateWalletState>;

const PrimeGateWalletContext = createContext<PrimeGateWalletState | null>(null);

export function PrimeGateWalletProvider({ children }: { children: ReactNode }) {
  const value = usePrimeGateWalletState();
  return createElement(PrimeGateWalletContext.Provider, { value }, children);
}

export function usePrimeGateWallet() {
  const value = useContext(PrimeGateWalletContext);

  if (!value) {
    throw new Error("usePrimeGateWallet must be used within PrimeGateWalletProvider.");
  }

  return value;
}
