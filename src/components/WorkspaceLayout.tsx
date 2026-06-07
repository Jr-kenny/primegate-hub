import { Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { usePrimeGateWallet } from "@/hooks/usePrimeGateWallet";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

export function WorkspaceLayout() {
  const { availableWallets, connect, installableWallets, isConnected, isLoading, isReconnectingWallet } =
    usePrimeGateWallet();

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-background px-6 py-16">
        <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-2xl items-center justify-center">
          <div className="pg-fade-up w-full rounded-3xl border border-border/70 bg-card/70 p-8 text-center shadow-sm backdrop-blur">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">Workspace</p>
            <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight">Connect Wallet</h1>
            {isReconnectingWallet ? (
              <div className="mt-4 flex items-center justify-center">
                <Spinner className="h-5 w-5" />
                <span className="sr-only">Reconnecting wallet</span>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Connect an Aptos wallet to enter your PrimeGate workspace.
              </p>
            )}

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {isReconnectingWallet ? (
                <div className="flex items-center justify-center">
                  <Spinner className="h-4 w-4" />
                  <span className="sr-only">Reconnecting wallet</span>
                </div>
              ) : availableWallets.length > 0 ? (
                availableWallets.map((wallet) => (
                  <Button
                    key={wallet.name}
                    type="button"
                    size="lg"
                    onClick={() => void connect(wallet.name)}
                    loading={isLoading}
                  >
                    {wallet.name}
                  </Button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No compatible Aptos wallet detected yet.</p>
              )}
            </div>

            {availableWallets.length === 0 && installableWallets.length > 0 && (
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {installableWallets.map((wallet) => (
                  <a
                    key={wallet.name}
                    href={wallet.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center rounded-md border border-border px-4 text-sm font-medium transition-colors hover:bg-secondary/50"
                  >
                    Install {wallet.name}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex w-full">
      <WorkspaceSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
