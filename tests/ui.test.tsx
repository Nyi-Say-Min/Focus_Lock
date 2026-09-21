import { PipeList } from "../src/renderer/src/common/ui/PipeList";
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NumberInput } from "../src/renderer/src/common/ui";
it("keeps steppers within bounds and disables editing when unavailable", () => {
  const change = vi.fn();
  const { rerender } = render(<NumberInput label="Minutes" value={1} max={2} onValueChange={change} />);
  expect(screen.getByLabelText("Decrease Minutes")).toBeDisabled();
  fireEvent.click(screen.getByLabelText("Increase Minutes"));
  expect(change).toHaveBeenCalledWith(2);
  rerender(<NumberInput label="Minutes" value={2} max={2} onValueChange={change} disabled />);
  expect(screen.getByRole("spinbutton")).toBeDisabled();
  expect(screen.getByLabelText("Increase Minutes")).toBeDisabled();
  cleanup();
});

it("supports keyboard and button scrolling with an accessible coin scrollbar", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      disconnect = vi.fn();
    },
  );
  render(
    <PipeList>
      {Array.from({ length: 10 }, (_, index) => (
        <li key={index}>App {index}</li>
      ))}
    </PipeList>,
  );
  const list = screen.getByRole("list", { name: "Configured applications" });
  Object.defineProperties(list, { scrollHeight: { value: 600 }, clientHeight: { value: 150 } });
  fireEvent.scroll(list);
  const scrollbar = screen.getByRole("scrollbar", { name: "Application list position" });
  expect(scrollbar).toHaveAttribute("aria-valuemax", "450");
  fireEvent.keyDown(scrollbar, { key: "End" });
  fireEvent.scroll(list);
  expect(list.scrollTop).toBe(450);
  expect(scrollbar).toHaveAttribute("aria-valuenow", "450");
  expect(screen.getByRole("button", { name: "Scroll applications down" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Scroll applications up" }));
  fireEvent.scroll(list);
  expect(list.scrollTop).toBe(370);
  fireEvent.keyDown(scrollbar, { key: "Home" });
  fireEvent.scroll(list);
  expect(list.scrollTop).toBe(0);
  expect(screen.getByRole("button", { name: "Scroll applications up" })).toBeDisabled();
  vi.unstubAllGlobals();
});
