import { Link, useLocation } from "react-router-dom";
import { Search, Wallet, Menu, X } from "lucide-react";
import { useState } from "react";

const navItems = [
  { label: "Discover", path: "/discover" },
  { label: "Categories", path: "/categories" },
  { label: "Publish", path: "/publish" },
  { label: "Docs", path: "/docs" },
  { label: "Pricing", path: "/pricing" },
];

export function PublicNav() {
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 font-semibold text-lg tracking-tight shrink-0">
          <span className="text-accent">⌘</span> PrimeGate
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                location.pathname.startsWith(item.path)
                  ? "bg-secondary text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {searchOpen ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                placeholder="Search packages, publishers, capabilities…"
                className="h-8 w-64 rounded-md border bg-secondary/50 px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
                onBlur={() => setSearchOpen(false)}
              />
              <button onClick={() => setSearchOpen(false)} className="text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 h-8 rounded-md border bg-secondary/30 px-3 text-sm text-muted-foreground hover:bg-secondary/50 transition-colors"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Search registry…</span>
              <kbd className="hidden lg:inline-flex h-5 items-center rounded border bg-muted px-1.5 text-[10px] font-mono text-muted-foreground">⌘K</kbd>
            </button>
          )}

          <Link
            to="/workspace"
            className="hidden sm:flex items-center gap-2 h-8 rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground hover:bg-accent/90 transition-colors"
          >
            <Wallet className="h-3.5 w-3.5" />
            Connect Wallet
          </Link>

          <button className="md:hidden text-muted-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t bg-background p-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 text-sm rounded-md hover:bg-secondary"
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/workspace"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md bg-accent text-accent-foreground"
          >
            <Wallet className="h-3.5 w-3.5" />
            Connect Wallet
          </Link>
        </div>
      )}
    </header>
  );
}
