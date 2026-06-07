import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { usePrimeGateRegistry } from "@/hooks/usePrimeGateRegistry";

export default function Installed() {
  const { installs, walletAddress } = usePrimeGateRegistry();

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Installed</h1>
      <p className="text-sm text-muted-foreground">
        Packages saved in your PrimeGate workspace. Web installs download to your browser device, while CLI installs
        save files locally on disk.
      </p>
      {walletAddress && installs.length > 0 ? (
        <div className="space-y-3">
          {installs.map((install) => (
            <div key={`${install.walletAddress}:${install.packageId}`} className="rounded-md border p-4">
              <p className="text-sm font-mono font-medium">{install.packageName}</p>
              <p className="text-xs text-muted-foreground">v{install.version}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Installed {new Date(install.installedAt).toLocaleString()}
              </p>
              <div className="mt-3">
                <Button asChild size="sm" variant="outline">
                  <Link to={`/package/${install.packageId}`}>Open Package</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
          {walletAddress
            ? "No packages installed yet. Browse the registry to get started."
            : "Connect your wallet to view installed packages."}
        </div>
      )}
    </div>
  );
}
