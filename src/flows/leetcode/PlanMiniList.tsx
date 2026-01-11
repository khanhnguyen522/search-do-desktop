import { useEffect, useRef } from "react";
import type { PracticeState } from "../../app/engine";
import type { PlanItem, Problem } from "./leetcodeData";

export function PlanMiniList(props: {
  items: { item: PlanItem; problem?: Problem }[];
  cursor: number;
  runningProblemId: string | null;
  timers: PracticeState["timers"];
}) {
  const { items, cursor, runningProblemId, timers } = props;

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const el = container.querySelector(
      `[data-plan-index="${cursor}"]`
    ) as HTMLElement | null;

    if (!el) return;

    // ✅ keep selected item in view INSIDE this container (no outer scroll)
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;

    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;

    if (top < viewTop) {
      container.scrollTop = top;
    } else if (bottom > viewBottom) {
      container.scrollTop = bottom - container.clientHeight;
    }
  }, [cursor]);

  return (
    <div
      ref={containerRef}
      style={{
        height: "100%",
        minHeight: 0,
        overflowY: "auto",
        paddingRight: 4,
      }}
    >
      {items.map(({ item, problem }, i) => {
        const selected = i === cursor;

        const t = timers[item.problemId];
        const isRunning = runningProblemId === item.problemId;

        const bg = selected
          ? "rgba(255,255,255,0.10)"
          : isRunning
          ? "rgba(0, 255, 0, 0.08)"
          : "transparent";

        const rightLabel =
          item.badge === "DONE"
            ? "DONE"
            : isRunning
            ? "▶ RUNNING"
            : t?.status === "paused"
            ? "PAUSED"
            : "IDLE";

        const rightOpacity =
          rightLabel === "▶ RUNNING"
            ? 0.95
            : rightLabel === "PAUSED"
            ? 0.75
            : 0.65;

        return (
          <div
            key={item.problemId}
            data-plan-index={i}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              background: bg,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
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
                }}
              >
                {problem ? problem.title : item.problemId}
              </div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>
                {problem
                  ? `${problem.difficulty}${
                      problem.pattern ? ` • ${problem.pattern}` : ""
                    }`
                  : ""}
              </div>
            </div>

            <div
              style={{
                fontSize: 11,
                opacity: rightOpacity,
                whiteSpace: "nowrap",
                marginLeft: 12,
              }}
            >
              {rightLabel}
            </div>
          </div>
        );
      })}
    </div>
  );
}
