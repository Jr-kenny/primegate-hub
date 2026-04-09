import { Link, useParams } from "react-router-dom";
import { Package, Shield } from "lucide-react";

import { usePrimeGatePublisherProfile } from "@/hooks/usePrimeGateCatalog";

export default function PublisherProfile() {
  const { id } = useParams();
  const { data: publisherProfile, isLoading } = usePrimeGatePublisherProfile(id);

  if (isLoading || !publisherProfile) {
    return (
      <div className="container py-8 max-w-4xl">
        <div className="rounded-md border p-6 text-sm text-muted-foreground">
          Loading publisher profile...
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6 max-w-4xl">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-lg bg-card border flex items-center justify-center text-accent font-bold text-lg">
          {publisherProfile.id.charAt(0).toUpperCase()}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{publisherProfile.id}</h1>
            {publisherProfile.verified && <Shield className="h-4 w-4 text-accent" />}
          </div>
          <p className="text-sm text-muted-foreground">
            {publisherProfile.verified ? "Verified publisher" : "Publisher"} · {publisherProfile.packageCount} packages
            {" · "}Member since {publisherProfile.memberSince}
          </p>
        </div>
      </div>

      <div className="rounded-md border p-4 text-sm text-muted-foreground">
        {publisherProfile.summary}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Published Packages</h2>
        <div className="space-y-1">
          {publisherProfile.packages.map((pkg) => (
            <Link
              key={pkg.id}
              to={`/package/${pkg.id}`}
              className="flex items-center justify-between p-3 rounded-md hover:bg-secondary/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-mono font-medium group-hover:text-accent transition-colors">{pkg.name}</p>
                  <p className="text-xs text-muted-foreground">{pkg.subtitle}</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{pkg.installs} installs</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
