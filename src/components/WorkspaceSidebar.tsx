import { Link, useLocation } from "react-router-dom";
import {
  Compass,
  Download,
  ShoppingBag,
  Upload,
  Wallet,
  Package,
  GitBranch,
  DollarSign,
  ChevronLeft,
  Rocket,
} from "lucide-react";
import { useState } from "react";

import { usePrimeGateWallet } from "@/hooks/usePrimeGateWallet";

const mainItems = [
  { label: "Explore", path: "/workspace", icon: Compass, end: true },
  { label: "Installed", path: "/workspace/installed", icon: Download },
  { label: "Purchases", path: "/workspace/purchases", icon: ShoppingBag },
  { label: "Publish", path: "/workspace/publish", icon: Rocket },
  { label: "Publishing", path: "/workspace/publishing", icon: Upload },
  { label: "Wallet", path: "/workspace/wallet", icon: Wallet },
];

const publisherItems = [
  { label: "Packages", path: "/workspace/publishing/packages", icon: Package },
  { label: "Releases", path: "/workspace/publishing/releases", icon: GitBranch },
  { label: "Sales", path: "/workspace/publishing/sales", icon: DollarSign },
];

export function WorkspaceSidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { isConnected, shortAddress } = usePrimeGateWallet();

  const isActive = (path: string, end?: boolean) => {
    if (end) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const isPublishingOpen = location.pathname.startsWith("/workspace/publishing");

  return (
    <aside
      className={`shrink-0 border-r bg-sidebar text-sidebar-foreground transition-all duration-200 ${
        collapsed ? "w-14" : "w-56"
      } flex flex-col`}
    >
      <div className="flex items-center justify-between h-14 px-3 border-b border-sidebar-border">
        {!collapsed && (
          <Link to="/" className="flex items-center gap-2 font-semibold text-sm">
            <span className="text-sidebar-primary">âŒ˜</span> PrimeGate
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-sidebar-muted hover:text-sidebar-foreground p-1"
        >
          <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {mainItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-2.5 py-2 rounded-md text-sm transition-colors ${
              isActive(item.path, item.end)
                ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            }`}
          >
            {isActive(item.path, item.end) && (
              <span className="absolute left-0 w-1 h-5 rounded-r bg-nav-highlight" />
            )}
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}

        {isPublishingOpen && !collapsed && (
          <div className="pt-2 pl-4 space-y-1">
            <p className="px-2.5 text-[10px] uppercase tracking-wider text-sidebar-primary font-semibold mb-1">
              Publisher
            </p>
            {publisherItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                  isActive(item.path)
                    ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                    : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        )}
      </nav>

      {!collapsed && (
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2 text-xs text-sidebar-muted">
            <div className="h-6 w-6 rounded-full bg-sidebar-accent flex items-center justify-center text-[10px] font-medium text-sidebar-foreground">
              {isConnected ? "0x" : "--"}
            </div>
            <span className="truncate">{shortAddress ?? "No wallet connected"}</span>
          </div>
        </div>
      )}
    </aside>
  );
}
