import { vi } from "vitest";
export const browserMock = {
  getStatus: vi.fn().mockResolvedValue({
    ok: true,
    status: { chrome: 0, edge: 0, firefox: 0, unavailable: false },
  }),
  copyCode: vi.fn().mockResolvedValue({
    ok: true,
    status: { chrome: 0, edge: 0, firefox: 0, unavailable: false },
  }),
  openFolder: vi.fn().mockResolvedValue({
    ok: true,
    status: { chrome: 0, edge: 0, firefox: 0, unavailable: false },
  }),
};
