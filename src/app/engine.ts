export type View = "search";

export type CommandAction = { action: "GO_VIEW"; view: View };

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

export type UIState = {
  view: View;
  selectedIndex: number;
  search: { kind: QueryKind };
};

export type Event =
  | { type: "QUERY_KIND_CHANGED"; kind: QueryKind }
  | { type: "MOVE_SELECTION"; delta: number; max: number }
  | { type: "SET_SELECTION"; index: number }
  | { type: "RUN_COMMAND"; command: CommandAction };

export const initialState: UIState = {
  view: "search",
  selectedIndex: 0,
  search: { kind: "filter" },
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

    case "RUN_COMMAND": {
      const cmd = ev.command;
      if (cmd.action === "GO_VIEW") {
        return { ...state, view: cmd.view, selectedIndex: 0 };
      }
      return state;
    }

    default:
      return state;
  }
}
