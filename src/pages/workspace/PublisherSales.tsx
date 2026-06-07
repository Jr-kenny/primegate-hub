import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePrimeGateRegistry } from "@/hooks/usePrimeGateRegistry";
import { getAptosTransactionExplorerUrl, shortenHash } from "@/lib/aptos-explorer";

export default function PublisherSales() {
  const { publishedAssets, sales, salesSyncing, walletAddress } = usePrimeGateRegistry();
  const paidAssetCount = publishedAssets.filter((asset) => asset.price > 0).length;
  const totalSoldOctas = sales.reduce((total, sale) => total + BigInt(sale.paymentAmountOctas ?? "0"), 0n);
  const totalSoldApt = Number(totalSoldOctas) / 100000000;

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Sales</h1>
      {walletAddress ? (
        paidAssetCount > 0 ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Paid Listings</p>
                <p className="mt-1 text-2xl font-bold">{paidAssetCount}</p>
              </div>
              <div className="rounded-md border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Sales</p>
                <p className="mt-1 text-2xl font-bold">{sales.length}</p>
              </div>
              <div className="rounded-md border p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">APT Received</p>
                <p className="mt-1 text-2xl font-bold">{totalSoldApt.toLocaleString()}</p>
              </div>
            </div>

            {sales.length > 0 ? (
              <div className="space-y-3">
                {sales.map((sale) => (
                  <div key={`${sale.buyerWalletAddress}:${sale.packageId}:${sale.purchasedAt}`} className="rounded-md border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-mono font-medium">{sale.packageName}</p>
                        <p className="text-xs text-muted-foreground">
                          Buyer {shortenHash(sale.buyerWalletAddress, 6)}
                        </p>
                      </div>
                      <p className="text-sm font-medium">
                        {sale.paymentAmountOctas
                          ? `${Number(sale.paymentAmountOctas) / 100000000} APT`
                          : sale.price}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>Sold {new Date(sale.purchasedAt).toLocaleString()}</span>
                      {sale.paymentTxHash && <span className="font-mono">{shortenHash(sale.paymentTxHash)}</span>}
                      {sale.paymentTxHash && (
                        <Button asChild size="sm" variant="ghost" className="h-auto px-0 py-0 text-xs">
                          <a
                            href={getAptosTransactionExplorerUrl(sale.paymentTxHash)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View receipt
                            <ArrowUpRight className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
                {salesSyncing ? "Loading sales..." : "No paid sales yet."}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
            No paid listings yet.
          </div>
        )
      ) : (
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
          Connect your wallet to view sales data.
        </div>
      )}
    </div>
  );
}
