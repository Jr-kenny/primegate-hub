export default function WalletPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Wallet</h1>
      <div className="rounded-lg border bg-card p-5 space-y-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Connected Wallet</p>
        <p className="font-mono text-sm">0x1a2b3c4d…e5f6g7h8</p>
        <div className="grid sm:grid-cols-2 gap-3 pt-2">
          <div className="rounded-md border p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</p>
            <p className="text-lg font-bold">$0.00</p>
          </div>
          <div className="rounded-md border p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Entitlements</p>
            <p className="text-lg font-bold">0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
