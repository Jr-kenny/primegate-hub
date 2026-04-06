export default function Installed() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Installed</h1>
      <p className="text-sm text-muted-foreground">Packages and assets installed in your environment.</p>
      <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
        No packages installed yet. Browse the registry to get started.
      </div>
    </div>
  );
}
