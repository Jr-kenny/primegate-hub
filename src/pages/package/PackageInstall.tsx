import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, Download, FileJson, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrimeGatePackageResolution } from "@/hooks/usePrimeGateCatalog";
import { usePackageRouteData } from "@/hooks/usePackageRouteData";
import { usePrimeGateRegistry } from "@/hooks/usePrimeGateRegistry";
import { toast } from "@/hooks/use-toast";
import { getAptosTransactionExplorerUrl, shortenHash } from "@/lib/aptos-explorer";
import { formatPrimeGatePackageTypeLabel } from "@/lib/primegate-package-type";
import { usePrimeGateWallet } from "@/hooks/usePrimeGateWallet";

function triggerBrowserDownload(url: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noreferrer";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

export default function PackageInstall() {
  const navigate = useNavigate();
  const [isActionPending, setIsActionPending] = useState(false);
  const { pkg } = usePackageRouteData();
  const { data: resolution, isLoading: resolutionLoading } = usePrimeGatePackageResolution(pkg.id);
  const { availableWallets, connect, isConnected } = usePrimeGateWallet();
  const { getPurchase, installPackage, isInstalled, isPurchased, purchasePackage } = usePrimeGateRegistry();

  const purchased = isPurchased(pkg.id);
  const installed = isInstalled(pkg.id);
  const isFree = pkg.price.trim().toLowerCase() === "free";
  const purchase = getPurchase(pkg.id);
  const requiresPurchase = !isFree && !purchased;
  const accessLocked =
    requiresPurchase &&
    (resolutionLoading || !resolution || resolution.access === "purchase-required");

  const handlePrimaryAction = async () => {
    setIsActionPending(true);
    try {
      if (!isConnected) {
        if (availableWallets.length > 0) {
          await connect(availableWallets[0].name);
          return;
        }

        navigate("/workspace/wallet");
        return;
      }

      if (!isFree && !purchased) {
        const nextPurchase = await purchasePackage(pkg, resolution);
        toast({
          title: "Payment verified",
          description: nextPurchase?.paymentTxHash
            ? `${pkg.name} unlocked on-chain in ${shortenHash(nextPurchase.paymentTxHash)}.`
            : `${pkg.name} is now unlocked for this exact artifact version in your workspace.`,
        });
        return;
      }

      if (resolution?.artifact && resolution.downloadUrl) {
        if (!installed) {
          await installPackage(pkg);
        }

        triggerBrowserDownload(
          resolution.downloadUrl,
          resolution.artifact.originalFileName,
        );

        toast({
          title: installed ? "Download started" : "Added to workspace",
          description: installed
            ? `${pkg.name} is downloading to your device again.`
            : `${pkg.name} was saved in your workspace and is downloading to your device.`,
        });
        return;
      }

      if (!installed) {
        await installPackage(pkg);
        toast({
          title: "Saved in workspace",
          description: `${pkg.name} was added to your PrimeGate workspace.`,
        });
      }
    } catch (error) {
      toast({
        title: "Action failed",
        description: error instanceof Error ? error.message : "PrimeGate could not complete that action.",
        variant: "destructive",
      });
    } finally {
      setIsActionPending(false);
    }
  };

  const primaryActionBusyLabel = !isConnected
    ? "Connecting Wallet..."
    : !isFree && !purchased
      ? "Confirming Payment..."
      : resolution?.artifact && resolution.downloadUrl
        ? installed
          ? "Starting Download..."
          : "Preparing Download..."
        : "Saving to Workspace...";

  const primaryActionLabel = !isConnected
    ? "Connect Wallet"
    : !isFree && !purchased
      ? resolution?.payment
        ? `Buy Access (${resolution.payment.amountApt} APT)`
        : `Buy Access (${pkg.price})`
      : resolution?.artifact && resolution.downloadUrl
        ? installed
          ? "Download Again"
          : "Download Package"
        : installed
          ? "Saved in Workspace"
          : "Save in Workspace";

  return (
    <div className="space-y-4">
      <div className="pg-fade-up rounded-md border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-accent uppercase tracking-wide">Registry Access</p>
            <p className="text-sm text-muted-foreground">
              {!isConnected
                ? "Connect your wallet to purchase or install this package."
                : resolution?.artifact && resolution.downloadUrl
                  ? installed
                    ? "This package is already in your workspace. Download it again to this device any time."
                    : "Web access downloads the package to this device and keeps the package in your PrimeGate workspace."
                  : installed
                    ? "This package is already saved in your workspace."
                  : !isFree && !purchased
                    ? "Pay once with APT to unlock lifetime access to this exact artifact."
                    : "Save this package into your PrimeGate workspace."}
            </p>
          </div>
          <Button type="button" loading={isActionPending} onClick={() => void handlePrimaryAction()}>
            {isActionPending ? primaryActionBusyLabel : primaryActionLabel}
          </Button>
        </div>
      </div>

      {!accessLocked && (
        <>
          <div className="pg-fade-up rounded-md border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-accent" />
              <p className="text-xs font-medium text-accent uppercase tracking-wide">Registry Resolve</p>
            </div>
            {resolutionLoading || !resolution ? (
              <div className="rounded-md border bg-secondary/40 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                  Loading PrimeGate package resolution...
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
            {resolution.packageHandle && (
              <div className="rounded-md border p-3 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Package Identity</p>
                <p className="text-sm font-medium">{resolution.packageName}</p>
                <p className="font-mono text-xs text-muted-foreground break-all">{resolution.packageHandle}</p>
                <p className="text-xs text-muted-foreground break-all">Release ID: {resolution.packageId}</p>
              </div>
            )}
            {resolution.payment && (
              <div className="rounded-md border p-3 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">APT Checkout</p>
                <p className="text-sm font-medium">
                  {resolution.payment.amountApt} APT to {resolution.payment.recipientAddress}
                </p>
                <p className="text-xs text-muted-foreground">
                  One confirmed testnet payment unlocks this exact artifact for this wallet. A new paid publish would
                  require a new purchase.
                </p>
              </div>
            )}
            {resolution.offer && (
              <div className="rounded-md border p-3 space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Offer</p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{resolution.offer.name}</p>
                  <p className="text-sm font-medium">
                    {resolution.offer.price === "0" ? "Free" : `${resolution.offer.price} APT`}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">{resolution.offer.description}</p>
                <p className="text-xs text-muted-foreground">
                  License: {resolution.offer.license} · Updates: {resolution.offer.updatePolicy.replace("-", " ")}
                </p>
              </div>
            )}
            {purchase?.paymentTxHash && (
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">On-Chain Receipt</p>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-mono">{shortenHash(purchase.paymentTxHash)}</span>
                  <span className="text-muted-foreground">
                    {purchase.paymentAmountOctas
                      ? `${Number(purchase.paymentAmountOctas) / 100000000} APT`
                      : purchase.price}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(purchase.purchasedAt).toLocaleString()}
                  </span>
                </div>
                <Button asChild size="sm" variant="outline">
                  <a
                    href={getAptosTransactionExplorerUrl(purchase.paymentTxHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View On Aptos Explorer
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            )}
            <div className="rounded-md bg-secondary p-3 font-mono text-sm break-all">
              {resolution.resolveUrl}
            </div>
            <p className="text-sm text-muted-foreground">
              PrimeGate resolves this package from its canonical registry record and only exposes artifact endpoints
              when access is allowed.
            </p>
            {resolution.artifact ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border p-3 space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Artifact</p>
                  <p className="text-sm font-medium break-all">{resolution.artifact.originalFileName}</p>
                  <p className="text-xs text-muted-foreground break-all">
                    {formatPrimeGatePackageTypeLabel(pkg.type)} · {resolution.artifact.mimeType} · {resolution.artifact.sizeBytes.toLocaleString()} bytes
                  </p>
                  <p className="text-xs text-muted-foreground break-all">
                    {resolution.artifact.assetBlobName}
                  </p>
                  {resolution.artifact.assetSha256 && (
                    <p className="text-xs text-muted-foreground break-all">
                      SHA-256: {resolution.artifact.assetSha256}
                    </p>
                  )}
                </div>
                <div className="rounded-md border p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Artifact Access</p>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <a href={resolution.downloadUrl ?? "#"} download={resolution.artifact.originalFileName}>
                        <Download className="h-3.5 w-3.5" />
                        Download Artifact
                      </a>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <a href={resolution.manifestUrl ?? "#"}>
                        <FileJson className="h-3.5 w-3.5" />
                        View Manifest
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-md border p-3 text-sm text-muted-foreground">
                {resolution.access === "purchase-required"
                  ? "This package is listed publicly, but PrimeGate only exposes manifest and download endpoints after entitlement is granted."
                  : "This package resolves through PrimeGate, but it does not currently expose a browser-downloadable Shelby-backed artifact."}
              </div>
            )}
          </div>
            )}
          </div>

          <div className="pg-fade-up rounded-md border bg-card p-4 space-y-2">
            <p className="text-xs font-medium text-accent uppercase tracking-wide">CLI</p>
            <div className="font-mono text-sm bg-secondary rounded-md p-3">
              <span className="text-muted-foreground">$</span> {resolution?.install.cli ?? `primegate install ${pkg.name}`}
            </div>
          </div>
          <div className="pg-fade-up rounded-md border bg-card p-4 space-y-2">
            <p className="text-xs font-medium text-accent uppercase tracking-wide">SDK</p>
            <div className="font-mono text-sm bg-secondary rounded-md p-3">
              {resolution?.install.sdk ?? `await primegate.install("${pkg.name}")`}
            </div>
          </div>
          <div className="pg-fade-up rounded-md border bg-card p-4 space-y-2">
            <p className="text-xs font-medium text-accent uppercase tracking-wide">MCP</p>
            <div className="font-mono text-sm bg-secondary rounded-md p-3">
              {resolution?.install.mcp ?? `mcp://primegate.io/packages/${pkg.id}`}
            </div>
          </div>
          <div className="pg-fade-up rounded-md border bg-card p-4 space-y-2">
            <p className="text-xs font-medium text-accent uppercase tracking-wide">Web</p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="font-mono text-sm bg-secondary rounded-md p-3 flex-1 min-w-[220px]">
                {resolution?.install.web ?? `/package/${pkg.id}`}
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to={resolution?.install.web ?? `/package/${pkg.id}`}>Open Package</Link>
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
