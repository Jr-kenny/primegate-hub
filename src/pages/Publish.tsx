export default function Publish() {
  return (
    <div className="container py-8 space-y-6 max-w-3xl">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Publish to PrimeGate</h1>
        <p className="text-sm text-muted-foreground">
          Ship packages, prompts, datasets, and agent-ready assets to the registry.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold">Quick Start</h2>
        <div className="space-y-3">
          <div className="rounded-md bg-secondary p-3 font-mono text-sm">
            <span className="text-muted-foreground">$</span> primegate auth login
          </div>
          <div className="rounded-md bg-secondary p-3 font-mono text-sm">
            <span className="text-muted-foreground">$</span> primegate init
          </div>
          <div className="rounded-md bg-secondary p-3 font-mono text-sm">
            <span className="text-muted-foreground">$</span> primegate publish
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Connect your wallet to manage entitlements and receive payments for paid assets.
        </p>
      </div>
    </div>
  );
}
