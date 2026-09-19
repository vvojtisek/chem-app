import type { CSSProperties, ReactNode } from "react";

const visuallyHiddenStyles: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export function VisuallyHidden({ children }: Readonly<{ children: ReactNode }>) {
  return <span style={visuallyHiddenStyles}>{children}</span>;
}
