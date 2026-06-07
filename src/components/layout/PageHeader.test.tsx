import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("renders eyebrow, title and subtitle", () => {
    render(<PageHeader eyebrow="THE REGISTRY" title="Discover" subtitle="Browse packages" />);
    expect(screen.getByText("THE REGISTRY")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Discover" })).toBeInTheDocument();
    expect(screen.getByText("Browse packages")).toBeInTheDocument();
  });

  it("renders action slot content", () => {
    render(<PageHeader title="Discover" actions={<button>Publish</button>} />);
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
  });
});
