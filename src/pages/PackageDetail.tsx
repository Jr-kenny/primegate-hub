import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, ExternalLink, Shield } from "lucide-react";

const detailTabs = ["Overview", "Versions", "Install", "Usage", "Reviews", "Publisher"];

export default function PackageDetail() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState("Overview");

  return (
    <div className="container py-8 space-y-6 max-w-4xl">
      <Link to="/discover" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back to Discover
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold font-mono">@scope/{id}</h1>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">Verified</span>
          </div>
          <p className="text-sm text-muted-foreground">A composable utility for agent workflows and data pipelines.</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>v2.4.1</span>
            <span>•</span>
            <span>12,340 installs</span>
            <span>•</span>
            <Link to={`/publisher/publisher-1`} className="hover:text-foreground">publisher-1</Link>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button className="flex items-center gap-2 h-9 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent/90 transition-colors">
            <Download className="h-3.5 w-3.5" /> Install
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b overflow-x-auto">
        {detailTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab
                ? "border-accent text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="min-h-[300px]">
        {activeTab === "Overview" && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: "License", value: "MIT" },
                { label: "Runtime", value: "Node.js, Python" },
                { label: "Chain", value: "Ethereum" },
              ].map((item) => (
                <div key={item.label} className="rounded-md border p-3 space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-medium">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-md border p-4 space-y-2">
              <h3 className="text-sm font-semibold">Description</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This package provides a composable set of utilities for building agent workflows,
                data pipelines, and tool chains. It supports multiple runtimes and can be installed
                via CLI, SDK, or MCP integration. Entitlements are managed on-chain.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5 text-accent" />
              <span>Verified publisher · Audited · On-chain entitlements</span>
            </div>
          </div>
        )}
        {activeTab === "Install" && (
          <div className="space-y-4">
            <div className="rounded-md border bg-card p-4 space-y-2">
              <p className="text-xs font-medium text-accent uppercase tracking-wide">CLI</p>
              <div className="font-mono text-sm bg-secondary rounded-md p-3">
                <span className="text-muted-foreground">$</span> primegate install @scope/{id}
              </div>
            </div>
            <div className="rounded-md border bg-card p-4 space-y-2">
              <p className="text-xs font-medium text-accent uppercase tracking-wide">MCP</p>
              <div className="font-mono text-sm bg-secondary rounded-md p-3">
                mcp://primegate.io/@scope/{id}
              </div>
            </div>
          </div>
        )}
        {activeTab !== "Overview" && activeTab !== "Install" && (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
            {activeTab} content will appear here.
          </div>
        )}
      </div>
    </div>
  );
}
