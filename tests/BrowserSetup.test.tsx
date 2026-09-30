// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  act,
} from "@testing-library/react";
import BrowserSetup from "../src/renderer/src/BrowserSetup";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it("offers manual setup, copies without exposing the code, and updates connection status", async () => {
  vi.useFakeTimers();
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
  const browser = {
    getStatus: vi.fn().mockResolvedValue({
      ok: true,
      status: { chrome: 2, edge: 0, firefox: 0, unavailable: false },
    }),
    copyCode: vi.fn().mockResolvedValue({
      ok: true,
      status: { chrome: 2, edge: 0, firefox: 0, unavailable: false },
    }),
    openFolder: vi
      .fn()
      .mockResolvedValue({ ok: false, error: "FOLDER_UNAVAILABLE" }),
  };
  window.focusLock = { ...window.focusLock, browser };
  render(<BrowserSetup />);
  expect(browser.getStatus).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Set up browsers" }));
  });
  expect(screen.getByRole("dialog")).toHaveAccessibleName(
    "Browser website blocking",
  );
  expect(
    screen.getByText("Connected profiles — Chrome: 2 · Edge: 0 · Firefox: 0"),
  ).toBeInTheDocument();
  expect(screen.getByText("chrome://extensions")).toBeInTheDocument();
  expect(screen.getByText("edge://extensions")).toBeInTheDocument();
  expect(screen.getByText("about:debugging")).toBeInTheDocument();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Copy pairing code" }));
  });
  expect(browser.copyCode).toHaveBeenCalledOnce();
  expect(screen.getByText(/Pairing code copied/)).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: "Open extension folder" }),
    );
  });
  expect(
    screen.getByText("Setup action failed. Please try again."),
  ).toBeInTheDocument();
  browser.getStatus.mockResolvedValue({
    ok: true,
    status: { chrome: 0, edge: 1, firefox: 1, unavailable: false },
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1500);
  });
  expect(
    screen.getByText("Connected profiles — Chrome: 0 · Edge: 1 · Firefox: 1"),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  const calls = browser.getStatus.mock.calls.length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  expect(browser.getStatus).toHaveBeenCalledTimes(calls);
});
