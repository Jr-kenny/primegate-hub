import { Book, Terminal, Code, Plug } from "lucide-react";

const sections = [
  { icon: Book, title: "Getting Started", desc: "Install the CLI, connect your wallet, and publish your first asset." },
  { icon: Terminal, title: "CLI Reference", desc: "Complete command reference for primegate CLI." },
  { icon: Code, title: "SDK Integration", desc: "Use PrimeGate from Node.js, Python, Rust, and Go." },
  { icon: Plug, title: "MCP Protocol", desc: "Agent-native access via MCP endpoints and capabilities." },
];

export default function Docs() {
  return (
    <div className="container py-8 space-y-6 max-w-3xl">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Documentation</h1>
        <p className="text-sm text-muted-foreground">Integrate PrimeGate from any surface — web, CLI, SDK, or MCP.</p>
      </div>

      <div className="space-y-3">
        {sections.map((s) => (
          <div key={s.title} className="flex items-start gap-4 p-4 rounded-lg border hover:bg-secondary/30 transition-colors cursor-pointer">
            <s.icon className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
