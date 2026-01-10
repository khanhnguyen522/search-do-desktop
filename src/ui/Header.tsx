import React from "react";

export function Header({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gap: 10 }}>{children}</div>;
}
