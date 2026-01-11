import type { PracticeState } from "../../app/engine";
import { CurrentCard } from "./CurrentCard";
import { PlanMiniList } from "./PlanMiniList";
import { getProblemById } from "./leetcodeData";

export function PracticeBody({ practice }: { practice: PracticeState }) {
  const cursorItem = practice.plan[practice.cursor];

  // ✅ show running problem on card if any; otherwise show cursor
  const displayId = practice.runningProblemId ?? cursorItem?.problemId;

  const displayPlanItem = displayId
    ? practice.plan.find((x) => x.problemId === displayId)
    : undefined;

  const displayProblem = displayId ? getProblemById(displayId) : undefined;

  const remainingSec = displayId
    ? practice.timers[displayId]?.remainingSec ?? null
    : null;

  const status = displayId
    ? practice.timers[displayId]?.status ?? "idle"
    : "idle";

  const items = practice.plan.map((it) => ({
    item: it,
    problem: getProblemById(it.problemId),
  }));

  return (
    <div
      style={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <CurrentCard
        problem={displayProblem}
        phase={practice.phase}
        remainingSec={remainingSec}
      />

      <div style={{ flex: 1, minHeight: 0, marginTop: 10 }}>
        <PlanMiniList
          items={items}
          cursor={practice.cursor}
          runningProblemId={practice.runningProblemId}
          timers={practice.timers}
        />
      </div>
    </div>
  );
}
