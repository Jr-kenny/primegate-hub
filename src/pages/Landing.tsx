import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Terminal, Package, Zap, Globe } from "lucide-react";

const features = [
  {
    icon: Package,
    title: "Packages & Artifacts",
    desc: "Tools, prompts, datasets, workflows, and agent components — versioned, entitlement-gated, and installable.",
  },
  {
    icon: Zap,
    title: "Agent-Native",
    desc: "Every asset is addressable by agents via MCP, CLI, and SDK. The browser is one surface, not the only one.",
  },
  {
    icon: Globe,
    title: "Wallet-Native Commerce",
    desc: "Connect your wallet. Purchase, license, and entitle assets with on-chain settlement. No accounts required.",
  },
];

export default function Landing() {
  return (
    <div className="container max-w-5xl space-y-20 py-20">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="space-y-6"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          The registry for agent-ready packages
        </p>
        <h1 className="max-w-3xl font-serif text-4xl font-semibold leading-[1.08] tracking-tight md:text-6xl">
          Discover, install, and trust every package.
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
          PrimeGate is a wallet-native registry and commerce layer. Discover, install, publish, and transact
          across CLI, SDK, MCP, and web — from one canonical source.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            to="/discover"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Browse Registry <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/docs"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-border px-6 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            <Terminal className="h-4 w-4" /> Read the Docs
          </Link>
        </div>
      </motion.section>

      <section className="grid gap-5 md:grid-cols-3">
        {features.map((item) => (
          <div
            key={item.title}
            className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-primary/40"
          >
            <item.icon className="h-5 w-5 text-primary" />
            <h3 className="font-serif text-lg font-semibold">{item.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Quick Install</p>
        <div className="rounded-lg bg-secondary p-4 font-mono text-sm text-foreground">
          <span className="text-muted-foreground">$</span> primegate install @scope/package-name
        </div>
        <p className="text-xs text-muted-foreground">
          Works with npm, pip, cargo, and MCP-compatible agent runtimes.
        </p>
      </section>
    </div>
  );
}
