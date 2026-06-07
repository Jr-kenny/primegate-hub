import { Link, useLocation } from "react-router-dom";
import { Search, Wallet, Menu, Copy, LogOut, LayoutGrid } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { usePrimeGateWallet } from "@/hooks/usePrimeGateWallet";

const navItems = [
  { label: "Discover", path: "/discover" },
  { label: "Search", path: "/search" },
  { label: "Categories", path: "/categories" },
  { label: "Docs", path: "/docs" },
  { label: "How It Works", path: "/how-it-works" },
];

export function PublicNav() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { address, availableWallets, connect, disconnect, isConnected, isReconnectingWallet, shortAddress } =
    usePrimeGateWallet();
  const walletLabel = isConnected
    ? shortAddress ?? "Wallet"
    : isReconnectingWallet
      ? "Reconnecting..."
      : "Connect Wallet";

  const handleWalletClick = async () => {
    if (isConnected || isReconnectingWallet || availableWallets.length === 0) {
      return;
    }

    await connect(availableWallets[0].name);
  };

  const handleCopyWallet = async () => {
    if (!address) {
      return;
    }

    await navigator.clipboard.writeText(address);
    toast({
      title: "Wallet copied",
      description: "The connected wallet address was copied.",
    });
  };

  const handleDisconnect = async () => {
    await disconnect();
    toast({
      title: "Wallet disconnected",
      description: "The connected wallet was removed from this browser session.",
    });
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between gap-4">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 font-serif text-xl font-semibold tracking-tight"
        >
          <span className="text-primary">◈</span> PrimeGate
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
          <ThemeToggle />
          <Link
            to="/search"
            className="hidden sm:flex items-center gap-2 h-8 rounded-md border bg-secondary/30 px-3 text-sm text-muted-foreground hover:bg-secondary/50 transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Search registry...</span>
          </Link>

          {isConnected ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="hidden sm:flex">
                  <Wallet className="h-3.5 w-3.5" />
                  {walletLabel}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>{walletLabel}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void handleCopyWallet()}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Wallet
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/workspace">
                    <LayoutGrid className="mr-2 h-4 w-4" />
                    Workspace
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleDisconnect()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              type="button"
              onClick={() => void handleWalletClick()}
              loading={isReconnectingWallet}
              size="sm"
              className="hidden sm:flex"
            >
              <Wallet className="h-3.5 w-3.5" />
              {walletLabel}
            </Button>
          )}

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
          {isConnected ? (
            <div className="space-y-1 rounded-md bg-secondary/30 p-2">
              <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium">
                <Wallet className="h-3.5 w-3.5" />
                {walletLabel}
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  void handleCopyWallet();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-secondary text-left"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy Wallet
              </button>
              <Link
                to="/workspace"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-secondary"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Workspace
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  void handleDisconnect();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-secondary text-left"
              >
                <LogOut className="h-3.5 w-3.5" />
                Disconnect
              </button>
            </div>
          ) : (
            <Button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                void handleWalletClick();
              }}
              loading={isReconnectingWallet}
              className="flex w-full"
            >
              <Wallet className="h-3.5 w-3.5" />
              {walletLabel}
            </Button>
          )}
        </div>
      )}
    </header>
  );
}
