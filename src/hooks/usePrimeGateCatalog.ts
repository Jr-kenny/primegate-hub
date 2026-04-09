import { useQuery } from "@tanstack/react-query";

import {
  fetchPackageById,
  fetchPackageResolution,
  fetchPackages,
  fetchPublisherProfile,
  searchCatalog,
  searchCatalogPublishers,
} from "@/lib/registry-api";
import {
  getDiscoverPackages,
  getPackageById,
  getPublisherProfile,
} from "@/lib/registry-data";

export function useDiscoverPackages() {
  return useQuery({
    gcTime: 10 * 60 * 1000,
    queryKey: ["primegate", "packages"],
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
    queryFn: async () => {
      try {
        return await fetchPackages();
      } catch {
        return getDiscoverPackages();
      }
    },
  });
}

export function usePrimeGatePackage(id?: string) {
  return useQuery({
    enabled: Boolean(id),
    gcTime: 10 * 60 * 1000,
    queryKey: ["primegate", "package", id],
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
    queryFn: async () => {
      if (!id) {
        throw new Error("Package id is required.");
      }

      try {
        return await fetchPackageById(id);
      } catch {
        return getPackageById(id);
      }
    },
  });
}

export function usePrimeGatePublisherProfile(id?: string) {
  return useQuery({
    enabled: Boolean(id),
    gcTime: 10 * 60 * 1000,
    queryKey: ["primegate", "publisher", id],
    refetchOnWindowFocus: false,
    staleTime: 60 * 1000,
    queryFn: async () => {
      if (!id) {
        throw new Error("Publisher id is required.");
      }

      try {
        return await fetchPublisherProfile(id);
      } catch {
        return getPublisherProfile(id);
      }
    },
  });
}

export function usePrimeGateCatalogSearch(query: string) {
  return useQuery({
    enabled: query.trim().length > 0,
    gcTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    queryKey: ["primegate", "search", query],
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000,
    queryFn: async () => {
      return await searchCatalog(query);
    },
  });
}

export function usePrimeGatePublisherSearch(query: string) {
  return useQuery({
    enabled: query.trim().length > 0,
    gcTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData,
    queryKey: ["primegate", "search", "publishers", query],
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000,
    queryFn: async () => {
      return await searchCatalogPublishers(query);
    },
  });
}

export function usePrimeGatePackageResolution(id?: string) {
  return useQuery({
    enabled: Boolean(id),
    queryKey: ["primegate", "package-resolution", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Package id is required.");
      }

      return fetchPackageResolution(id);
    },
  });
}
