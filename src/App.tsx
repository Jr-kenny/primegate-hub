import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PublicLayout } from "./components/PublicLayout";
import { WorkspaceLayout } from "./components/WorkspaceLayout";
import Landing from "./pages/Landing";
import Discover from "./pages/Discover";
import Categories from "./pages/Categories";
import PackageDetail from "./pages/PackageDetail";
import PublisherProfile from "./pages/PublisherProfile";
import Docs from "./pages/Docs";
import Pricing from "./pages/Pricing";
import Publish from "./pages/Publish";
import WorkspaceExplore from "./pages/workspace/Explore";
import Installed from "./pages/workspace/Installed";
import Purchases from "./pages/workspace/Purchases";
import Publishing from "./pages/workspace/Publishing";
import WalletPage from "./pages/workspace/Wallet";
import WorkspaceSettings from "./pages/workspace/Settings";
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
            <Route path="/categories" element={<Categories />} />
            <Route path="/package/:id" element={<PackageDetail />} />
            <Route path="/publisher/:id" element={<PublisherProfile />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/pricing" element={<Pricing />} />
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
            <Route path="settings" element={<WorkspaceSettings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
