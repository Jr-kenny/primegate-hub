export type RegistryReview = {
  author: string;
  body: string;
  createdAt?: string;
  rating: string;
  walletAddress?: string;
};

export type RegistryVersion = {
  channel?: string;
  id?: string;
  version: string;
  notes: string;
  publishedAt?: string;
  status: "latest" | "stable" | "legacy";
};

export type RegistryPackageArtifact = {
  assetBlobName: string;
  assetSha256?: string;
  createdAt: string;
  downloadPath: string;
  encrypted: boolean;
  downloadUrl: string;
  manifestBlobName: string;
  manifestPath: string;
  manifestUrl: string;
  mimeType: string;
  originalFileName: string;
  ownerAddress: string;
  sizeBytes: number;
  storage: "shelby";
};

export type RegistryPackageOffer = {
  id: string | null;
  slug: string;
  name: string;
  description: string;
  price: string;
  currency: "APT";
  license: string;
  updatePolicy: "release-only" | "patches" | "minor" | "lifetime";
  includedArtifacts: string[];
};

export type RegistryPackagePayment = {
  amountApt: string;
  amountOctas: string;
  currency: "APT";
  network: "shelbynet";
  recipientAddress: string;
};

export type RegistryPackageResolution = {
  access: "public" | "purchase-required";
  artifact: RegistryPackageArtifact | null;
  downloadPath: string | null;
  downloadUrl: string | null;
  install: {
    cli: string;
    mcp: string;
    sdk: string;
    web: string;
  };
  manifestPath: string | null;
  manifestUrl: string | null;
  offer: RegistryPackageOffer | null;
  packageHandle?: string | null;
  packageId: string;
  packageName: string;
  payment: RegistryPackagePayment | null;
  price: string;
  resolvePath: string;
  resolveUrl: string;
  version: string;
};

export type RegistryPackage = {
  id: string;
  name: string;
  packageHandle?: string;
  packageSlug?: string;
  createdAt?: string;
  description: string;
  keywords?: string[];
  readmeMarkdown?: string;
  releaseChannel?: string;
  releaseNotes?: string;
  publisher: string;
  type: string;
  installs: number;
  price: string;
  verified: boolean;
  agentReady: boolean;
  version: string;
  license: string;
  runtime: string;
  chain: string;
  offer?: RegistryPackageOffer;
  releaseCount?: number;
  publisherSummary: string;
  publisherPackageCount: number;
  publisherMemberSince: string;
  usageSnippet: string;
  reviews: RegistryReview[];
  versions: RegistryVersion[];
};

export type PublisherPackageSummary = {
  id: string;
  name: string;
  subtitle: string;
  installs: string;
};

export type RegistryPublisherProfile = {
  id: string;
  packageCount: number;
  memberSince: string;
  summary: string;
  verified: boolean;
  packages: PublisherPackageSummary[];
};

export type RegistryPublisherSearchResult = {
  id: string;
  packageCount: number;
  memberSince: string;
  summary: string;
  verified: boolean;
};

export const discoverTabs = ["Featured", "New", "Trending", "Agent-ready", "Human Tools", "Free", "Paid"] as const;
export const discoverFilters = ["Type", "Runtime", "Chain", "Install Method", "Price", "Publisher", "Verified"] as const;

export const searchGroups = [] as const;

export const suggestedScopes = ["agent-ready", "python", "mcp", "workflow", "dataset", "cli"] as const;

export function getDiscoverPackages() {
  return [] as RegistryPackage[];
}

export function getExplorePackages() {
  return [] as {
    id: string;
    name: string;
    subtitle: string;
  }[];
}

export function getPackageById(_id?: string) {
  return null as RegistryPackage | null;
}

export function getPublisherPackages(_id?: string) {
  return [] as PublisherPackageSummary[];
}

export function getPublisherProfile(id?: string): RegistryPublisherProfile {
  return {
    id: id ?? "",
    memberSince: "",
    packageCount: 0,
    packages: [],
    summary: "No PrimeGate publisher profile is available.",
    verified: false,
  };
}
