import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePrimeGateRegistry } from "@/hooks/usePrimeGateRegistry";
import { getAptosTransactionExplorerUrl, shortenHash } from "@/lib/aptos-explorer";

export default function Purchases() {
  const { purchases, walletAddress } = usePrimeGateRegistry();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Purchases</h1>
      <p className="text-sm text-muted-foreground">Assets you've purchased or licensed.</p>
      {walletAddress && purchases.length > 0 ? (
        <div className="space-y-3">
          {purchases.map((purchase) => (
            <div key={`${purchase.walletAddress}:${purchase.packageId}`} className="rounded-md border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-mono font-medium">{purchase.packageName}</p>
                  <p className="text-xs text-muted-foreground">{purchase.publisher}</p>
                </div>
                <p className="text-sm font-medium">{purchase.price}</p>
              </div>
              {purchase.paymentTxHash && (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-mono">{shortenHash(purchase.paymentTxHash)}</span>
                  {purchase.paymentAmountOctas && (
                    <span>{Number(purchase.paymentAmountOctas) / 100000000} APT paid</span>
                  )}
                  {purchase.paymentRecipient && (
                    <span>to {shortenHash(purchase.paymentRecipient, 6)}</span>
                  )}
                  <Button asChild size="sm" variant="ghost" className="h-auto px-0 py-0 text-xs">
                    <a
                      href={getAptosTransactionExplorerUrl(purchase.paymentTxHash)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View receipt
                      <ArrowUpRight className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Purchased {new Date(purchase.purchasedAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
          {walletAddress ? "No purchases yet." : "Connect your wallet to view purchases."}
        </div>
      )}
    </div>
  );
}
