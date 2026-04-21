import "./polyfills";
import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { Spinner } from "./components/ui/spinner.tsx";

const PrimeGateRuntime = lazy(() => import("./PrimeGateRuntime.tsx"));

createRoot(document.getElementById("root")!).render(
  <Suspense
    fallback={
      <div className="flex min-h-screen items-center justify-center gap-3 text-sm text-muted-foreground">
        <Spinner className="h-5 w-5" />
        <span>Loading PrimeGate...</span>
      </div>
    }
  >
    <PrimeGateRuntime />
  </Suspense>,
);
