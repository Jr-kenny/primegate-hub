import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, SlidersHorizontal } from "lucide-react";

const tabs = ["Featured", "New", "Trending", "Agent-ready", "Human Tools", "Free", "Paid"];
const filters = ["Type", "Runtime", "Chain", "Install Method", "Price", "Publisher", "Verified"];

const mockPackages = Array.from({ length: 8 }, (_, i) => ({
  id: `pkg-${i}`,
  name: `@scope/package-${i + 1}`,
  description: "A composable utility for agent workflows and data pipelines.",
  publisher: `publisher-${(i % 3) + 1}`,
  type: ["tool", "prompt", "dataset", "workflow"][i % 4],
  installs: Math.floor(Math.random() * 50000),
  price: i % 3 === 0 ? "Free" : `$${(i * 5 + 10).toFixed(0)}`,
  verified: i % 2 === 0,
  agentReady: i % 3 !== 2,
}));

export default function Discover() {
  const [activeTab, setActiveTab] = useState("Featured");
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="container py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Discover</h1>
        <p className="text-sm text-muted-foreground">Browse packages, prompts, datasets, tools, and agent-ready assets.</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search packages, publishers, capabilities…"
            className="w-full h-10 rounded-md border bg-secondary/30 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 h-10 rounded-md border px-4 text-sm hover:bg-secondary transition-colors"
        >
          <SlidersHorizontal className="h-4 w-4" /> Filters
        </button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-2 p-4 rounded-md border bg-card">
          {filters.map((f) => (
            <button
              key={f}
              className="h-7 rounded-md border px-3 text-xs hover:bg-secondary transition-colors"
            >
              {f}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab
                ? "border-accent text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        {mockPackages.map((pkg) => (
          <Link
            key={pkg.id}
            to={`/package/${pkg.id}`}
            className="flex items-center justify-between p-4 rounded-md hover:bg-secondary/50 transition-colors group"
          >
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium group-hover:text-accent transition-colors">{pkg.name}</span>
                {pkg.verified && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">Verified</span>
                )}
                {pkg.agentReady && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">Agent-ready</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{pkg.description}</p>
            </div>
            <div className="flex items-center gap-6 shrink-0 text-xs text-muted-foreground">
              <span className="hidden sm:inline">{pkg.type}</span>
              <span className="hidden sm:inline">{pkg.installs.toLocaleString()} installs</span>
              <span className="font-medium text-foreground">{pkg.price}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
