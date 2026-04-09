import { Link } from "react-router-dom";
import { Shield } from "lucide-react";

import { usePackageRouteData } from "@/hooks/usePackageRouteData";

export default function PackagePublisher() {
  const { pkg } = usePackageRouteData();

  return (
    <div className="rounded-md border p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-lg border bg-card flex items-center justify-center font-semibold text-accent">
          {pkg.publisher.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{pkg.publisher}</p>
            <Shield className="h-4 w-4 text-accent" />
          </div>
          <p className="text-xs text-muted-foreground">Verified publisher · {pkg.publisherPackageCount} packages</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{pkg.publisherSummary}</p>
      <Link to={`/publisher/${pkg.publisher}`} className="text-sm font-medium text-accent hover:underline">
        View publisher profile
      </Link>
    </div>
  );
}
