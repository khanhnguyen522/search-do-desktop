export function FooterHints({
  kind,
  view,
  todosMode,
}: {
  kind: "command" | "filter";
  view: "search" | "todos";
  todosMode?: "daily" | "occasional";
}) {
  if (view === "search") {
    return (
      <div style={{ fontSize: 11, opacity: 0.7 }}>
        ↑/↓ Select · Enter Run · Tab Switch · Cmd+L Focus · Cmd+K Clear
        {kind === "command"
          ? " · / commands"
          : " · t <todo> @today/@tmr/@YYYY-MM-DD"}
      </div>
    );
  }

  return (
    <div style={{ fontSize: 11, opacity: 0.7 }}>
      ↑/↓ Select · Enter Toggle/Run · 1/2/3 Tabs · Cmd+A Archive · Cmd+⌫ Delete
      · Tab Switch · Esc Back
      {todosMode === "daily" ? " · Cmd+←/→ Day · Cmd+T Today" : ""}
    </div>
  );
}
