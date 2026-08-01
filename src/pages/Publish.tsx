import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { usePrimeGateRegistry } from "@/hooks/usePrimeGateRegistry";
import { usePrimeGateWallet } from "@/hooks/usePrimeGateWallet";
import { useShelbyPublish } from "@/hooks/useShelbyPublish";
import { normalizeAptAmount } from "@/lib/aptos-amount";
import { formatPrimeGateBytes } from "@/lib/publisher-billing";
import {
  normalizePrimeGatePackageSlug,
  normalizePrimeGateReleaseVersion,
  PRIMEGATE_RELEASE_CHANNELS,
} from "@/lib/primegate-package";

type PricingMode = "free" | "paid";

function sanitizeAptInput(value: string) {
  const normalized = value.replace(/,/g, ".");
  let sawDecimalPoint = false;

  return Array.from(normalized)
    .filter((character) => {
      if (/\d/.test(character)) {
        return true;
      }

      if (character === "." && !sawDecimalPoint) {
        sawDecimalPoint = true;
        return true;
      }

      return false;
    })
    .join("");
}

export default function Publish() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [packageSlug, setPackageSlug] = useState("");
  const [packageSlugDirty, setPackageSlugDirty] = useState(false);
  const [releaseVersion, setReleaseVersion] = useState("1.0.0");
  const [description, setDescription] = useState("");
  const [license, setLicense] = useState("Custom");
  const [keywords, setKeywords] = useState("");
  const [readmeMarkdown, setReadmeMarkdown] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [releaseChannel, setReleaseChannel] = useState("latest");
  const [pricingMode, setPricingMode] = useState<PricingMode>("free");
  const [price, setPrice] = useState("0");
  const [file, setFile] = useState<File | null>(null);
  const [connectingWalletName, setConnectingWalletName] = useState<string | null>(null);

  const {
    availableWallets,
    connect,
    isConnected,
    isReconnectingWallet,
    isRefreshingNetwork,
    isSwitchingNetwork,
    isWrongNetwork,
    requiredNetworkName,
    shortAddress,
    switchToPrimeGateNetwork,
  } = usePrimeGateWallet();
  const { publishedAssets, publisherBilling } = usePrimeGateRegistry();
  const { error, isPublishing, publishAsset } = useShelbyPublish();

  useEffect(() => {
    if (packageSlugDirty) {
      return;
    }

    try {
      setPackageSlug(normalizePrimeGatePackageSlug(title));
    } catch {
      setPackageSlug("");
    }
  }, [packageSlugDirty, title]);

  useEffect(() => {
    if (pricingMode === "free") {
      setPrice("0");
      return;
    }

    if (price === "0") {
      setPrice("");
    }
  }, [price, pricingMode]);

  const normalizedSlug = useMemo(() => {
    try {
      return normalizePrimeGatePackageSlug(packageSlug);
    } catch {
      return null;
    }
  }, [packageSlug]);

  const normalizedVersion = useMemo(() => {
    try {
      return normalizePrimeGateReleaseVersion(releaseVersion);
    } catch {
      return null;
    }
  }, [releaseVersion]);

  const duplicateRelease = useMemo(() => {
    if (!normalizedSlug || !normalizedVersion) {
      return null;
    }

    return (
      publishedAssets.find((asset) => asset.packageSlug === normalizedSlug && asset.version === normalizedVersion) ??
      null
    );
  }, [normalizedSlug, normalizedVersion, publishedAssets]);

  const handleConnectWallet = async (walletName: string) => {
    setConnectingWalletName(walletName);
    try {
      await connect(walletName);
    } finally {
      setConnectingWalletName(null);
    }
  };

  const handlePublish = async () => {
    if (!file) {
      toast({
        title: "File required",
        description: "Choose the file you want to publish to PrimeGate.",
        variant: "destructive",
      });
      return;
    }

    if (duplicateRelease) {
      toast({
        title: "Release already exists",
        description: "This package slug and version already exist. Bump the version or change the slug.",
        variant: "destructive",
      });
      return;
    }

    let normalizedPriceApt = "0";

    if (pricingMode === "paid") {
      try {
        normalizedPriceApt = normalizeAptAmount(price);
      } catch (priceError) {
        toast({
          title: "Invalid price",
          description:
            priceError instanceof Error
              ? priceError.message
              : "Enter a valid APT amount before publishing.",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      const result = await publishAsset({
        description,
        file,
        keywords: keywords
          .split(",")
          .map((keyword) => keyword.trim())
          .filter(Boolean),
        license,
        packageSlug,
        priceApt: normalizedPriceApt,
        readmeMarkdown,
        releaseChannel,
        releaseNotes,
        releaseVersion,
        title,
      });

      setTitle("");
      setPackageSlug("");
      setPackageSlugDirty(false);
      setReleaseVersion("1.0.0");
      setDescription("");
      setLicense("Custom");
      setKeywords("");
      setReadmeMarkdown("");
      setReleaseNotes("");
      setReleaseChannel("latest");
      setPricingMode("free");
      setPrice("0");
      setFile(null);
      toast({
        title: "Published to PrimeGate",
        description: `${result.originalFileName} was uploaded to Shelby and registered in PrimeGate successfully.`,
      });
      void navigate(`/package/${result.id}`);
    } catch (publishError) {
      toast({
        title: "Publish failed",
        description:
          publishError instanceof Error ? publishError.message : "PrimeGate publish failed.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container py-8 space-y-6 max-w-3xl">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Publish to PrimeGate</h1>
        <p className="text-sm text-muted-foreground">
          Publish packages, prompts, datasets, images, archives, text files, and agent-ready assets to the registry.
        </p>
        <p className="text-xs text-muted-foreground">
          For folders, starter kits, or Git repositories, bundle the contents as a `.zip` before uploading.
        </p>
      </div>

      <div className="pg-fade-up rounded-lg border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold">Quick Start</h2>
        <div className="space-y-3">
          <div className="rounded-md bg-secondary p-3 font-mono text-sm">
            <span className="text-muted-foreground">$</span> primegate auth login
          </div>
          <div className="rounded-md bg-secondary p-3 font-mono text-sm">
            <span className="text-muted-foreground">$</span> primegate init
          </div>
          <div className="rounded-md bg-secondary p-3 font-mono text-sm">
            <span className="text-muted-foreground">$</span> primegate publish
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Connect your wallet to publish, receive paid sales, and manage release history.
        </p>
      </div>

      <div className="pg-fade-up rounded-lg border bg-card p-5 space-y-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Browser Publish</h2>
          <p className="text-xs text-muted-foreground">
            {isConnected
              ? `Connected as ${shortAddress}`
              : isReconnectingWallet
                ? "Reconnecting your previously connected wallet..."
                : "Connect an Aptos wallet to publish through Shelby."}
          </p>
          <p className="text-xs text-muted-foreground">
            Shelby uploads require Aptos Testnet and ShelbyUSD in the connected wallet.
          </p>
        </div>

        {publisherBilling && (
          <div className="rounded-md bg-secondary/60 p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{publisherBilling.plan.name} plan</span>
              <span className="text-muted-foreground">
                {formatPrimeGateBytes(publisherBilling.publish.remainingBytes)} publish bytes available
              </span>
            </div>
            {publisherBilling.credits.availableBytes > 0 && (
              <p className="mt-1 text-muted-foreground">
                {formatPrimeGateBytes(publisherBilling.credits.availableBytes)} in publisher credits available.
              </p>
            )}
          </div>
        )}

        {!isConnected && !isReconnectingWallet && availableWallets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {availableWallets.map((wallet) => (
              <Button
                key={wallet.name}
                type="button"
                variant="outline"
                loading={connectingWalletName === wallet.name}
                onClick={() => void handleConnectWallet(wallet.name)}
              >
                Connect {wallet.name}
              </Button>
            ))}
          </div>
        )}

        {isReconnectingWallet && (
          <div className="rounded-md border p-3 text-sm text-muted-foreground">
            PrimeGate is waiting for the Aptos wallet adapter to restore your connection.
          </div>
        )}

        {isConnected && isRefreshingNetwork && (
          <div className="rounded-md border p-3 text-sm text-muted-foreground">
            Refreshing the connected wallet network before publishing...
          </div>
        )}

        {isConnected && isWrongNetwork && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm font-medium text-destructive">Wrong network</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Switch your wallet to {requiredNetworkName} before publishing to Shelby.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-3"
              onClick={() => void switchToPrimeGateNetwork()}
              loading={isSwitchingNetwork}
            >
              {isSwitchingNetwork ? "Switching network..." : `Switch to ${requiredNetworkName}`}
            </Button>
          </div>
        )}

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="publish-title">Package Name</Label>
            <Input
              id="publish-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="PrimeGate OCR Dataset"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="publish-package-slug">Package Slug</Label>
              <Input
                id="publish-package-slug"
                value={packageSlug}
                onChange={(event) => {
                  setPackageSlugDirty(true);
                  setPackageSlug(event.target.value);
                }}
                placeholder="primegate-ocr-dataset"
              />
              <p className="text-xs text-muted-foreground">
                Reuse this slug for later updates to the same package family.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="publish-release-version">Release Version</Label>
              <Input
                id="publish-release-version"
                value={releaseVersion}
                onChange={(event) => setReleaseVersion(event.target.value)}
                placeholder="1.0.0"
              />
              <p className="text-xs text-muted-foreground">
                Reusing the slug with a new version creates a new release.
              </p>
            </div>
          </div>

          {duplicateRelease && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              This publisher already has `{duplicateRelease.packageSlug}` version `{duplicateRelease.version}`. Bump the
              version or choose a different slug.
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="publish-description">Description</Label>
            <Textarea
              id="publish-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
              placeholder="What this package contains, who it is for, and how it should be used."
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="publish-license">License</Label>
              <Input
                id="publish-license"
                value={license}
                onChange={(event) => setLicense(event.target.value)}
                placeholder="MIT, Apache-2.0, or Custom"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="publish-keywords">Keywords</Label>
              <Input
                id="publish-keywords"
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                placeholder="ai, dataset, agents"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Release Channel</Label>
              <Select value={releaseChannel} onValueChange={setReleaseChannel}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a channel" />
                </SelectTrigger>
                <SelectContent>
                  {PRIMEGATE_RELEASE_CHANNELS.map((channel) => (
                    <SelectItem key={channel} value={channel}>
                      {channel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="publish-release-notes">Release Notes</Label>
              <Textarea
                id="publish-release-notes"
                value={releaseNotes}
                onChange={(event) => setReleaseNotes(event.target.value)}
                rows={3}
                placeholder="What changed in this release?"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="publish-readme">README</Label>
            <Textarea
              id="publish-readme"
              value={readmeMarkdown}
              onChange={(event) => setReadmeMarkdown(event.target.value)}
              rows={6}
              placeholder="# Package name\n\nInstallation and usage notes."
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Access</Label>
              <Select value={pricingMode} onValueChange={(value: PricingMode) => setPricingMode(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose access" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
              {pricingMode === "paid" && (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="publish-price">Price (APT)</Label>
                  <Input
                    id="publish-price"
                    inputMode="decimal"
                    value={price}
                    onChange={(event) => setPrice(sanitizeAptInput(event.target.value))}
                    placeholder="0.25"
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Free packages install immediately. Paid packages unlock after a confirmed APT payment.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="publish-file">Upload Package File</Label>
              <Input
                id="publish-file"
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                TXT, images, ZIPs, datasets, prompt files, and other package files are all valid. Use ZIP for folders,
                repos, or multi-file bundles.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => void handlePublish()}
              loading={isPublishing}
              disabled={
                !isConnected ||
                isReconnectingWallet ||
                isRefreshingNetwork ||
                isWrongNetwork ||
                !title ||
                !packageSlug ||
                !releaseVersion ||
                !description ||
                (pricingMode === "paid" && !price) ||
                !file ||
                Boolean(duplicateRelease) ||
                isPublishing
              }
            >
              {isPublishing ? "Publishing to PrimeGate..." : "Publish Package"}
            </Button>
            {file && <p className="text-xs text-muted-foreground">{file.name}</p>}
          </div>

          {error && (
            <div className="rounded-md border p-3 text-sm">
              <p className="text-destructive">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
