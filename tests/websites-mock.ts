import { vi } from "vitest";
export const websitesMock = {
  list: vi.fn().mockResolvedValue({ ok: true, value: [] }),
  add: vi.fn(),
  setEnabled: vi.fn(),
  remove: vi.fn(),
};
