import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Spinner } from "@/components/ui/spinner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

const PublicLayout = lazy(async () => ({
  default: (await import("./components/PublicLayout")).PublicLayout,
}));
const WorkspaceLayout = lazy(async () => ({
  default: (await import("./components/WorkspaceLayout")).WorkspaceLayout,
}));
const Landing = lazy(() => import("./pages/Landing"));
const Discover = lazy(() => import("./pages/Discover"));
const Categories = lazy(() => import("./pages/Categories"));
const SearchPage = lazy(() => import("./pages/Search"));
const PackageDetail = lazy(() => import("./pages/PackageDetail"));
const PublisherProfile = lazy(() => import("./pages/PublisherProfile"));
const Docs = lazy(() => import("./pages/Docs"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const Publish = lazy(() => import("./pages/Publish"));
const PackageOverview = lazy(() => import("./pages/package/PackageOverview"));
const PackageVersions = lazy(() => import("./pages/package/PackageVersions"));
const PackageInstall = lazy(() => import("./pages/package/PackageInstall"));
const PackageUsage = lazy(() => import("./pages/package/PackageUsage"));
const PackageReviews = lazy(() => import("./pages/package/PackageReviews"));
const PackagePublisher = lazy(() => import("./pages/package/PackagePublisher"));
const WorkspaceExplore = lazy(() => import("./pages/workspace/Explore"));
const Installed = lazy(() => import("./pages/workspace/Installed"));
const Purchases = lazy(() => import("./pages/workspace/Purchases"));
const Publishing = lazy(() => import("./pages/workspace/Publishing"));
const WalletPage = lazy(() => import("./pages/workspace/Wallet"));
const PublisherPackages = lazy(() => import("./pages/workspace/PublisherPackages"));
const PublisherReleases = lazy(() => import("./pages/workspace/PublisherReleases"));
const PublisherSales = lazy(() => import("./pages/workspace/PublisherSales"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="container flex min-h-[40vh] items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
    <Spinner className="h-5 w-5" />
    <span>Loading PrimeGate...</span>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Landing />} />
              <Route path="/discover" element={<Discover />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/categories" element={<Categories />} />
              <Route path="/package/:id" element={<PackageDetail />}>
                <Route index element={<PackageOverview />} />
                <Route path="versions" element={<PackageVersions />} />
                <Route path="install" element={<PackageInstall />} />
                <Route path="usage" element={<PackageUsage />} />
                <Route path="reviews" element={<PackageReviews />} />
                <Route path="publisher" element={<PackagePublisher />} />
              </Route>
              <Route path="/publisher/:id" element={<PublisherProfile />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/pricing" element={<Navigate to="/how-it-works" replace />} />
              <Route path="/publish" element={<Navigate to="/workspace/publish" replace />} />
            </Route>
            <Route path="/workspace" element={<WorkspaceLayout />}>
              <Route index element={<WorkspaceExplore />} />
              <Route path="publish" element={<Publish />} />
              <Route path="installed" element={<Installed />} />
              <Route path="purchases" element={<Purchases />} />
              <Route path="publishing" element={<Publishing />} />
              <Route path="publishing/packages" element={<PublisherPackages />} />
              <Route path="publishing/releases" element={<PublisherReleases />} />
              <Route path="publishing/sales" element={<PublisherSales />} />
              <Route path="wallet" element={<WalletPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
