export default function WorkspaceSettings() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <div className="space-y-4 max-w-lg">
        {[
          { title: "Profile", description: "Manage your publisher profile and workspace identity." },
          { title: "API Keys", description: "Control local SDK, CLI, and integration credentials." },
          { title: "Notifications", description: "Choose how PrimeGate alerts you about publishes and installs." },
          { title: "Install Preferences", description: "Set local install behavior and registry access defaults." },
        ].map((section) => (
          <div
            key={section.title}
            className="rounded-md border p-4 hover:bg-secondary/30 transition-colors cursor-pointer"
          >
            <p className="text-sm font-medium">{section.title}</p>
            <p className="text-xs text-muted-foreground">{section.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
