import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { usePrimeGateWallet } from "@/hooks/usePrimeGateWallet";

export default function WalletPage() {
  const {
    account,
    availableWallets,
    clearSession,
    connect,
    disconnect,
    ensurePrimeGateSession,
    hasSession,
    installableWallets,
    isConnected,
    lastSessionDebug,
    lastSessionError,
    isLoading,
    isRefreshingNetwork,
    isReconnectingWallet,
    isSwitchingNetwork,
    isVerifyingSession,
    isWrongNetwork,
    networkName,
    requiredNetworkName,
    session,
    shortAddress,
    supportsSiwa,
    switchToPrimeGateNetwork,
  } = usePrimeGateWallet();

  const sessionExpiresAt = session ? new Date(session.expiresAt).toLocaleString() : null;

  const handleClearSession = () => {
    clearSession();
    toast({
      title: "Session cleared",
      description: "The stored PrimeGate wallet session was removed from this browser.",
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Wallet</h1>

      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Connected Wallet</p>
          <p className="font-mono text-sm">{shortAddress ?? "No wallet connected"}</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-md border p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Network</p>
            <p className="text-lg font-bold">{networkName ?? "Unknown"}</p>
            {isWrongNetwork && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => void switchToPrimeGateNetwork()}
                loading={isSwitchingNetwork}
              >
                {isSwitchingNetwork ? "Switching network..." : `Switch to ${requiredNetworkName}`}
              </Button>
            )}
          </div>
          <div className="rounded-md border p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Wallet Status</p>
            <p className="text-lg font-bold">
              {isReconnectingWallet
                ? "Reconnecting"
                : isLoading
                  ? "Loading"
                  : isConnected
                    ? "Connected"
                    : "Disconnected"}
            </p>
            {isRefreshingNetwork && <p className="text-xs text-muted-foreground">Refreshing wallet network...</p>}
            {account?.ansName && <p className="text-xs text-muted-foreground">{account.ansName}</p>}
          </div>
          <div className="rounded-md border p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">PrimeGate Session</p>
            <p className="text-lg font-bold">{isVerifyingSession ? "Signing in" : hasSession ? "Verified" : "Not verified"}</p>
            <p className="text-xs text-muted-foreground">
              {sessionExpiresAt
                ? `Expires ${sessionExpiresAt}`
                : isConnected
                  ? supportsSiwa
                    ? "Click Sign In to approve the wallet sign-in request."
                    : "Click Sign In to approve the wallet message-sign request."
                  : "Connect your wallet to sign in to PrimeGate."}
            </p>
            {lastSessionError && !hasSession && (
              <p className="text-xs text-destructive">{lastSessionError}</p>
            )}
            {lastSessionDebug && !hasSession && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-[11px] font-mono text-destructive space-y-1">
                <p>path: {lastSessionDebug.path}</p>
                {typeof lastSessionDebug.status === "number" && <p>status: {lastSessionDebug.status}</p>}
                {lastSessionDebug.request && (
                  <pre className="whitespace-pre-wrap break-all">
                    request: {JSON.stringify(lastSessionDebug.request, null, 2)}
                  </pre>
                )}
                {lastSessionDebug.response && (
                  <pre className="whitespace-pre-wrap break-all">
                    response: {JSON.stringify(lastSessionDebug.response, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>

        {isConnected ? (
          <div className="flex flex-wrap gap-2">
            {!hasSession && (
              <Button type="button" loading={isVerifyingSession} onClick={() => void ensurePrimeGateSession()} disabled={isWrongNetwork}>
                {isVerifyingSession ? "Signing In..." : "Sign In"}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={handleClearSession} disabled={!session || isVerifyingSession}>
              Clear Session
            </Button>
            <Button type="button" variant="outline" onClick={() => void disconnect()} disabled={isVerifyingSession}>
              Disconnect Wallet
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Available wallets</p>
              <div className="flex flex-wrap gap-2">
                {availableWallets.length > 0 ? (
                  availableWallets.map((wallet) => (
                    <Button
                      key={wallet.name}
                      type="button"
                      variant="outline"
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
            </div>

            {installableWallets.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Installable wallets</p>
                <div className="flex flex-wrap gap-2">
                  {installableWallets.map((wallet) => (
                    <a
                      key={wallet.name}
                      href={wallet.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-secondary/50 transition-colors"
                    >
                      Install {wallet.name}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
