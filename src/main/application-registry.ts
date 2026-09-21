import type { Application } from "../shared/applications";

const executable = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= 120 &&
  /^[^\\/:*?"<>|]+\.exe$/i.test(value) &&
  [...value].every((char) => char.charCodeAt(0) >= 32);

export const defaultApplications: Application[] = ["Discord", "Telegram", "WhatsApp"].map((name) => ({
  id: `${name.toLowerCase()}.exe`,
  name,
  executableName: `${name}.exe`,
  enabled: false,
}));

export function applicationRegistry(storage: { read(): unknown; write(value: Application[]): void }) {
  const list = (): Application[] => {
    const items = storage.read();
    const valid = (item: Application) =>
      item &&
      executable(item.executableName) &&
      item.id === item.executableName.toLowerCase() &&
      typeof item.name === "string" &&
      item.name.length > 0 &&
      item.name.length <= 120 &&
      typeof item.enabled === "boolean";
    if (
      !Array.isArray(items) ||
      items.length > 100 ||
      !items.every(valid) ||
      new Set(items.map((item) => item.id)).size !== items.length
    )
      throw Error("INVALID_APPLICATIONS");
    return items.map((item) => ({ ...item }));
  };
  const change = (action: string, args: unknown[], label?: string) => {
    const items = list(),
      [id, enabled] = args;
    if (action === "add") {
      if (args.length !== 1 || !executable(id)) throw Error("INVALID_EXECUTABLE");
      if (items.some((item) => item.id === id.toLowerCase())) throw Error("DUPLICATE_APPLICATION");
      if (items.length === 100) throw Error("APPLICATION_LIMIT");
      items.push({ id: id.toLowerCase(), name: label || id.slice(0, -4), executableName: id, enabled: true });
    } else {
      if (
        typeof id !== "string" ||
        args.length !== (action === "remove" ? 1 : 2) ||
        (action === "setEnabled" && typeof enabled !== "boolean")
      )
        throw Error("INVALID_APPLICATION");
      const index = items.findIndex((item) => item.id === id);
      if (index < 0) throw Error("APPLICATION_NOT_FOUND");
      if (action === "remove") items.splice(index, 1);
      else if (action === "setEnabled") items[index].enabled = enabled as boolean;
      else throw Error("INVALID_APPLICATION");
    }
    storage.write(items);
  };
  return { list, change };
}
