import { Check } from "lucide-react";

const tiers = [
  {
    name: "Open",
    price: "Free",
    desc: "For individual developers and open-source projects.",
    features: ["Unlimited free installs", "Publish up to 5 packages", "CLI & SDK access", "Community support"],
  },
  {
    name: "Pro",
    price: "$49/mo",
    desc: "For teams and commercial publishers.",
    features: ["Everything in Open", "Unlimited publishing", "Private packages", "Analytics dashboard", "Priority support"],
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    desc: "For organizations with compliance and scale requirements.",
    features: ["Everything in Pro", "On-chain entitlement management", "Custom MCP endpoints", "SLA & dedicated support", "Audit logs"],
  },
];

export default function Pricing() {
  return (
    <div className="container py-8 space-y-8 max-w-4xl">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold">Pricing</h1>
        <p className="text-sm text-muted-foreground">Simple pricing for publishers and consumers.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`rounded-lg border p-5 space-y-4 ${
              tier.highlighted ? "border-accent bg-card" : ""
            }`}
          >
            <div className="space-y-1">
              <h3 className="font-semibold">{tier.name}</h3>
              <p className="text-2xl font-bold">{tier.price}</p>
              <p className="text-xs text-muted-foreground">{tier.desc}</p>
            </div>
            <ul className="space-y-2">
              {tier.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-3.5 w-3.5 text-accent shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button
              className={`w-full h-9 rounded-md text-sm font-medium transition-colors ${
                tier.highlighted
                  ? "bg-accent text-accent-foreground hover:bg-accent/90"
                  : "border hover:bg-secondary"
              }`}
            >
              {tier.price === "Custom" ? "Contact Sales" : "Get Started"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
