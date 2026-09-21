import type { HTMLAttributes } from "react";
export function Card({
  as: Tag = "section",
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & { as?: "section" | "fieldset" | "form"; disabled?: boolean }) {
  return <Tag {...props} className={`game-card ${className}`} />;
}
