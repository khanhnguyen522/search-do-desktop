import React, { useEffect, useMemo } from "react";

type Props = {
  selectedDayStartMs: number;

  // map YYYY-MM-DD -> count todos
  dayCount: Record<string, number>;

  // gọi khi user chọn 1 ngày (set selectedDayStartMs mới)
  onPickDayStartMs: (dayStartMs: number) => void;

  // optional
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

function pastelDotColor(count: number) {
  const a = Math.min(0.95, 0.25 + count * 0.12);
  return `rgba(255,255,255,${a})`;
}

export const MiniMonthCalendar = React.forwardRef<HTMLDivElement, Props>(
  function MiniMonthCalendar(
    { selectedDayStartMs, dayCount, onPickDayStartMs, onRequestClose }: Props,
    ref
  ) {
    const selectedStart = startOfLocalDay(selectedDayStartMs);

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

    const cells = useMemo(() => {
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

      if (e.key === "Enter") {
        e.preventDefault();
        return;
      }

      if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        pickTs(Date.now());
        return;
      }

      if (e.key === "Escape") {
        if (onRequestClose) {
          e.preventDefault();
          onRequestClose();
        }
      }
    }

    const dow = ["S", "M", "T", "W", "T", "F", "S"];

    useEffect(() => {
      // no-op (reserved)
    }, [selectedStart]);

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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.85 }}>{monthLabel}</div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>
            Arrows move • T today • Esc close
          </div>
        </div>

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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 6,
          }}
        >
          {cells.map((c) => {
            const cStart = startOfLocalDay(c.ts);
            const todayStart = startOfLocalDay(Date.now());
            const isSelected = cStart === selectedStart;
            const isToday = cStart === todayStart;

            const border = isSelected
              ? "1px solid rgba(255,255,255,0.35)"
              : isToday
                ? "1px dashed rgba(255,255,255,0.45)"
                : "1px solid rgba(255,255,255,0.08)";

            const background = isSelected
              ? "rgba(255,255,255,0.16)"
              : isToday
                ? "rgba(255,255,255,0.08)"
                : "transparent";

            return (
              <div
                key={c.ymd}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickTs(c.ts);
                }}
                title={c.ymd + (c.count ? ` • ${c.count} todos` : "")}
                style={{
                  height: 28,
                  borderRadius: 10,
                  border,
                  background,
                  opacity: c.inMonth ? 1 : 0.35,
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
                    fontWeight: isToday ? 650 : 400,
                    opacity: isSelected ? 1 : isToday ? 0.95 : 0.85,
                  }}
                >
                  {c.day}
                </span>

                {c.count > 0 ? (
                  <span
                    style={{
                      position: "absolute",
                      bottom: 4,
                      width: isToday ? 8 : 7,
                      height: isToday ? 8 : 7,
                      borderRadius: 999,
                      background: pastelDotColor(c.count),
                      boxShadow: isToday
                        ? "0 0 14px rgba(255,255,255,0.25)"
                        : "0 0 10px rgba(255,255,255,0.10)",
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);
