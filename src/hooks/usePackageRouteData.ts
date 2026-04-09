import { useOutletContext } from "react-router-dom";

import type { RegistryPackage } from "@/lib/registry-data";

type PackageRouteContext = {
  pkg: RegistryPackage;
};

export function usePackageRouteData() {
  return useOutletContext<PackageRouteContext>();
}
