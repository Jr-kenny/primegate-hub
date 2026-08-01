import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";

import type { RegistryPackage } from "@/lib/registry-data";
import { PackageCard } from "./PackageCard";

const basePackage: RegistryPackage = {
  id: "pkg_1",
  name: "Vision Embeddings",
  description: "Multimodal CLIP embeddings with agent-ready manifest.",
  publisher: "@labs/perception",
  type: "dataset",
  installs: 12400,
  price: "Free",
  verified: true,
  agentReady: true,
  version: "2.4.0",
  license: "MIT",
  runtime: "python",
  chain: "aptos",
  publisherSummary: "",
  publisherPackageCount: 3,
  publisherMemberSince: "2025",
  usageSnippet: "",
  reviews: [],
  versions: [],
};

function renderCard(pkg: RegistryPackage) {
  return render(
    <MemoryRouter>
      <PackageCard package={pkg} />
    </MemoryRouter>,
  );
}

describe("PackageCard", () => {
  it("shows name, publisher, version and license", () => {
    renderCard(basePackage);
    expect(screen.getByText("Vision Embeddings")).toBeInTheDocument();
    expect(screen.getByText(/@labs\/perception/)).toBeInTheDocument();
    expect(screen.getByText("v2.4.0")).toBeInTheDocument();
    expect(screen.getByText(/MIT/)).toBeInTheDocument();
  });

  it("links to the package detail route", () => {
    renderCard(basePackage);
    expect(screen.getByRole("link", { name: /Vision Embeddings/ })).toHaveAttribute(
      "href",
      "/package/pkg_1",
    );
  });

  it("renders an Install action for free packages", () => {
    renderCard(basePackage);
    expect(screen.getByText(/Install/)).toBeInTheDocument();
  });

  it("renders the price as a buy action for paid packages", () => {
    renderCard({ ...basePackage, price: "$12" });
    expect(screen.getByText(/\$12/)).toBeInTheDocument();
  });

  it("keeps long wallet publishers readable", () => {
    const walletPublisher = "0xc0ba79db01224122f6acf11676b1e9c8e602e3e7f37b8ce3de412b4d10b00284";
    renderCard({ ...basePackage, publisher: walletPublisher });
    expect(screen.getByTitle(walletPublisher)).toHaveTextContent("0xc0ba...0284");
  });
});
