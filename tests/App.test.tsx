// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "../src/renderer/src/App";
const session = {
  getCurrent: vi.fn().mockResolvedValue({ ok: true, value: null, now: 0 }),
  start: vi.fn(),
  stop: vi.fn(),
};
afterEach(cleanup);

const value = { allowanceMinutes: 30, blockMinutes: 30 };
const applications = {
  list: vi.fn().mockResolvedValue({ ok: true, value: [], scanFailed: false }),
  add: vi.fn(),
  setEnabled: vi.fn(),
  remove: vi.fn(),
};
it("loads settings and reports save success only after persistence succeeds", async () => {
  const update = vi
    .fn()
    .mockResolvedValueOnce({ ok: false, error: "STORAGE_FAILED" })
    .mockResolvedValueOnce({ ok: true, value });
  window.focusLock = {
    applications,
    session,
    settings: { get: vi.fn().mockResolvedValue({ ok: true, value }), update },
  };
  render(<App />);
  fireEvent.change(await screen.findByLabelText(/Social allowance/), {
    target: { value: "20" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save defaults" }));
  expect(
    await screen.findByText("Could not save settings. Try again."),
  ).toBeInTheDocument();
  expect(update).toHaveBeenCalledWith({
    allowanceMinutes: 20,
    blockMinutes: 30,
  });
  fireEvent.click(screen.getByRole("button", { name: "Save defaults" }));
  expect(await screen.findByText("Settings saved.")).toBeInTheDocument();
});
it("offers a retry after the bridge fails to load", async () => {
  window.focusLock = {
    applications,
    session,
    settings: {
      get: vi
        .fn()
        .mockRejectedValueOnce(new Error())
        .mockResolvedValue({ ok: true, value }),
      update: vi.fn(),
    },
  };
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Retry loading" }));
  expect(await screen.findByLabelText(/Social allowance/)).toHaveValue(30);
});
