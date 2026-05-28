import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sheet } from "./Sheet";

describe("Sheet", () => {
  it("renders content and exposes role=dialog", () => {
    render(
      <Sheet state="expanded" onStateChange={() => {}}>
        <p>hello sheet</p>
      </Sheet>,
    );
    expect(screen.getByText("hello sheet")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("invokes onStateChange when the backdrop is clicked from expanded", () => {
    const onStateChange = vi.fn();
    const { container } = render(
      <Sheet state="expanded" onStateChange={onStateChange}>
        <p>x</p>
      </Sheet>,
    );
    const backdrop = container.querySelector(".app-sheet-backdrop")!;
    fireEvent.click(backdrop);
    expect(onStateChange).toHaveBeenCalledWith("peek");
  });
});
