import { useParams, Link } from "react-router-dom";
import { ExternalLink, Shield, Package } from "lucide-react";

export default function PublisherProfile() {
  const { id } = useParams();

  return (
    <div className="container py-8 space-y-6 max-w-4xl">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-lg bg-card border flex items-center justify-center text-accent font-bold text-lg">
          {id?.charAt(0).toUpperCase()}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{id}</h1>
            <Shield className="h-4 w-4 text-accent" />
          </div>
          <p className="text-sm text-muted-foreground">Verified publisher · 24 packages · Member since 2024</p>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Published Packages</h2>
        <div className="space-y-1">
          {Array.from({ length: 5 }, (_, i) => (
            <Link
              key={i}
              to={`/package/pkg-${i}`}
              className="flex items-center justify-between p-3 rounded-md hover:bg-secondary/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-mono font-medium group-hover:text-accent transition-colors">@{id}/package-{i + 1}</p>
                  <p className="text-xs text-muted-foreground">Tool · v1.{i}.0</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{(i * 3200 + 1000).toLocaleString()} installs</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
