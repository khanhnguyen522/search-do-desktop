import type { Workflow } from "../../app/engine";

type Props = {
  items: Workflow[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onRun: (index: number) => void;
};

export function SearchResults({
  items,
  selectedIndex,
  onSelect,
  onRun,
}: Props) {
  if (items.length === 0)
    return <div style={{ opacity: 0.65, marginTop: 12 }}>No results</div>;

  return (
    <div style={{ marginTop: 12 }}>
      {items.map((w, i) => (
        <div
          key={w.id}
          onMouseEnter={() => onSelect(i)}
          onClick={() => onRun(i)}
          style={{
            padding: "10px 12px",
            cursor: "pointer",
            borderRadius: 10,
            background:
              i === selectedIndex ? "rgba(255,255,255,0.10)" : "transparent",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>
              {w.type === "command" ? w.name : w.name}
            </div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>
              {w.type === "command"
                ? w.description ?? w.keywords.join(", ")
                : w.keywords.join(", ")}
            </div>
          </div>

          {w.type === "action" && w.durationMinutes ? (
            <div style={{ fontSize: 11, opacity: 0.7 }}>
              {Math.round(w.durationMinutes * 60)}s
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
