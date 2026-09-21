import type { HTMLAttributes } from "react";
export function ScrollArea({
  className = "",
  as: Tag = "div",
  ...props
}: HTMLAttributes<HTMLElement> & { as?: "div" | "ul" }) {
  return <Tag tabIndex={0} {...props} className={`pipe-scroll ${className}`} />;
}
