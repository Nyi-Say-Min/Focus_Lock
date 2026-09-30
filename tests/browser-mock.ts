import { vi } from "vitest";
export const browserMock = {
  getStatus: vi.fn().mockResolvedValue({
    ok: true,
    status: { chrome: false, edge: false, firefox: false, unavailable: false },
  }),
  copyCode: vi.fn().mockResolvedValue({
    ok: true,
    status: { chrome: false, edge: false, firefox: false, unavailable: false },
  }),
  openFolder: vi.fn().mockResolvedValue({
    ok: true,
    status: { chrome: false, edge: false, firefox: false, unavailable: false },
  }),
};
