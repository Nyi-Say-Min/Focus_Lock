// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { websitesMock } from "./websites-mock";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ApplicationsPicker from "../src/renderer/src/ApplicationsPicker";
import type { ApplicationsResult } from "../src/shared/applications";

afterEach(cleanup);

it("searches names, disables duplicates, adds selected executables and offers browsing", async () => {
  const applications = {
    discover: vi.fn().mockResolvedValue({
      ok: true,
      value: [
        { name: "Friendly Chat", executableName: "chat.exe", icon: "" },
        { name: "Other", executableName: "other.exe", icon: "" },
      ],
    }),
    add: vi.fn().mockResolvedValue({ ok: true, value: [], scanFailed: false }),
    browse: vi.fn(),
    list: vi.fn(),
    setEnabled: vi.fn(),
    remove: vi.fn(),
  };
  window.focusLock = {
    websites: websitesMock,
    applications,
    settings: { get: vi.fn(), update: vi.fn() },
    session: { getCurrent: vi.fn(), start: vi.fn(), stop: vi.fn() },
  };
  const request = vi.fn(async (work: () => Promise<ApplicationsResult>) => {
    await work();
  });
  render(<ApplicationsPicker added={["other.exe"]} request={request} />);

  fireEvent.click(screen.getByText("Choose installed apps"));

  expect(await screen.findByRole("button", { name: "Add Other" })).toBeDisabled();

  fireEvent.change(screen.getByLabelText("Search installed apps"), { target: { value: "FRIENDLY" } });

  expect(screen.queryByText("Other")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Add Friendly Chat" }));

  await waitFor(() => expect(applications.add).toHaveBeenCalledWith("chat.exe"));

  fireEvent.click(screen.getByText("Browse for an executable"));

  await waitFor(() => expect(applications.browse).toHaveBeenCalledOnce());

  applications.discover.mockRejectedValueOnce(Error("offline"));

  fireEvent.click(screen.getByText("Refresh apps"));

  expect(await screen.findByText(/Could not find installed apps/)).toBeInTheDocument();
});
