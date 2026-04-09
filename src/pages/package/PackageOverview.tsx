import { Shield } from "lucide-react";

import { usePackageRouteData } from "@/hooks/usePackageRouteData";

export default function PackageOverview() {
  const { pkg } = usePackageRouteData();
  const stats = [
    { label: "License", value: pkg.license },
    { label: "Runtime", value: pkg.runtime },
    { label: "Chain", value: pkg.chain },
  ];

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
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
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Shield className="h-3.5 w-3.5 text-accent" />
        <span>Verified publisher Â· Audited Â· On-chain entitlements</span>
      </div>
    </div>
  );
}
