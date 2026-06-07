import { Check } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";

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
      <PageHeader
        eyebrow="HOW IT WORKS"
        title="How It Works"
        subtitle="PrimeGate is the registry and access layer. Shelby is the storage layer underneath it."
      />

      <div className="grid md:grid-cols-3 gap-4">
        {sections.map((section) => (
          <div
            key={section.title}
            className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="space-y-1">
              <h3 className="font-serif text-lg font-semibold">{section.title}</h3>
              <p className="text-xs text-muted-foreground">{section.desc}</p>
            </div>
            <ul className="space-y-2">
              {section.points.map((point) => (
                <li key={point} className="flex items-center gap-2 text-sm">
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
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
