import type {
  AdapterNotDetectedWallet,
  AdapterWallet,
  InputTransactionData,
  Network,
  WalletContextState,
} from "@aptos-labs/wallet-adapter-react";

import { PRIMEGATE_WALLET_NAME } from "@/config/web3-constants";
import { normalizeAptosAddress } from "@/services/aptos";

type WalletServiceAdapter = Pick<
  WalletContextState,
  | "account"
  | "changeNetwork"
  | "connected"
  | "connect"
  | "disconnect"
  | "network"
  | "notDetectedWallets"
  | "signAndSubmitTransaction"
  | "wallets"
>;

let walletAdapter: WalletServiceAdapter | null = null;

function requireWalletAdapter(): WalletServiceAdapter {
  if (!walletAdapter) {
    throw new Error("Wallet adapter is not ready.");
  }

  return walletAdapter;
}

function requireConnectedWallet(): WalletServiceAdapter {
  const adapter = requireWalletAdapter();
  if (!adapter.account?.address) {
    throw new Error("Connect an Aptos wallet before continuing.");
  }

  return adapter;
}

export function setWalletAdapter(adapter: WalletServiceAdapter | null) {
  walletAdapter = adapter;
}

function findWalletByName<T extends { name: string }>(wallets: readonly T[], walletName: string) {
  return wallets.find((wallet) => wallet.name === walletName) ?? null;
}

function getAvailableWalletsInternal(): readonly AdapterWallet[] {
  return walletAdapter?.wallets ?? [];
}

function getInstallableWalletsInternal(): readonly AdapterNotDetectedWallet[] {
  return walletAdapter?.notDetectedWallets ?? [];
}

function resolveWalletName(walletName?: string) {
  const availableWallets = getAvailableWalletsInternal();

  if (walletName) {
    if (findWalletByName(availableWallets, walletName)) {
      return walletName;
    }

    if (findWalletByName(getInstallableWalletsInternal(), walletName)) {
      throw new Error(`${walletName} is not installed in this browser yet.`);
    }

    throw new Error(`${walletName} is not available in this browser.`);
  }

  if (findWalletByName(availableWallets, PRIMEGATE_WALLET_NAME)) {
    return PRIMEGATE_WALLET_NAME;
  }

  if (availableWallets.length > 0) {
    return availableWallets[0].name;
  }

  if (getInstallableWalletsInternal().length > 0) {
    throw new Error("No supported Aptos wallet is installed. Install one from the wallet list first.");
  }

  throw new Error("No supported Aptos wallets were detected.");
}

export function getAvailableWallets() {
  return [...getAvailableWalletsInternal()];
}

export function getInstallableWallets() {
  return [...getInstallableWalletsInternal()];
}

export async function connectWallet(walletName?: string) {
  const selectedWalletName = resolveWalletName(walletName);
  await requireWalletAdapter().connect(selectedWalletName);
}

export async function switchWalletNetwork(network: Network) {
  return requireWalletAdapter().changeNetwork(network);
}

export async function disconnectWallet() {
  await requireWalletAdapter().disconnect();
}

export function getAddress() {
  const address = walletAdapter?.account?.address;
  return address ? normalizeAptosAddress(address) : null;
}

export async function signAndSubmitTransaction(payload: InputTransactionData) {
  return requireConnectedWallet().signAndSubmitTransaction(payload);
}
