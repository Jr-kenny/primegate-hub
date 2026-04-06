import { Link } from "react-router-dom";
import { Package, Terminal, Database, Workflow, Bot, FileText, Boxes } from "lucide-react";

const categories = [
  { label: "Tools", icon: Terminal, count: 1240 },
  { label: "Prompts", icon: FileText, count: 890 },
  { label: "Datasets", icon: Database, count: 560 },
  { label: "Workflows", icon: Workflow, count: 340 },
  { label: "Agent Components", icon: Bot, count: 720 },
  { label: "Packages", icon: Package, count: 2100 },
  { label: "Artifacts", icon: Boxes, count: 430 },
];

export default function Categories() {
  return (
    <div className="container py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Categories</h1>
        <p className="text-sm text-muted-foreground">Browse the registry by asset type.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map((cat) => (
          <Link
            key={cat.label}
            to={`/discover?type=${cat.label.toLowerCase()}`}
            className="flex items-center gap-4 p-4 rounded-lg border hover:bg-secondary/50 transition-colors group"
          >
            <cat.icon className="h-5 w-5 text-accent shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium group-hover:text-accent transition-colors">{cat.label}</p>
              <p className="text-xs text-muted-foreground">{cat.count.toLocaleString()} assets</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
