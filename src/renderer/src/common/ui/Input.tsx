import type { ComponentProps } from "react";
export function Input(props: ComponentProps<"input">) {
  return (
    <span className="pipe-input">
      <input {...props} />
    </span>
  );
}
