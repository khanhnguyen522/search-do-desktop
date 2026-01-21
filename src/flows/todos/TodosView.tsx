import type { Workflow, TodoTab } from "../../app/engine";
import { useEffect, useMemo, useRef } from "react";

type Todo = Extract<Workflow, { type: "todo" }>;

type Props = {
  todos: Todo[];
  tab: TodoTab;
  tagFilter: string | null;
  selectedIndex: number;
  onSelect: (index: number) => void;
};

function uniqTags(todos: Todo[]) {
  const set = new Set<string>();
  for (const t of todos) for (const tag of t.tags) set.add(tag);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function TabChip({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "4px 8px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.12)",
        background: active ? "rgba(255,255,255,0.10)" : "transparent",
        opacity: active ? 1 : 0.65,
        userSelect: "none",
      }}
    >
      {label}
    </span>
  );
}

export function TodosView({
  todos,
  tab,
  tagFilter,
  selectedIndex,
  onSelect,
}: Props) {
  const tags = useMemo(() => uniqTags(todos), [todos]);

  const filtered = useMemo(() => {
    return todos
      .filter((t) => t.status === tab)
      .filter((t) => (tagFilter ? t.tags.includes(tagFilter) : true))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [todos, tab, tagFilter]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const el = container.querySelector(
      `[data-todo-index="${selectedIndex}"]`,
    ) as HTMLElement | null;

    if (!el) return;
    el.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const subLabel =
    tab === "active" ? "Active" : tab === "done" ? "Done" : "Archived";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          <TabChip active={tab === "active"} label="1 Active" />
          <TabChip active={tab === "done"} label="2 Done" />
          <TabChip active={tab === "archived"} label="3 Archived" />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {tagFilter && (
            <span
              style={{
                fontSize: 12,
                padding: "4px 8px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                opacity: 0.9,
                userSelect: "none",
              }}
              title="Filtered by tag"
            >
              #{tagFilter}
            </span>
          )}
          <span style={{ fontSize: 12, opacity: 0.7, userSelect: "none" }}>
            {filtered.length} {subLabel}
          </span>
        </div>
      </div>

      {tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              opacity: tagFilter === null ? 0.95 : 0.55,
              border: "1px solid rgba(255,255,255,0.12)",
              padding: "2px 8px",
              borderRadius: 999,
              userSelect: "none",
            }}
            title="No tag filter"
          >
            all
          </span>

          {tags.map((t) => (
            <span
              key={t}
              style={{
                fontSize: 11,
                opacity: tagFilter === t ? 0.95 : 0.55,
                border: "1px solid rgba(255,255,255,0.12)",
                padding: "2px 8px",
                borderRadius: 999,
                userSelect: "none",
              }}
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      <div
        ref={containerRef}
        style={{
          maxHeight: 540,
          overflowY: "auto",
          paddingRight: 4,
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ opacity: 0.65 }}>
            No todos in <b>{tab}</b>
          </div>
        ) : (
          filtered.map((t, i) => {
            const selected = i === selectedIndex;
            const isDone = t.status !== "active";

            return (
              <div
                key={t.id}
                data-todo-index={i}
                onMouseEnter={() => onSelect(i)}
                style={{
                  padding: "9px 10px",
                  borderRadius: 12,
                  background: selected
                    ? "rgba(255,255,255,0.10)"
                    : "transparent",
                  border: selected
                    ? "1px solid rgba(255,255,255,0.12)"
                    : "1px solid transparent",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 650,
                      fontSize: 13,
                      textDecoration: isDone ? "line-through" : "none",
                      opacity: isDone ? 0.7 : 1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {t.name}
                  </div>

                  <div style={{ fontSize: 11, opacity: 0.65 }}>
                    {t.tags.length ? t.tags.map((x) => `#${x}`).join(" ") : "—"}
                  </div>
                </div>

                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {t.status === "active"
                    ? "○"
                    : t.status === "done"
                      ? "✓"
                      : "⧉"}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div style={{ fontSize: 11, opacity: 0.65, userSelect: "none" }}>
        Enter: toggle • Cmd/Ctrl+A: archive • Cmd/Ctrl+⌫: delete • Tab: switch •
        Esc: back
      </div>
    </div>
  );
}
