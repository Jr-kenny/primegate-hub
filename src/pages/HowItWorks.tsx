import { Check } from "lucide-react";

const sections = [
  {
    title: "PrimeGate is the registry",
    desc: "PrimeGate handles package listings, discovery, publisher identity, and access surfaces for humans and agents.",
    points: ["Registry metadata", "Package discovery", "Publisher profiles", "Wallet-native access"],
  },
  {
    title: "Shelby stores the artifacts",
    desc: "Shelby is the underlying blob and storage layer used to hold package bytes and downloadable artifacts.",
    points: ["Artifact storage", "Blob retrieval", "Data durability", "Storage-layer security"],
  },
  {
    title: "Install from anywhere",
    desc: "Users can discover on the web and then install or access packages through local and agent-native flows.",
    points: ["Web discovery", "CLI installs", "SDK access", "MCP and agent usage"],
  },
];

export default function HowItWorks() {
  return (
    <div className="container py-8 space-y-8 max-w-4xl">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold">How It Works</h1>
        <p className="text-sm text-muted-foreground">
          PrimeGate is the registry and access layer. Shelby is the storage layer underneath it.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {sections.map((section) => (
          <div key={section.title} className="rounded-lg border p-5 space-y-4">
            <div className="space-y-1">
              <h3 className="font-semibold">{section.title}</h3>
              <p className="text-xs text-muted-foreground">{section.desc}</p>
            </div>
            <ul className="space-y-2">
              {section.points.map((point) => (
                <li key={point} className="flex items-center gap-2 text-sm">
                  <Check className="h-3.5 w-3.5 text-accent shrink-0" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
