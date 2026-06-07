import { motion } from "framer-motion";
import { Link } from "react-router-dom";

import type { RegistryPackage } from "@/lib/registry-data";
import { cn } from "@/lib/utils";

type PackageCardProps = {
  package: RegistryPackage;
  className?: string;
};

function formatInstalls(installs: number): string {
  if (installs >= 1000) {
    return `${(installs / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(installs);
}

export function PackageCard({ package: pkg, className }: PackageCardProps) {
  const isFree = pkg.price.trim().toLowerCase() === "free";

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={cn(
        "group rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/50",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          to={`/package/${pkg.id}`}
          className="font-serif text-lg font-semibold leading-tight text-card-foreground hover:underline"
        >
          {pkg.name}
        </Link>
        <span className="shrink-0 rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground tabular-nums">
          v{pkg.version}
        </span>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        {pkg.publisher} · {pkg.license}
      </p>

      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{pkg.description}</p>

      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatInstalls(pkg.installs)} installs
        </span>
        <span className="text-xs font-semibold text-primary">
          {isFree ? "Install →" : `${pkg.price} · Buy`}
        </span>
      </div>
    </motion.div>
  );
}
