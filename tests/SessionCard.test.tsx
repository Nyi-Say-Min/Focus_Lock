// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import SessionCard from "../src/renderer/src/SessionCard";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("starts and stops through IPC, polls the main clock and disables unavailable controls", async () => {
  vi.useFakeTimers();
  const value = { startedAt: 0, allowanceEndsAt: 60000, blockEndsAt: 120000, status: "active" };
  const session = {
    getCurrent: vi.fn().mockResolvedValue({ ok: true, value: null, now: 0 }),
    start: vi.fn().mockResolvedValue({ ok: true, value, now: 0 }),
    stop: vi.fn().mockResolvedValue({ ok: true, value: { ...value, status: "cancelled" }, now: 1000 }),
  };
  window.focusLock = { settings: { get: vi.fn(), update: vi.fn() }, session };
  await act(async () => {
    render(<SessionCard />);
  });
  session.start.mockResolvedValueOnce({ ok: false, error: "SESSION_STORAGE_FAILED" });
  await act(async () => {
    fireEvent.click(screen.getByText("Start session"));
  });
  expect(screen.getByText("Session unavailable. Please try again.")).toBeInTheDocument();
  expect(screen.getByText("Start session")).toBeEnabled();
  session.getCurrent.mockResolvedValue({ ok: true, value, now: 1000 });
  await act(async () => {
    fireEvent.click(screen.getByText("Start session"));
  });
  expect(screen.getByText("Stop session")).toBeEnabled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(screen.getByLabelText("Time remaining")).toHaveTextContent("00:00:59");
  session.getCurrent.mockResolvedValue({ ok: true, value: { ...value, status: "cancelled" }, now: 1000 });
  await act(async () => {
    fireEvent.click(screen.getByText("Stop session"));
  });
  expect(session.stop).toHaveBeenCalledOnce();
  expect(screen.getByText("Start session")).toBeEnabled();
  session.getCurrent.mockRejectedValue(Error("offline"));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(screen.getByText("Start session")).toBeDisabled();
  session.getCurrent.mockResolvedValue({ ok: true, value: null, now: 1000 });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(screen.getByText("Start session")).toBeEnabled();
});
