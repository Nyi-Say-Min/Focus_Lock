import type { ComponentProps } from "react";
export function Checkbox({ className = "", ...props }: ComponentProps<"input">) {
  return <input {...props} type="checkbox" className={`star-check ${className}`} />;
}
