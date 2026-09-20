import { messages } from "../consts/sessionErrorMessages";

export const explain = (code: string) => messages[code] ?? "Session unavailable. Please try again.";
