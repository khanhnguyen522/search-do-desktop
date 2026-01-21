import type { Workflow } from "../../app/engine";
import { useEffect, useRef } from "react";

export type Section = {
  title: string;
  items: Workflow[];
};

type Props = {
  sections: Section[];
  selectedIndex: number; // global index
  onSelect: (globalIndex: number) => void;
  onRun: (globalIndex: number) => void;
};

type TodoStatus = "active" | "done" | "archived";

type TodoWorkflow = Extract<Workflow, { type: "todo" }>;

function getTodoStatus(todo: TodoWorkflow): TodoStatus {
  // your current schema: status exists
  return todo.status;
}

function markerForTodo(todo: TodoWorkflow) {
  const s = getTodoStatus(todo);
  if (s === "archived") return "⧉";
  if (s === "done") return "✓";
  return "○";
}

function isFadedTodo(todo: TodoWorkflow) {
  const s = getTodoStatus(todo);
  return s === "done" || s === "archived";
}

export function SearchResults({
  sections,
  selectedIndex,
  onSelect,
  onRun,
}: Props) {
  const total = sections.reduce((sum, s) => sum + s.items.length, 0);
  if (total === 0) return <div style={{ opacity: 0.65 }}>No results</div>;

  let global = 0;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const el = container.querySelector(
      `[data-index="${selectedIndex}"]`
    ) as HTMLElement | null;
    if (!el) return;

    el.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <div ref={containerRef}>
      {sections.map((sec) => {
        if (sec.items.length === 0) return null;

        return (
          <div key={sec.title} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, opacity: 0.7, margin: "6px 0" }}>
              {sec.title.toUpperCase()}
            </div>

            {sec.items.map((w) => {
              const idx = global++;
              const isSelected = idx === selectedIndex;

              const isTodo = w.type === "todo";
              const hasAction =
                (w.type === "action" || w.type === "todo") &&
                (Boolean(w.url) || Boolean(w.openApp));

              const rightLabel =
                w.type === "command"
                  ? "↵"
                  : w.type === "todo"
                    ? hasAction
                      ? "↵ OPEN"
                      : getTodoStatus(w) === "archived"
                        ? "ARCH"
                        : getTodoStatus(w) === "done"
                          ? "DONE"
                          : "TODO"
                    : w.durationMinutes
                      ? `${Math.round(w.durationMinutes * 60)}s`
                      : "";

              const subtitle =
                "description" in w && w.description
                  ? w.description
                  : w.keywords.join(", ");

              const faded = isTodo ? isFadedTodo(w) : false;

              return (
                <div
                  key={w.id}
                  data-index={idx}
                  onMouseEnter={() => onSelect(idx)}
                  onClick={() => onRun(idx)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    cursor: "pointer",
                    background: isSelected
                      ? "rgba(255,255,255,0.10)"
                      : "transparent",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    opacity: faded ? 0.75 : 1,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        textDecoration: faded ? "line-through" : "none",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {isTodo ? (
                        <span style={{ opacity: faded ? 0.95 : 0.6 }}>
                          {markerForTodo(w)}
                        </span>
                      ) : null}

                      <span style={{ minWidth: 0, overflow: "hidden" }}>
                        {w.name}
                      </span>
                    </div>

                    <div style={{ fontSize: 11, opacity: 0.7 }}>{subtitle}</div>
                  </div>

                  <div style={{ fontSize: 11, opacity: 0.7 }}>{rightLabel}</div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
