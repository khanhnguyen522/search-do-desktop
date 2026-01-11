// src/app/engine.ts
export type View = "search" | "todayPlan" | "current";

export type CommandAction =
  | { action: "START_FLOW"; flow: "leetcode" }
  | { action: "GO_VIEW"; view: View };

export type Workflow =
  | {
      id: string;
      type: "command";
      name: string;
      keywords: string[];
      description?: string;
      command: CommandAction;
    }
  | {
      id: string;
      type: "action";
      name: string;
      keywords: string[];
      description?: string;
      url?: string;
      openApp?: string;
      delayAfterOpenMs?: number;
      durationMinutes?: number;
    };

export type QueryKind = "command" | "filter";

export type PracticePhase = "attempt" | "video" | "redo" | "rate";
export type TimerStatus = "idle" | "running" | "paused" | "done";

export type PracticeState = {
  modeTitle: string;
  plan: { problemId: string; badge: "NEW" | "DUE" | "DONE" }[];
  cursor: number;
  phase: PracticePhase;

  timers: Record<
    string,
    {
      remainingSec: number;
      status: TimerStatus;
    }
  >;

  runningProblemId: string | null;
};

export type UIState = {
  view: View;
  selectedIndex: number;
  search: { kind: QueryKind };
  practice: PracticeState;
};

export type Event =
  | { type: "QUERY_KIND_CHANGED"; kind: QueryKind }
  | { type: "MOVE_SELECTION"; delta: number; max: number }
  | { type: "SET_SELECTION"; index: number }
  | { type: "RUN_COMMAND"; command: CommandAction }
  | { type: "GO_VIEW"; view: View }
  // Practice
  | { type: "PRACTICE_INIT"; modeTitle: string; plan: PracticeState["plan"] }
  | { type: "PRACTICE_MOVE_CURSOR"; delta: number }
  | { type: "PRACTICE_SKIP_NEXT" }
  | { type: "PRACTICE_RATE"; rating: 1 | 2 | 3 | 4 }
  | { type: "PRACTICE_SET_PHASE"; phase: PracticePhase }
  | { type: "PRACTICE_START_CURRENT"; seconds: number }
  | { type: "PRACTICE_PAUSE_RUNNING" }
  | { type: "PRACTICE_TICK_RUNNING" };

export const initialState: UIState = {
  view: "search",
  selectedIndex: 0,
  search: { kind: "filter" },
  practice: {
    modeTitle: "Search",
    plan: [],
    cursor: 0,
    phase: "attempt",
    timers: {},
    runningProblemId: null,
  },
};

function pauseRunning(practice: PracticeState): PracticeState {
  const runningId = practice.runningProblemId;
  if (!runningId) return practice;

  const t = practice.timers[runningId];
  if (!t || t.status !== "running") {
    return { ...practice, runningProblemId: null };
  }

  return {
    ...practice,
    timers: { ...practice.timers, [runningId]: { ...t, status: "paused" } },
    runningProblemId: null,
  };
}

export function reducer(state: UIState, ev: Event): UIState {
  switch (ev.type) {
    case "QUERY_KIND_CHANGED":
      return {
        ...state,
        search: { kind: ev.kind },
        selectedIndex: 0,
      };

    case "MOVE_SELECTION": {
      const maxIndex = Math.max(0, ev.max - 1);
      const next = Math.min(
        maxIndex,
        Math.max(0, state.selectedIndex + ev.delta)
      );
      return { ...state, selectedIndex: next };
    }

    case "SET_SELECTION":
      return { ...state, selectedIndex: Math.max(0, ev.index) };

    case "GO_VIEW":
      return { ...state, view: ev.view, selectedIndex: 0 };

    case "RUN_COMMAND": {
      const cmd = ev.command;

      if (cmd.action === "GO_VIEW") {
        return {
          ...state,
          view: cmd.view,
          selectedIndex: 0,
          practice: {
            ...state.practice,
            modeTitle:
              cmd.view === "search" ? "Search" : state.practice.modeTitle,
          },
        };
      }

      if (cmd.action === "START_FLOW" && cmd.flow === "leetcode") {
        return {
          ...state,
          view: "todayPlan",
          selectedIndex: 0,
          practice: {
            ...state.practice,
            modeTitle: "LeetCode",
          },
        };
      }

      return state;
    }

    case "PRACTICE_INIT": {
      const timers: PracticeState["timers"] = {};
      for (const it of ev.plan) {
        timers[it.problemId] = { remainingSec: 20 * 60, status: "idle" };
      }

      return {
        ...state,
        view: "todayPlan",
        selectedIndex: 0,
        practice: {
          ...state.practice,
          modeTitle: ev.modeTitle,
          plan: ev.plan,
          cursor: 0,
          phase: "attempt",
          timers,
          runningProblemId: null,
        },
      };
    }

    case "PRACTICE_PAUSE_RUNNING":
      return { ...state, practice: pauseRunning(state.practice) };

    case "PRACTICE_MOVE_CURSOR": {
      const max = Math.max(0, state.practice.plan.length - 1);
      const next = Math.min(max, Math.max(0, state.practice.cursor + ev.delta));
      return {
        ...state,
        practice: {
          ...state.practice,
          cursor: next,
          // ✅ chỉ đổi cursor thôi, không đụng timer đang chạy
        },
      };
    }

    case "PRACTICE_SKIP_NEXT": {
      const max = Math.max(0, state.practice.plan.length - 1);
      const next = Math.min(max, state.practice.cursor + 1);

      return {
        ...state,
        practice: {
          ...state.practice,
          cursor: next,
          phase: "attempt",
          // ✅ không pause running
        },
      };
    }

    case "PRACTICE_START_CURRENT": {
      const cur = state.practice.plan[state.practice.cursor];
      if (!cur) return state;

      const id = cur.problemId;

      // pause other running timer (only allow one)
      let practice = state.practice;
      if (practice.runningProblemId && practice.runningProblemId !== id) {
        practice = pauseRunning(practice);
      }

      const existing = practice.timers[id];

      // If idle or missing -> start from full seconds
      const shouldReset =
        !existing || existing.status === "idle" || existing.remainingSec <= 0;

      const nextTimer = shouldReset
        ? { remainingSec: ev.seconds, status: "running" as const }
        : { ...existing, status: "running" as const };

      return {
        ...state,
        practice: {
          ...practice,
          timers: { ...practice.timers, [id]: nextTimer },
          runningProblemId: id,
          phase: "attempt",
        },
      };
    }

    case "PRACTICE_TICK_RUNNING": {
      const id = state.practice.runningProblemId;
      if (!id) return state;

      const t = state.practice.timers[id];
      if (!t || t.status !== "running") return state;

      const nextSec = Math.max(0, t.remainingSec - 1);

      if (nextSec === 0) {
        // time up => pause, still NOT done
        return {
          ...state,
          practice: {
            ...state.practice,
            timers: {
              ...state.practice.timers,
              [id]: { ...t, remainingSec: 0, status: "paused" },
            },
            runningProblemId: null,
          },
        };
      }

      return {
        ...state,
        practice: {
          ...state.practice,
          timers: {
            ...state.practice.timers,
            [id]: { ...t, remainingSec: nextSec },
          },
        },
      };
    }

    case "PRACTICE_RATE": {
      const idx = state.practice.cursor;
      const cur = state.practice.plan[idx];
      if (!cur) return state;

      const id = cur.problemId;

      // mark plan DONE
      const plan = state.practice.plan.map((it, i) =>
        i === idx ? { ...it, badge: "DONE" as const } : it
      );

      // mark timer done
      const t = state.practice.timers[id];
      const timers = {
        ...state.practice.timers,
        [id]: t
          ? { ...t, status: "done" as const }
          : { remainingSec: 0, status: "done" as const },
      };

      // stop running if this one was running
      const runningProblemId =
        state.practice.runningProblemId === id
          ? null
          : state.practice.runningProblemId;

      const max = Math.max(0, plan.length - 1);
      const next = Math.min(max, idx + 1);

      return {
        ...state,
        practice: {
          ...state.practice,
          plan,
          cursor: next,
          phase: "attempt",
          timers,
          runningProblemId,
        },
      };
    }

    case "PRACTICE_SET_PHASE":
      return { ...state, practice: { ...state.practice, phase: ev.phase } };

    default:
      return state;
  }
}
