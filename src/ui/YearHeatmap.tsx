import { useMemo, useRef, useState } from "react";

type Props = {
  countByYmd: Record<string, number>;
  range: "6m" | "12m";
  endTs?: number;
  cell?: number;
  gap?: number;
  monthGap?: number;
};

type DayCell = {
  ts: number;
  ymd: string;
  n: number;
  isInRange: boolean;
  isToday: boolean;
  inThisMonth: boolean;
};

type MonthBlock = {
  monthStart: number;
  monthEnd: number;
  label: string;
  columns: DayCell[][];
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
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function monthShort(ts: number) {
  return new Date(ts).toLocaleString(undefined, { month: "short" });
}

function weekdayShort(ts: number) {
  return new Date(ts).toLocaleString(undefined, { weekday: "short" });
}

function startOfMonthLocal(ts: number) {
  const d = new Date(ts);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfMonthLocal(ts: number) {
  const d = new Date(ts);
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function addMonthsLocal(ts: number, months: number) {
  const d = new Date(ts);
  d.setMonth(d.getMonth() + months);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeekSundayLocal(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const pad = d.getDay();
  d.setDate(d.getDate() - pad);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

type HoverInfo = {
  visible: boolean;
  x: number;
  y: number;
  text: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function YearHeatmap({
  countByYmd,
  range,
  endTs,
  cell = 11,
  gap = 3,
  monthGap = 10,
}: Props) {
  const end = startOfLocalDay(endTs ?? Date.now());
  const days = range === "6m" ? 183 : 365;
  const start = addDaysLocal(end, -(days - 1));

  const wrapRef = useRef<HTMLDivElement | null>(null);

  const { months, totalActiveDays } = useMemo(() => {
    let activeDays = 0;

    const monthStarts: number[] = [];
    let cur = startOfMonthLocal(start);
    const last = startOfMonthLocal(end);

    while (cur <= last) {
      monthStarts.push(cur);
      cur = addMonthsLocal(cur, 1);
    }

    const ms: MonthBlock[] = monthStarts.map((mStart) => {
      const mEnd = endOfMonthLocal(mStart);

      const gridStart = startOfWeekSundayLocal(mStart);
      const clampEnd = Math.min(mEnd, end);

      const totalDays =
        Math.ceil((clampEnd - gridStart) / (24 * 3600 * 1000)) + 1;
      const weekCols = Math.ceil(totalDays / 7);

      const columns: DayCell[][] = [];

      for (let c = 0; c < weekCols; c++) {
        const col: DayCell[] = [];
        for (let r = 0; r < 7; r++) {
          const t = addDaysLocal(gridStart, c * 7 + r);

          const inThisMonth = t >= mStart && t <= mEnd;
          const inOverall = t >= start && t <= end;
          const isInRange = inThisMonth && inOverall;

          const ymd = ymdLocal(t);
          const n = isInRange ? (countByYmd[ymd] ?? 0) : 0;
          if (isInRange && n > 0) activeDays += 1;

          col.push({
            ts: t,
            ymd,
            n,
            isInRange,
            isToday: t === end,
            inThisMonth,
          });
        }
        columns.push(col);
      }

      return {
        monthStart: mStart,
        monthEnd: mEnd,
        label: monthShort(mStart),
        columns,
      };
    });

    return { months: ms, totalActiveDays: activeDays };
  }, [countByYmd, start, end]);

  const intensityBg = (n: number) => {
    if (n <= 0) return "rgba(255,255,255,0.06)";
    if (n === 1) return "rgba(34,197,94,0.18)";
    if (n === 2) return "rgba(34,197,94,0.36)";
    if (n === 3) return "rgba(34,197,94,0.58)";
    return "rgba(34,197,94,0.82)"; // 4+ đậm nhất
  };

  const weekdayLabels = ["Mon", "Wed", "Fri"];

  const [hover, setHover] = useState<HoverInfo>({
    visible: false,
    x: 0,
    y: 0,
    text: "",
  });

  const hideHover = () =>
    setHover((h) => (h.visible ? { ...h, visible: false } : h));

  const showHover = (e: React.MouseEvent, text: string) => {
    const pad = 10;
    const tooltipW = 240;
    const tooltipH = 44;
    const x = clamp(e.clientX + 12, pad, window.innerWidth - tooltipW - pad);
    const y = clamp(e.clientY + 12, pad, window.innerHeight - tooltipH - pad);

    setHover({ visible: true, x, y, text });
  };

  const moveHover = (e: React.MouseEvent) => {
    setHover((h) => {
      if (!h.visible) return h;
      const pad = 10;
      const tooltipW = 240;
      const tooltipH = 44;
      const x = clamp(e.clientX + 12, pad, window.innerWidth - tooltipW - pad);
      const y = clamp(e.clientY + 12, pad, window.innerHeight - tooltipH - pad);
      if (x === h.x && y === h.y) return h;
      return { ...h, x, y };
    });
  };

  const makeTooltipText = (d: DayCell) => {
    const isPastOrToday = d.ts <= end;
    const isVisibleDay = d.inThisMonth && isPastOrToday;

    if (!isVisibleDay) return "";

    const day = `${weekdayShort(d.ts)}, ${d.ymd}`;
    const solved = `${d.n} solved`;
    const today = d.isToday ? " (today)" : "";
    if (d.isInRange) return `${day}${today}: ${solved}`;
    return `${day}${today}: out of range`;
  };

  return (
    <div
      ref={wrapRef}
      style={{ width: "100%", minWidth: 0, position: "relative" }}
      onMouseLeave={hideHover}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 8,
          userSelect: "none",
        }}
      >
        <div style={{ fontSize: 11, opacity: 0.75 }}>
          {totalActiveDays} active days in the past{" "}
          {range === "6m" ? "6" : "12"} months
        </div>
        {/* <div style={{ fontSize: 11, opacity: 0.75 }}>
          Hover a day to see details
        </div> */}
      </div>

      <div
        style={{
          width: "100%",
          overflowX: "auto",
          overflowY: "hidden",
          WebkitOverflowScrolling: "touch",
          paddingBottom: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          {/* Y labels */}
          <div
            style={{
              width: 28,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              paddingTop: cell + 6,
              userSelect: "none",
              opacity: 0.75,
            }}
          >
            {Array.from({ length: 7 }).map((_, r) => {
              const label =
                r === 1
                  ? weekdayLabels[0]
                  : r === 3
                    ? weekdayLabels[1]
                    : r === 5
                      ? weekdayLabels[2]
                      : "";
              return (
                <div
                  key={r}
                  style={{
                    height: cell,
                    marginBottom: r === 6 ? 0 : gap,
                    fontSize: 10,
                    lineHeight: `${cell}px`,
                  }}
                >
                  {label}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            {months.map((m, mi) => {
              const isLastMonth = mi === months.length - 1;

              return (
                <div
                  key={m.monthStart}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    marginRight: isLastMonth ? 0 : monthGap,
                  }}
                >
                  <div
                    style={{
                      height: cell,
                      fontSize: 10,
                      lineHeight: `${cell}px`,
                      userSelect: "none",
                      opacity: 0.75,
                      marginBottom: 6,
                      textAlign: "center",
                      width:
                        m.columns.length * cell + (m.columns.length - 1) * gap,
                    }}
                  >
                    {m.label}
                  </div>

                  <div style={{ display: "flex" }}>
                    {m.columns.map((col, cIdx) => {
                      const isLastCol = cIdx === m.columns.length - 1;

                      return (
                        <div
                          key={cIdx}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            marginRight: isLastCol ? 0 : gap,
                          }}
                        >
                          {col.map((d, rIdx) => {
                            const placeholder =
                              d.inThisMonth && !d.isInRange && d.ts <= end;

                            const bg = d.isInRange
                              ? intensityBg(d.n)
                              : placeholder
                                ? "rgba(255,255,255,0.04)"
                                : "transparent";

                            const opacity = d.isInRange
                              ? 1
                              : placeholder
                                ? 0.9
                                : 0;

                            const tooltipText = makeTooltipText(d);
                            const canHover =
                              opacity !== 0 && tooltipText.length > 0;

                            return (
                              <div
                                key={`${cIdx}-${rIdx}`}
                                role={canHover ? "button" : undefined}
                                aria-label={canHover ? tooltipText : undefined}
                                tabIndex={canHover ? 0 : -1}
                                onMouseEnter={(e) =>
                                  canHover
                                    ? showHover(e, tooltipText)
                                    : undefined
                                }
                                onMouseMove={(e) =>
                                  canHover ? moveHover(e) : undefined
                                }
                                onMouseLeave={hideHover}
                                onFocus={(e) =>
                                  canHover
                                    ? showHover(
                                        {
                                          clientX:
                                            e.currentTarget.getBoundingClientRect()
                                              .left + 8,
                                          clientY:
                                            e.currentTarget.getBoundingClientRect()
                                              .top + 8,
                                        } as unknown as React.MouseEvent,
                                        tooltipText
                                      )
                                    : undefined
                                }
                                onBlur={hideHover}
                                style={{
                                  width: cell,
                                  height: cell,
                                  borderRadius: 3,
                                  background: bg,
                                  border:
                                    opacity === 0
                                      ? "1px solid transparent"
                                      : d.isToday
                                        ? "1px solid rgba(255,255,255,0.55)"
                                        : "1px solid rgba(255,255,255,0.10)",
                                  opacity,
                                  marginBottom: rIdx === 6 ? 0 : gap,
                                  cursor: canHover ? "default" : "default",
                                  outline: "none",
                                }}
                              />
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 6,
          userSelect: "none",
          opacity: 0.8,
        }}
      >
        <div style={{ fontSize: 11 }}>Less</div>
        {[0, 1, 2, 3].map((n) => (
          <div
            key={n}
            style={{
              width: cell,
              height: cell,
              borderRadius: 3,
              background: intensityBg(n),
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          />
        ))}
        <div style={{ fontSize: 11 }}>More</div>
      </div>

      {hover.visible && (
        <div
          style={{
            position: "fixed",
            left: hover.x,
            top: hover.y,
            zIndex: 9999,
            pointerEvents: "none",
            maxWidth: 260,
            padding: "8px 10px",
            borderRadius: 10,
            background: "rgba(10,10,12,0.92)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            color: "rgba(255,255,255,0.92)",
            fontSize: 11,
            lineHeight: "14px",
            whiteSpace: "nowrap",
          }}
        >
          {hover.text}
        </div>
      )}
    </div>
  );
}
