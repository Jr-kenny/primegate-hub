import { Link } from "react-router-dom";
import { Search, Package } from "lucide-react";

export default function WorkspaceExplore() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Explore</h1>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          placeholder="Search installed packages, registry, capabilities…"
          className="w-full h-10 rounded-md border bg-secondary/30 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="space-y-1">
        {Array.from({ length: 4 }, (_, i) => (
          <Link
            key={i}
            to={`/package/pkg-${i}`}
            className="flex items-center gap-3 p-3 rounded-md hover:bg-secondary/50 transition-colors"
          >
            <Package className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-mono font-medium">@scope/recommended-{i + 1}</p>
              <p className="text-xs text-muted-foreground">Trending · Agent-ready</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
