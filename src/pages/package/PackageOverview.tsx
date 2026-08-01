import { Shield } from "lucide-react";

import { usePackageRouteData } from "@/hooks/usePackageRouteData";

export default function PackageOverview() {
  const { pkg } = usePackageRouteData();
  const stats = [
    { label: "License", value: pkg.license },
    { label: "Runtime", value: pkg.runtime },
    { label: "Chain", value: pkg.chain },
    { label: "Channel", value: pkg.releaseChannel ?? "latest" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-4 gap-4">
        {stats.map((item) => (
          <div key={item.label} className="rounded-md border p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.label}</p>
            <p className="text-sm font-medium">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-md border p-4 space-y-2">
        <h3 className="text-sm font-semibold">Description</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{pkg.description}</p>
      </div>
      {pkg.offer && (
        <div className="rounded-md border p-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Offer</h3>
            <span className="text-sm font-medium">
              {pkg.offer.price === "0" ? "Free" : `${pkg.offer.price} APT`}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{pkg.offer.description}</p>
          <p className="text-xs text-muted-foreground">
            {pkg.offer.license} · {pkg.offer.updatePolicy.replace("-", " ")} updates
          </p>
        </div>
      )}
      {pkg.keywords && pkg.keywords.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pkg.keywords.map((keyword) => (
            <span key={keyword} className="rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
              {keyword}
            </span>
          ))}
        </div>
      )}
      {pkg.readmeMarkdown && (
        <div className="rounded-md border p-4 space-y-2">
          <h3 className="text-sm font-semibold">README</h3>
          <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground leading-relaxed">
            {pkg.readmeMarkdown}
          </pre>
        </div>
      )}
      {pkg.releaseNotes && (
        <div className="rounded-md border p-4 space-y-2">
          <h3 className="text-sm font-semibold">Release Notes</h3>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">{pkg.releaseNotes}</p>
        </div>
      )}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Shield className="h-3.5 w-3.5 text-accent" />
        <span>Verified publisher Â· Audited Â· On-chain entitlements</span>
      </div>
    </div>
  );
}
