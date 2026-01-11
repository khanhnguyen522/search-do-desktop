import type { PracticePhase } from "../../app/engine";
import type { Problem } from "./leetcodeData";

function mmss(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function CurrentCard(props: {
  problem?: Problem;
  phase: PracticePhase;
  remainingSec: number | null;
}) {
  const { problem, phase, remainingSec } = props;

  return (
    <div
      style={{
        padding: "12px 12px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 14,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {problem ? problem.title : "No current problem"}
          </div>
          <div style={{ fontSize: 11, opacity: 0.75 }}>
            {problem
              ? `${problem.difficulty}${
                  problem.pattern ? ` • ${problem.pattern}` : ""
                }`
              : ""}
          </div>
        </div>

        <div style={{ fontSize: 11, opacity: 0.8 }}>{phase.toUpperCase()}</div>
      </div>

      <div
        style={{
          marginTop: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 11, opacity: 0.75 }}>
          Enter: Open • V: Video • N: Next • 1–4: Rate
        </div>
        <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
          {remainingSec === null ? "--:--" : mmss(remainingSec)}
        </div>
      </div>
    </div>
  );
}
