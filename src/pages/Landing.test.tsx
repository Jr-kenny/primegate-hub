import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";

import Landing from "./Landing";

describe("Landing", () => {
  it("renders the hero headline and primary CTAs", () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Browse Registry/i })).toHaveAttribute("href", "/discover");
    expect(screen.getByRole("link", { name: /Read the Docs/i })).toHaveAttribute("href", "/docs");
  });
});
