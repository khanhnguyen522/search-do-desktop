export type View = "search" | "todos";

export type CommandAction = { action: "GO_VIEW"; view: View };

export type TodoStatus = "active" | "done" | "archived";
export type TodoTab = TodoStatus;

export type TodosMode = "daily" | "occasional";

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
    }
  | {
      id: string;
      type: "todo";
      name: string;
      keywords: string[];
      description?: string;
      status: TodoStatus;
      createdAt: number;
      completedAt?: number;
      archivedAt?: number;
      tags: string[];
      dueAt?: number;
      url?: string;
      openApp?: string;
      delayAfterOpenMs?: number;
      durationMinutes?: number;
    };

export type QueryKind = "command" | "filter";

export type UIState = {
  view: View;
  selectedIndex: number;
  search: { kind: QueryKind };
  todos: {
    tab: TodoTab;
    selectedIndex: number;
    tagFilter: string | null;

    mode: TodosMode; // daily | occasional
    selectedDayStartMs: number;
    calendarOpen: boolean;
  };
};

export type Event =
  | { type: "QUERY_KIND_CHANGED"; kind: QueryKind }
  | { type: "MOVE_SELECTION"; delta: number; max: number }
  | { type: "SET_SELECTION"; index: number }
  | { type: "RUN_COMMAND"; command: CommandAction }
  | { type: "GO_VIEW"; view: View }
  | { type: "TODOS_SET_TAB"; tab: TodoTab }
  | { type: "TODOS_MOVE_SELECTION"; delta: number; max: number }
  | { type: "TODOS_SET_SELECTION"; index: number }
  | { type: "TODOS_SET_TAG_FILTER"; tag: string | null }
  | { type: "TODOS_SET_MODE"; mode: TodosMode }
  | { type: "TODOS_SET_DAY"; dayStartMs: number }
  | { type: "TODOS_SHIFT_DAY"; delta: number }
  | { type: "TODOS_TODAY" }
  | { type: "TODOS_TOGGLE_CALENDAR" }
  | { type: "TODOS_SET_CALENDAR_OPEN"; open: boolean };

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

export const initialState: UIState = {
  view: "search",
  selectedIndex: 0,
  search: { kind: "filter" },
  todos: {
    tab: "active",
    selectedIndex: 0,
    tagFilter: null,
    mode: "occasional",
    selectedDayStartMs: startOfLocalDay(Date.now()),
    calendarOpen: false,
  },
};

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
      return {
        ...state,
        view: ev.view,
        selectedIndex: 0,
        todos:
          ev.view === "todos"
            ? { ...state.todos, selectedIndex: 0 }
            : state.todos,
      };

    case "RUN_COMMAND": {
      const cmd = ev.command;
      if (cmd.action === "GO_VIEW") {
        return {
          ...state,
          view: cmd.view,
          selectedIndex: 0,
          todos:
            cmd.view === "todos"
              ? { ...state.todos, selectedIndex: 0 }
              : state.todos,
        };
      }
      return state;
    }

    case "TODOS_SET_TAB":
      return {
        ...state,
        todos: { ...state.todos, tab: ev.tab, selectedIndex: 0 },
      };

    case "TODOS_MOVE_SELECTION": {
      const maxIndex = Math.max(0, ev.max - 1);
      const next = Math.min(
        maxIndex,
        Math.max(0, state.todos.selectedIndex + ev.delta)
      );
      return { ...state, todos: { ...state.todos, selectedIndex: next } };
    }

    case "TODOS_SET_SELECTION":
      return {
        ...state,
        todos: { ...state.todos, selectedIndex: Math.max(0, ev.index) },
      };

    case "TODOS_SET_TAG_FILTER":
      return {
        ...state,
        todos: { ...state.todos, tagFilter: ev.tag, selectedIndex: 0 },
      };

    case "TODOS_SET_MODE":
      return {
        ...state,
        todos: {
          ...state.todos,
          mode: ev.mode,
          selectedIndex: 0,
          calendarOpen: ev.mode === "daily" ? state.todos.calendarOpen : false,
        },
      };

    case "TODOS_SET_DAY":
      return {
        ...state,
        todos: {
          ...state.todos,
          selectedDayStartMs: startOfLocalDay(ev.dayStartMs),
          selectedIndex: 0,
        },
      };

    case "TODOS_SHIFT_DAY":
      return {
        ...state,
        todos: {
          ...state.todos,
          selectedDayStartMs: addDaysLocal(
            state.todos.selectedDayStartMs,
            ev.delta
          ),
          selectedIndex: 0,
        },
      };

    case "TODOS_TODAY":
      return {
        ...state,
        todos: {
          ...state.todos,
          selectedDayStartMs: startOfLocalDay(Date.now()),
          selectedIndex: 0,
        },
      };

    case "TODOS_TOGGLE_CALENDAR":
      return {
        ...state,
        todos: {
          ...state.todos,
          calendarOpen:
            state.todos.mode === "daily" ? !state.todos.calendarOpen : false,
        },
      };

    case "TODOS_SET_CALENDAR_OPEN":
      return {
        ...state,
        todos: {
          ...state.todos,
          calendarOpen: state.todos.mode === "daily" ? ev.open : false,
        },
      };

    default:
      return state;
  }
}
