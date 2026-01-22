import React, { useMemo, useState } from "react";

type Props = {
  selectedDayStartMs: number;

  // map YYYY-MM-DD -> count todos
  dayCount: Record<string, number>;

  onPickDayStartMs: (dayStartMs: number) => void;
  onRequestClose?: () => void;
};

function startOfLocalDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function addDaysLocal(dayStartMs: number, days: number) {
  const d = new Date(dayStartMs);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function ymdLocal(ts: number) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const da = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${da}`;
}

// start of week (Sunday)
function startOfWeekLocal(dayStartMs: number) {
  const d = new Date(dayStartMs);
  const dow = d.getDay(); // 0=Sun
  return addDaysLocal(dayStartMs, -dow);
}

function pastelDotColor(count: number) {
  const a = Math.min(0.95, 0.25 + count * 0.12);
  return `rgba(255,255,255,${a})`;
}

function Chip({
  active,
  label,
  onClick,
  title,
}: {
  active: boolean;
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
        fontSize: 11,
        padding: "3px 8px",
        borderRadius: 999,
        border: active
          ? "1px solid rgba(255,255,255,0.22)"
          : "1px solid rgba(255,255,255,0.10)",
        background: active ? "rgba(255,255,255,0.10)" : "transparent",
        opacity: active ? 1 : 0.65,
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

export const MiniMonthCalendar = React.forwardRef<HTMLDivElement, Props>(
  function MiniMonthCalendar(
    { selectedDayStartMs, dayCount, onPickDayStartMs, onRequestClose }: Props,
    ref
  ) {
    const selectedStart = startOfLocalDay(selectedDayStartMs);
    const todayStart = startOfLocalDay(Date.now());

    // ✅ local UI state: month/week toggle
    const [view, setView] = useState<"month" | "week">("week");

    const monthStart = useMemo(() => {
      const d = new Date(selectedStart);
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d;
    }, [selectedStart]);

    const monthLabel = useMemo(() => {
      return monthStart.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
    }, [monthStart]);

    const weekStart = useMemo(
      () => startOfWeekLocal(selectedStart),
      [selectedStart]
    );

    const weekLabel = useMemo(() => {
      const a = new Date(weekStart);
      const b = new Date(addDaysLocal(weekStart, 6));
      const left = a.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      const right = b.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return `${left} – ${right}`;
    }, [weekStart]);

    const monthCells = useMemo(() => {
      const first = new Date(monthStart);
      const firstDow = first.getDay(); // 0=Sun
      const gridStart = new Date(first);
      gridStart.setDate(first.getDate() - firstDow);

      const out: {
        ts: number;
        inMonth: boolean;
        ymd: string;
        day: number;
        count: number;
      }[] = [];

      for (let i = 0; i < 42; i++) {
        const d = new Date(gridStart);
        d.setDate(gridStart.getDate() + i);
        d.setHours(0, 0, 0, 0);
        const ts = d.getTime();
        const ymd = ymdLocal(ts);
        out.push({
          ts,
          ymd,
          day: d.getDate(),
          inMonth: d.getMonth() === monthStart.getMonth(),
          count: dayCount[ymd] ?? 0,
        });
      }
      return out;
    }, [monthStart, dayCount]);

    const weekCells = useMemo(() => {
      const out: {
        ts: number;
        ymd: string;
        day: number;
        count: number;
      }[] = [];
      for (let i = 0; i < 7; i++) {
        const ts = addDaysLocal(weekStart, i);
        const ymd = ymdLocal(ts);
        const d = new Date(ts);
        out.push({
          ts,
          ymd,
          day: d.getDate(),
          count: dayCount[ymd] ?? 0,
        });
      }
      return out;
    }, [weekStart, dayCount]);

    function pickTs(ts: number) {
      onPickDayStartMs(startOfLocalDay(ts));
    }

    function onKeyDown(e: React.KeyboardEvent) {
      const step =
        e.key === "ArrowLeft"
          ? -1
          : e.key === "ArrowRight"
            ? 1
            : e.key === "ArrowUp"
              ? -7
              : e.key === "ArrowDown"
                ? 7
                : 0;

      if (step !== 0) {
        e.preventDefault();
        pickTs(addDaysLocal(selectedStart, step));
        return;
      }

      if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        pickTs(Date.now());
        return;
      }

      if (e.key === "Escape" && onRequestClose) {
        e.preventDefault();
        onRequestClose();
      }
    }

    const dow = ["S", "M", "T", "W", "T", "F", "S"];

    const Cell = ({
      ts,
      ymd,
      day,
      count,
      dim,
    }: {
      ts: number;
      ymd: string;
      day: number;
      count: number;
      dim?: boolean;
    }) => {
      const isSelected = startOfLocalDay(ts) === selectedStart;
      const isToday = startOfLocalDay(ts) === todayStart;

      // ✅ Today nổi bật hơn (nhưng vẫn nhường ưu tiên selected)
      const border = isSelected
        ? "1px solid rgba(255,255,255,0.30)"
        : isToday
          ? "1px solid rgba(255,255,255,0.22)"
          : "1px solid rgba(255,255,255,0.08)";

      const background = isSelected
        ? "rgba(255,255,255,0.12)"
        : isToday
          ? "rgba(255,255,255,0.06)"
          : "transparent";

      const opacity = dim ? 0.35 : 1;

      return (
        <div
          key={ymd}
          onMouseDown={(e) => {
            e.preventDefault();
            pickTs(ts);
          }}
          title={
            ymd +
            (count ? ` • ${count} todos` : "") +
            (isToday ? " • Today" : "")
          }
          style={{
            height: 30,
            borderRadius: 10,
            border,
            background,
            opacity,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            userSelect: "none",
          }}
        >
          <span
            style={{
              fontSize: 12,
              opacity: isSelected ? 1 : isToday ? 0.95 : 0.85,
              fontWeight: isSelected ? 650 : isToday ? 600 : 500,
            }}
          >
            {day}
          </span>

          {count > 0 ? (
            <span
              style={{
                position: "absolute",
                bottom: 4,
                width: 7,
                height: 7,
                borderRadius: 999,
                background: pastelDotColor(count),
                boxShadow: "0 0 10px rgba(255,255,255,0.10)",
              }}
            />
          ) : null}
        </div>
      );
    };

    return (
      <div
        ref={ref}
        tabIndex={0}
        onKeyDown={onKeyDown}
        style={{
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 14,
          padding: 10,
          background: "rgba(255,255,255,0.04)",
          outline: "none",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
            gap: 10,
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontSize: 12,
                opacity: 0.88,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {view === "month" ? monthLabel : weekLabel}
            </div>
            {/* <div style={{ fontSize: 11, opacity: 0.6 }}>
              Arrows move • T today • Esc close
            </div> */}
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Chip
              active={view === "week"}
              label="Week"
              onClick={() => setView("week")}
            />
            <Chip
              active={view === "month"}
              label="Month"
              onClick={() => setView("month")}
            />
          </div>
        </div>

        {/* DOW */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 6,
            marginBottom: 6,
          }}
        >
          {dow.map((x) => (
            <div
              key={x}
              style={{ fontSize: 10, opacity: 0.55, textAlign: "center" }}
            >
              {x}
            </div>
          ))}
        </div>

        {/* Body */}
        {view === "month" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 6,
            }}
          >
            {monthCells.map((c) => (
              <Cell
                key={c.ymd}
                ts={c.ts}
                ymd={c.ymd}
                day={c.day}
                count={c.count}
                dim={!c.inMonth}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 6,
            }}
          >
            {weekCells.map((c) => (
              <Cell
                key={c.ymd}
                ts={c.ts}
                ymd={c.ymd}
                day={c.day}
                count={c.count}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
);
