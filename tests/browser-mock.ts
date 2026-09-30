import { vi } from "vitest";
export const browserMock = {
  getStatus: vi.fn().mockResolvedValue({
    ok: true,
    status: {
      chrome: 0,
      edge: 0,
      firefox: 0,
      unavailable: false,
      sync: { applied: 0, pending: 0, failed: 0 },
    },
  }),
  copyCode: vi.fn().mockResolvedValue({
    ok: true,
    status: {
      chrome: 0,
      edge: 0,
      firefox: 0,
      unavailable: false,
      sync: { applied: 0, pending: 0, failed: 0 },
    },
  }),
  openFolder: vi.fn().mockResolvedValue({
    ok: true,
    status: {
      chrome: 0,
      edge: 0,
      firefox: 0,
      unavailable: false,
      sync: { applied: 0, pending: 0, failed: 0 },
    },
  }),
};
