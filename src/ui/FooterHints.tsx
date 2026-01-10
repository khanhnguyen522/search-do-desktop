export function FooterHints({ kind }: { kind: "command" | "filter" }) {
  return (
    <div style={{ fontSize: 11, opacity: 0.7 }}>
      ↑/↓ Select · Enter Run · Esc Hide · Cmd+L Focus · Cmd+K Clear
      {kind === "command" ? " · / commands" : ""}
    </div>
  );
}
