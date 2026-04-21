import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { PRIMEGATE_REGISTRY_CONTRACT_ADDRESS } from "@/config/primegate-registry";
import type { RegistryPackage, RegistryPackageResolution } from "@/lib/registry-data";
import { getPrimeGateTransactionOptions } from "@/lib/aptos-client";
import {
  encodePrimeGatePackageId,
  getPrimeGateRegistryFunctionId,
} from "@/lib/primegate-registry-contract";
import {
  fetchEntitlements,
  fetchInstalls,
  fetchPublishedAssets,
  fetchPublisherSales,
  fetchPurchases,
  persistInstall,
  persistPurchase,
} from "@/lib/registry-api";
import {
  type PrimeGateEntitlementRecord,
  type PrimeGateInstallRecord,
  type PrimeGatePurchaseRecord,
  type PrimeGatePublishedAssetRecord,
  type PrimeGatePublisherSaleRecord,
} from "@/lib/registry-state";
import { usePrimeGateWallet } from "@/hooks/usePrimeGateWallet";

function isFreePackage(pkg: RegistryPackage) {
  return pkg.price.trim().toLowerCase() === "free";
}

const WALLET_SCOPED_QUERY_KEYS = [
  ["primegate", "purchases"],
  ["primegate", "installs"],
  ["primegate", "published-assets"],
  ["primegate", "sales"],
  ["primegate", "entitlements"],
] as const;

function clearWalletScopedQueries(queryClient: QueryClient, walletAddress: string) {
  for (const queryKey of WALLET_SCOPED_QUERY_KEYS) {
    queryClient.removeQueries({
      exact: true,
      queryKey: [...queryKey, walletAddress],
    });
  }
}

export function usePrimeGateRegistry() {
  const {
    address,
    ensurePrimeGateSession,
    hasSession,
    isWrongNetwork,
    requiredNetworkName,
    signAndSubmitTransaction,
  } = usePrimeGateWallet();
  const queryClient = useQueryClient();
  const previousWalletAddressRef = useRef<string | null>(null);

  const walletAddress = address?.toLowerCase() ?? null;

  useEffect(() => {
    const previousWalletAddress = previousWalletAddressRef.current;

    if (previousWalletAddress && previousWalletAddress !== walletAddress) {
      clearWalletScopedQueries(queryClient, previousWalletAddress);
    }

    if (walletAddress && !hasSession) {
      clearWalletScopedQueries(queryClient, walletAddress);
    }

    previousWalletAddressRef.current = walletAddress;
  }, [hasSession, queryClient, walletAddress]);

  const purchasesQuery = useQuery({
    enabled: Boolean(walletAddress && hasSession),
    queryKey: ["primegate", "purchases", walletAddress],
    queryFn: async () => {
      if (!walletAddress) {
        return [];
      }

      try {
        return await fetchPurchases(walletAddress);
      } catch {
        return [];
      }
    },
  });

  const installsQuery = useQuery({
    enabled: Boolean(walletAddress && hasSession),
    queryKey: ["primegate", "installs", walletAddress],
    queryFn: async () => {
      if (!walletAddress) {
        return [];
      }

      try {
        return await fetchInstalls(walletAddress);
      } catch {
        return [];
      }
    },
  });

  const publishedAssetsQuery = useQuery({
    enabled: Boolean(walletAddress && hasSession),
    queryKey: ["primegate", "published-assets", walletAddress],
    queryFn: async () => {
      if (!walletAddress) {
        return [];
      }

      try {
        return await fetchPublishedAssets(walletAddress);
      } catch {
        return [];
      }
    },
  });

  const entitlementsQuery = useQuery({
    enabled: Boolean(walletAddress && hasSession),
    queryKey: ["primegate", "entitlements", walletAddress],
    queryFn: async () => {
      if (!walletAddress) {
        return [];
      }

      try {
        return await fetchEntitlements(walletAddress);
      } catch {
        return [];
      }
    },
  });

  const salesQuery = useQuery({
    enabled: Boolean(walletAddress && hasSession),
    queryKey: ["primegate", "sales", walletAddress],
    queryFn: async () => {
      if (!walletAddress) {
        return [];
      }

      try {
        return await fetchPublisherSales(walletAddress);
      } catch {
        return [];
      }
    },
  });

  const purchases = useMemo(() => {
    return [...(purchasesQuery.data ?? [])].sort((left, right) =>
      right.purchasedAt.localeCompare(left.purchasedAt),
    );
  }, [purchasesQuery.data]);

  const installs = useMemo(() => {
    return [...(installsQuery.data ?? [])].sort((left, right) =>
      right.installedAt.localeCompare(left.installedAt),
    );
  }, [installsQuery.data]);

  const publishedAssets = useMemo(() => {
    return [...(publishedAssetsQuery.data ?? [])].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }, [publishedAssetsQuery.data]);

  const entitlements = useMemo(() => {
    return [...(entitlementsQuery.data ?? [])].sort((left, right) =>
      right.grantedAt.localeCompare(left.grantedAt),
    );
  }, [entitlementsQuery.data]);

  const sales = useMemo(() => {
    return [...(salesQuery.data ?? [])].sort((left, right) =>
      right.purchasedAt.localeCompare(left.purchasedAt),
    );
  }, [salesQuery.data]);

  function requireWalletAddress() {
    if (!walletAddress) {
      throw new Error("Connect your wallet before continuing.");
    }

    return walletAddress;
  }

  function isPurchased(packageId: string) {
    return purchases.some((purchase) => purchase.packageId === packageId);
  }

  function isInstalled(packageId: string) {
    return installs.some((install) => install.packageId === packageId);
  }

  function getPurchase(packageId: string) {
    return purchases.find((purchase) => purchase.packageId === packageId) ?? null;
  }

  async function purchasePackage(pkg: RegistryPackage, resolution?: RegistryPackageResolution | null) {
    const nextWalletAddress = requireWalletAddress();

    if (isFreePackage(pkg)) {
      return null;
    }

    if (isPurchased(pkg.id)) {
      return purchases.find((purchase) => purchase.packageId === pkg.id) ?? null;
    }

    await ensurePrimeGateSession();

    if (isWrongNetwork) {
      throw new Error(`Switch your wallet to ${requiredNetworkName} before purchasing with APT.`);
    }

    if (!resolution?.payment) {
      throw new Error("On-chain APT checkout is only supported for PrimeGate-published artifacts right now.");
    }

    const purchaseOptions = await getPrimeGateTransactionOptions(10_000);
    const transaction = await signAndSubmitTransaction({
      sender: nextWalletAddress,
      data: {
        function: getPrimeGateRegistryFunctionId(
          PRIMEGATE_REGISTRY_CONTRACT_ADDRESS,
          "purchase_package",
        ),
        functionArguments: [encodePrimeGatePackageId(pkg.id)],
      },
      options: purchaseOptions,
    });

    const persistedPurchase = await persistPurchase({
      packageId: pkg.id,
      paymentTxHash: transaction.hash,
      walletAddress: nextWalletAddress,
    });

    queryClient.setQueryData<PrimeGatePurchaseRecord[]>(
      ["primegate", "purchases", nextWalletAddress],
      (currentPurchases = []) => {
        const nextPurchases = new Map(currentPurchases.map((purchase) => [purchase.packageId, purchase]));
        nextPurchases.set(persistedPurchase.packageId, persistedPurchase);
        return Array.from(nextPurchases.values()).sort((left, right) =>
          right.purchasedAt.localeCompare(left.purchasedAt),
        );
      },
    );

    queryClient.setQueryData<PrimeGateEntitlementRecord[]>(
      ["primegate", "entitlements", nextWalletAddress],
      (currentEntitlements = []) => {
        const nextEntitlements = new Map(
          currentEntitlements.map((entitlement) => [entitlement.packageId, entitlement]),
        );
        nextEntitlements.set(persistedPurchase.packageId, {
          grantedAt: persistedPurchase.purchasedAt,
          packageId: persistedPurchase.packageId,
          packageName: persistedPurchase.packageName,
          source: "purchase",
          walletAddress: persistedPurchase.walletAddress,
        });
        return Array.from(nextEntitlements.values()).sort((left, right) =>
          right.grantedAt.localeCompare(left.grantedAt),
        );
      },
    );

    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["primegate", "purchases", nextWalletAddress],
      }),
      queryClient.invalidateQueries({
        queryKey: ["primegate", "entitlements", nextWalletAddress],
      }),
    ]);

    return persistedPurchase;
  }

  async function installPackage(pkg: RegistryPackage) {
    const nextWalletAddress = requireWalletAddress();

    if (!isFreePackage(pkg) && !isPurchased(pkg.id)) {
      throw new Error("Purchase this package before installing it.");
    }

    if (isInstalled(pkg.id)) {
      return installs.find((install) => install.packageId === pkg.id) ?? null;
    }

    await ensurePrimeGateSession();

    const record = {
      installedAt: new Date().toISOString(),
      packageId: pkg.id,
      packageName: pkg.name,
      version: pkg.version,
      walletAddress: nextWalletAddress,
    };

    const persistedInstall = await persistInstall(record);

    queryClient.setQueryData<PrimeGateInstallRecord[]>(
      ["primegate", "installs", nextWalletAddress],
      (currentInstalls = []) => {
        const nextInstalls = new Map(currentInstalls.map((install) => [install.packageId, install]));
        nextInstalls.set(persistedInstall.packageId, persistedInstall);
        return Array.from(nextInstalls.values()).sort((left, right) =>
          right.installedAt.localeCompare(left.installedAt),
        );
      },
    );

    await queryClient.invalidateQueries({
      queryKey: ["primegate", "installs", nextWalletAddress],
    });

    return persistedInstall;
  }

  return {
    entitlements,
    getPurchase,
    installs,
    sales,
    isInstalled,
    isPurchased,
    hasSession,
    publishedAssets,
    installsSyncing: installsQuery.isFetching,
    purchasesSyncing: purchasesQuery.isFetching,
    publishedAssetsSyncing: publishedAssetsQuery.isFetching,
    salesSyncing: salesQuery.isFetching,
    purchasePackage,
    purchases,
    walletAddress,
    installPackage,
  };
}
