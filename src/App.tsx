import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PublicLayout } from "./components/PublicLayout";
import { WorkspaceLayout } from "./components/WorkspaceLayout";
import Landing from "./pages/Landing";
import Discover from "./pages/Discover";
import Categories from "./pages/Categories";
import SearchPage from "./pages/Search";
import PackageDetail from "./pages/PackageDetail";
import PublisherProfile from "./pages/PublisherProfile";
import Docs from "./pages/Docs";
import HowItWorks from "./pages/HowItWorks";
import Publish from "./pages/Publish";
import PackageOverview from "./pages/package/PackageOverview";
import PackageVersions from "./pages/package/PackageVersions";
import PackageInstall from "./pages/package/PackageInstall";
import PackageUsage from "./pages/package/PackageUsage";
import PackageReviews from "./pages/package/PackageReviews";
import PackagePublisher from "./pages/package/PackagePublisher";
import WorkspaceExplore from "./pages/workspace/Explore";
import Installed from "./pages/workspace/Installed";
import Purchases from "./pages/workspace/Purchases";
import Publishing from "./pages/workspace/Publishing";
import WalletPage from "./pages/workspace/Wallet";
import PublisherPackages from "./pages/workspace/PublisherPackages";
import PublisherReleases from "./pages/workspace/PublisherReleases";
import PublisherSales from "./pages/workspace/PublisherSales";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
            <Route path="/publish" element={<Publish />} />
          </Route>
          <Route path="/workspace" element={<WorkspaceLayout />}>
            <Route index element={<WorkspaceExplore />} />
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
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
