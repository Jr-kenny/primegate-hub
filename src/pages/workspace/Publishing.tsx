import { Link } from "react-router-dom";

export default function Publishing() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Publishing</h1>
      <p className="text-sm text-muted-foreground">Manage your published assets.</p>
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { label: "Packages", path: "/workspace/publishing/packages", count: 0 },
          { label: "Releases", path: "/workspace/publishing/releases", count: 0 },
          { label: "Sales", path: "/workspace/publishing/sales", count: 0 },
        ].map((item) => (
          <Link
            key={item.label}
            to={item.path}
            className="rounded-md border p-4 hover:bg-secondary/50 transition-colors"
          >
            <p className="text-sm font-medium">{item.label}</p>
            <p className="text-2xl font-bold mt-1">{item.count}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
