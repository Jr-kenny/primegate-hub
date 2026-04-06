import { Link } from "react-router-dom";
import { ArrowRight, Terminal, Package, Zap, Globe } from "lucide-react";

export default function Landing() {
  return (
    <div className="container max-w-4xl py-20 space-y-16">
      <section className="space-y-6">
        <p className="text-sm font-medium text-accent tracking-wide uppercase">Universal Registry</p>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
          The registry for packages, prompts, datasets, and agent-ready assets.
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
          PrimeGate is a wallet-native registry and commerce layer. Discover, install, publish, and transact across
          CLI, SDK, MCP, and web — from one canonical source.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            to="/discover"
            className="inline-flex items-center gap-2 h-10 rounded-md bg-accent px-5 text-sm font-medium text-accent-foreground hover:bg-accent/90 transition-colors"
          >
            Browse Registry <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/docs"
            className="inline-flex items-center gap-2 h-10 rounded-md border px-5 text-sm font-medium hover:bg-secondary transition-colors"
          >
            <Terminal className="h-4 w-4" /> Read the Docs
          </Link>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-6">
        {[
          {
            icon: Package,
            title: "Packages & Artifacts",
            desc: "Tools, prompts, datasets, workflows, and agent components — versioned, entitlement-gated, and installable."
          },
          {
            icon: Zap,
            title: "Agent-Native",
            desc: "Every asset is addressable by agents via MCP, CLI, and SDK. The browser is one surface, not the only one."
          },
          {
            icon: Globe,
            title: "Wallet-Native Commerce",
            desc: "Connect your wallet. Purchase, license, and entitle assets with on-chain settlement. No accounts required."
          },
        ].map((item) => (
          <div key={item.title} className="rounded-lg border bg-card p-5 space-y-3">
            <item.icon className="h-5 w-5 text-accent" />
            <h3 className="font-semibold text-sm">{item.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border bg-card p-6 space-y-3">
        <p className="text-xs font-medium text-accent uppercase tracking-wide">Quick Install</p>
        <div className="font-mono text-sm bg-secondary rounded-md p-4 text-foreground">
          <span className="text-muted-foreground">$</span> primegate install @scope/package-name
        </div>
        <p className="text-xs text-muted-foreground">Works with npm, pip, cargo, and MCP-compatible agent runtimes.</p>
      </section>
    </div>
  );
}
