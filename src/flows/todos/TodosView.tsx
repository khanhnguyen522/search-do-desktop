import { useEffect, useMemo, useRef } from "react";
import type { Workflow, TodoTab, TodosMode } from "../../app/engine";
import { MiniMonthCalendar } from "../../ui/MiniMonthCalendar";

type Todo = Extract<Workflow, { type: "todo" }>;

type Props = {
  todos: Todo[];
  tab: TodoTab;
  tagFilter: string | null;
  selectedIndex: number;
  onSelect: (index: number) => void;

  mode: TodosMode;
  selectedDayStartMs: number;

  onSetMode: (mode: TodosMode) => void;
  onShiftDay: (delta: number) => void;
  onToday: () => void;
  onSetDay: (dayStartMs: number) => void;

  calendarOpen: boolean;
  onSetCalendarOpen: (open: boolean) => void;
};

function startOfLocalDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function uniqTags(todos: Todo[]) {
  const set = new Set<string>();
  for (const t of todos) for (const tag of t.tags) set.add(tag);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function Chip({
  active,
  label,
  onClick,
  title,
  compact,
}: {
  active: boolean;
  label: string;
  onClick?: () => void;
  title?: string;
  compact?: boolean;
}) {
  return (
    <span
      title={title}
      onMouseDown={(e) => {
        if (!onClick) return;
        e.preventDefault();
        onClick();
      }}
      style={{
        cursor: onClick ? "default" : "default",
        fontSize: 12,
        padding: compact ? "3px 8px" : "4px 10px",
        borderRadius: 999,
        border: active
          ? "1px solid rgba(255,255,255,0.22)"
          : "1px solid rgba(255,255,255,0.12)",
        background: active ? "rgba(255,255,255,0.12)" : "transparent",
        opacity: active ? 1 : 0.6,
        userSelect: "none",
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {label}
    </span>
  );
}

function IconBtn({
  label,
  onClick,
  title,
}: {
  label: string;
  onClick: () => void;
  title?: string;
}) {
  return (
    <span
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      style={{
        fontSize: 12,
        padding: "4px 8px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.04)",
        opacity: 0.9,
        userSelect: "none",
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 28,
      }}
    >
      {label}
    </span>
  );
}

function toDateInputValue(dayStartMs: number) {
  const d = new Date(dayStartMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function fromDateInputValue(v: string) {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

function formatDayLabel(dayStartMs: number) {
  const d = new Date(dayStartMs);
  const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
  const month = d.toLocaleDateString(undefined, { month: "short" });
  const day = d.getDate();
  const year = d.getFullYear();
  return `${weekday}, ${month} ${day}, ${year}`;
}

function ymdFromMs(dayStartMs: number) {
  const d = new Date(dayStartMs);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const da = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${da}`;
}

export function TodosView({
  todos,
  tab,
  tagFilter,
  selectedIndex,
  onSelect,
  mode,
  selectedDayStartMs,
  onSetMode,
  onShiftDay,
  onToday,
  onSetDay,
  calendarOpen,
  onSetCalendarOpen,
}: Props) {
  const tags = useMemo(() => uniqTags(todos), [todos]);

  const dayCount = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of todos) {
      if (t.status !== tab) continue;
      if (typeof t.dueAt !== "number") continue;
      const key = ymdFromMs(startOfLocalDay(t.dueAt));
      map[key] = (map[key] ?? 0) + 1;
    }
    return map;
  }, [todos, tab]);

  const filtered = useMemo(() => {
    return todos
      .filter((t) => t.status === tab)
      .filter((t) => (tagFilter ? t.tags.includes(tagFilter) : true));
  }, [todos, tab, tagFilter]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const el = container.querySelector(
      `[data-todo-index="${selectedIndex}"]`
    ) as HTMLElement | null;

    if (!el) return;
    el.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const tabLabel =
    tab === "active" ? "Active" : tab === "done" ? "Done" : "Archived";

  const dayLabel = formatDayLabel(selectedDayStartMs);

  const calendarWrapRef = useRef<HTMLDivElement>(null);
  const listFocusRef = useRef<HTMLDivElement>(null);

  function focusList() {
    requestAnimationFrame(() => listFocusRef.current?.focus());
  }

  function openCalendar() {
    if (mode !== "daily") return;
    onSetCalendarOpen(true);
  }

  function closeCalendar() {
    onSetCalendarOpen(false);
    focusList();
  }

  // When calendar opens: focus wrapper
  useEffect(() => {
    if (!calendarOpen) return;
    requestAnimationFrame(() => {
      const a = document.activeElement as HTMLElement | null;
      a?.blur?.();
      calendarWrapRef.current?.focus({ preventScroll: true });
    });
  }, [calendarOpen]);

  // If leave daily (Scheduled) => close calendar
  useEffect(() => {
    if (mode !== "daily" && calendarOpen) onSetCalendarOpen(false);
  }, [mode, calendarOpen, onSetCalendarOpen]);

  const showScheduledControls = mode === "daily";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        gap: 10,
      }}
    >
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.04)",
          borderRadius: 14,
          padding: "10px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Chip
              active={mode === "daily"}
              label="Scheduled"
              onClick={() => onSetMode("daily")}
              title="Scheduled (Cmd/Ctrl+D)"
            />
            <Chip
              active={mode === "occasional"}
              label="Occasional"
              onClick={() => onSetMode("occasional")}
              title="Occasional (Cmd/Ctrl+O)"
            />
          </div>

          <div
            style={{
              fontSize: 12,
              opacity: 0.75,
              userSelect: "none",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "55%",
              textAlign: "right",
            }}
            title={showScheduledControls ? dayLabel : "Occasional list"}
          >
            {showScheduledControls ? dayLabel : "Occasional list"}
          </div>
        </div>

        {showScheduledControls && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
              <IconBtn
                label="←"
                onClick={() => onShiftDay(-1)}
                title="Previous day (Cmd/Ctrl+←)"
              />

              <input
                type="date"
                value={toDateInputValue(selectedDayStartMs)}
                onChange={(e) => onSetDay(fromDateInputValue(e.target.value))}
                title="Jump to a date"
                style={{
                  fontSize: 12,
                  padding: "4px 8px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.10)",
                  color: "inherit",
                  opacity: 0.95,
                  width: 100,
                }}
              />

              <IconBtn
                label="→"
                onClick={() => onShiftDay(1)}
                title="Next day (Cmd/Ctrl+→)"
              />
              <Chip
                compact
                active={false}
                label="Today"
                onClick={onToday}
                title="Jump to Today (Cmd/Ctrl+T)"
              />
              <Chip
                compact
                active={calendarOpen}
                label="Calendar"
                onClick={() =>
                  calendarOpen ? closeCalendar() : openCalendar()
                }
                title="Toggle calendar (C / Cmd+Shift+O)"
              />
            </div>
          </div>
        )}
      </div>

      {showScheduledControls && calendarOpen && (
        <div
          ref={calendarWrapRef}
          tabIndex={0}
          style={{ outline: "none" }}
          onMouseDown={(e) => {
            e.stopPropagation();
            requestAnimationFrame(() =>
              calendarWrapRef.current?.focus({ preventScroll: true })
            );
          }}
        >
          <MiniMonthCalendar
            selectedDayStartMs={selectedDayStartMs}
            dayCount={dayCount}
            onPickDayStartMs={onSetDay}
            onRequestClose={closeCalendar}
          />
        </div>
      )}

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
              background: "rgba(255,255,255,0.03)",
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
                background:
                  tagFilter === t ? "rgba(255,255,255,0.10)" : "transparent",
              }}
              title={`#${t}`}
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      <div
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          paddingRight: 4,
        }}
        onMouseDown={() => {
          if (calendarOpen) onSetCalendarOpen(false);
        }}
      >
        <div ref={listFocusRef} tabIndex={0} style={{ outline: "none" }} />

        {filtered.length === 0 ? (
          <div style={{ opacity: 0.65 }}>
            No <b>{tab}</b> todos
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

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Chip active={tab === "active"} label="1 Active" />
          <Chip active={tab === "done"} label="2 Done" />
          <Chip active={tab === "archived"} label="3 Archived" />
        </div>

        <span style={{ fontSize: 12, opacity: 0.7, userSelect: "none" }}>
          {filtered.length} {tabLabel}
        </span>
      </div>

      <div
        style={{
          marginTop: "auto",
          fontSize: 11,
          opacity: 0.65,
          userSelect: "none",
          paddingTop: 6,
        }}
      >
        Enter: toggle • Cmd/Ctrl+A: archive • Cmd/Ctrl+⌫: delete • Tab: switch •
        Esc: back
        {showScheduledControls
          ? ` • Calendar: ${
              calendarOpen ? "Esc to close" : "C / Cmd+Shift+O to open"
            } • Cmd/Ctrl+←/→ • Cmd/Ctrl+T: Today`
          : ""}
      </div>
    </div>
  );
}
