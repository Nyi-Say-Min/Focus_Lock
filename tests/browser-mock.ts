import { vi } from "vitest";
export const browserMock = {
  getStatus: vi.fn().mockResolvedValue({ ok: true, status: "disconnected" }),
  copyCode: vi.fn().mockResolvedValue({ ok: true, status: "disconnected" }),
  openFolder: vi.fn().mockResolvedValue({ ok: true, status: "disconnected" }),
};
