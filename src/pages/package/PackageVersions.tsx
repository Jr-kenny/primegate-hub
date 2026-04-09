import { usePackageRouteData } from "@/hooks/usePackageRouteData";

import { Link } from "react-router-dom";

export default function PackageVersions() {
  const { pkg } = usePackageRouteData();

  return (
    <div className="space-y-3">
      {pkg.versions.map((item) => (
        <div key={item.version} className="rounded-md border px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">v{item.version}</p>
                {item.id && item.id !== pkg.id && (
                  <Link to={`/package/${item.id}`} className="text-xs text-accent hover:underline">
                    Open Release
                  </Link>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{item.notes}</p>
              {item.publishedAt && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Published {new Date(item.publishedAt).toLocaleString()}
                </p>
              )}
            </div>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              {item.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
