export default function WorkspaceSettings() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="space-y-4 max-w-lg">
        {["Profile", "API Keys", "Notifications", "Billing"].map((section) => (
          <div key={section} className="rounded-md border p-4 hover:bg-secondary/30 transition-colors cursor-pointer">
            <p className="text-sm font-medium">{section}</p>
            <p className="text-xs text-muted-foreground">Configure your {section.toLowerCase()} settings.</p>
          </div>
        ))}
      </div>
    </div>
  );
}
