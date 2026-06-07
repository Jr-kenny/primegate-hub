import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";

vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "light", setTheme: vi.fn() }) }));
vi.mock("@/hooks/usePrimeGateWallet", () => ({
  usePrimeGateWallet: () => ({
    address: null,
    availableWallets: [],
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: false,
    isReconnectingWallet: false,
    shortAddress: null,
  }),
}));

import { PublicNav } from "./PublicNav";

function renderNav() {
  return render(
    <MemoryRouter>
      <PublicNav />
    </MemoryRouter>,
  );
}

describe("PublicNav", () => {
  it("does not show Publish in the public nav", () => {
    renderNav();
    expect(screen.queryByRole("link", { name: "Publish" })).not.toBeInTheDocument();
  });

  it("renders a theme toggle", () => {
    renderNav();
    expect(screen.getByRole("button", { name: /toggle theme/i })).toBeInTheDocument();
  });

  it("keeps core discovery links", () => {
    renderNav();
    expect(screen.getByRole("link", { name: "Discover" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Categories" })).toBeInTheDocument();
  });
});
