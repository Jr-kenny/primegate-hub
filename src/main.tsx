import "./polyfills";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/spectral/400.css";
import "@fontsource/spectral/600.css";
import "@fontsource/spectral/700.css";
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
