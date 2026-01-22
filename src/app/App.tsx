import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import workflowsData from "../workflows.json";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Command } from "@tauri-apps/plugin-shell";
import { LauncherShell } from "../ui/LauncherShell";
import { Header } from "../ui/Header";
import { AppTitle } from "../ui/AppTitle";
import { SearchBar } from "../ui/SearchBar";
import { BodyRenderer } from "../ui/BodyRenderer";
import { FooterHints } from "../ui/FooterHints";
import { initialState, reducer } from "./engine";
import type { Workflow, TodoStatus, UIState, TodoTab } from "./engine";
import type { Section } from "../flows/search/SearchResults";
import { loadTodos, saveTodos, type TodoWorkflow } from "./todoStore";

type SearchWorkflow = Extract<Workflow, { type: "command" | "action" }>;

function isSearchWorkflow(w: Workflow): w is SearchWorkflow {
  return w.type === "command" || w.type === "action";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openApp(appName: string) {
  const res = await Command.create("open", ["-a", appName]).execute();
  console.log("openApp ok:", appName, res);
}

function isLikelyUrl(s: string) {
  const t = s.trim().toLowerCase();
  return t.startsWith("http://") || t.startsWith("https://");
}

function startOfLocalDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function addDaysLocal(ts: number, days: number) {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

function parseDueToken(token: string): number | undefined {
  const t = token.trim().toLowerCase();
  const now = Date.now();

  if (t === "@today") return startOfLocalDay(now);
  if (t === "@tmr") return startOfLocalDay(addDaysLocal(now, 1));
  if (t === "@yesterday") return startOfLocalDay(addDaysLocal(now, -1));

  if (t.startsWith("@")) {
    const s = t.slice(1);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return undefined;

    const y = Number(m[1]);
    const mo = Number(m[2]);
    const da = Number(m[3]);

    const d = new Date(y, mo - 1, da, 0, 0, 0, 0);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.getTime();
  }

  return undefined;
}

function computeTodosFiltered(
  allTodos: TodoWorkflow[],
  tab: TodoTab,
  tagFilter: string | null,
  searchText: string
): TodoWorkflow[] {
  const qRaw = searchText.trim().toLowerCase();

  return allTodos
    .filter((t) => t.status === tab)
    .filter((t) => (tagFilter ? t.tags.includes(tagFilter) : true))
    .filter((t) => {
      if (!qRaw) return true;

      if (qRaw.startsWith("#")) {
        const tg = qRaw.slice(1);
        return t.tags.some((x) => x.toLowerCase().includes(tg));
      }

      if (t.name.toLowerCase().includes(qRaw)) return true;

      for (const kw of t.keywords) {
        if (kw.toLowerCase().includes(qRaw)) return true;
      }

      for (const tg of t.tags) {
        if (tg.toLowerCase().includes(qRaw)) return true;
      }

      return false;
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export default function App() {
  const staticWorkflows: Workflow[] = workflowsData as Workflow[];
  const [uiState, dispatch] = useReducer(reducer, initialState);
  const [searchQuery, setSearchQuery] = useState("");
  const [todosQuery, setTodosQuery] = useState("");
  const [todos, setTodos] = useState<TodoWorkflow[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeQuery = uiState.view === "todos" ? todosQuery : searchQuery;

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const kind: "command" | "filter" = searchQuery.trim().startsWith("/")
    ? "command"
    : "filter";

  useEffect(() => {
    (async () => {
      try {
        const t = await loadTodos();
        t.sort((a, b) => b.createdAt - a.createdAt);
        setTodos(t);
      } catch (err) {
        console.debug("loadTodos failed:", err);
      }
    })();
  }, []);

  useEffect(() => {
    dispatch({ type: "QUERY_KIND_CHANGED", kind });
  }, [kind]);

  const workflowsForSearch: SearchWorkflow[] = useMemo(() => {
    return staticWorkflows.filter(isSearchWorkflow);
  }, [staticWorkflows]);

  const filteredSearch: SearchWorkflow[] = useMemo(() => {
    const base =
      kind === "command"
        ? workflowsForSearch.filter((w) => w.type === "command")
        : workflowsForSearch;

    if (!normalizedSearch) return base;

    const q = normalizedSearch.startsWith("/")
      ? normalizedSearch.slice(1)
      : normalizedSearch;

    return base
      .map((w) => {
        let score = 0;

        const name = w.name.toLowerCase();
        if (name.includes(q)) score = Math.max(score, 50);

        for (const k of w.keywords) {
          const kw = k.toLowerCase();
          if (kw.startsWith(q)) score = Math.max(score, 90);
          else if (kw.includes(q)) score = Math.max(score, 60);
        }

        return { w, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.w);
  }, [normalizedSearch, workflowsForSearch, kind]);

  const sections: Section[] = useMemo(() => {
    const commands = filteredSearch.filter((x) => x.type === "command");
    const actions = filteredSearch.filter((x) => x.type === "action");

    if (kind === "command") return [{ title: "Commands", items: commands }];

    return [
      { title: "Commands", items: commands },
      { title: "Actions", items: actions },
    ];
  }, [filteredSearch, kind]);

  const flat: SearchWorkflow[] = useMemo(() => {
    const out: SearchWorkflow[] = [];
    for (const s of sections) {
      for (const item of s.items) {
        if (isSearchWorkflow(item as Workflow))
          out.push(item as SearchWorkflow);
      }
    }
    return out;
  }, [sections]);

  const totalItems = flat.length;

  const safeSelectedIndex = Math.min(
    uiState.selectedIndex,
    Math.max(0, totalItems - 1)
  );

  function isSameLocalDay(ts: number, dayStart: number) {
    return ts >= dayStart && ts < addDaysLocal(dayStart, 1);
  }

  const todosFiltered: TodoWorkflow[] = useMemo(() => {
    const base = computeTodosFiltered(
      todos,
      uiState.todos.tab,
      uiState.todos.tagFilter,
      todosQuery
    );

    if (uiState.todos.mode === "occasional") {
      return base
        .filter((t) => t.dueAt == null)
        .sort((a, b) => b.createdAt - a.createdAt);
    }

    const dayStart = uiState.todos.selectedDayStartMs;

    return base
      .filter((t) => typeof t.dueAt === "number")
      .filter((t) => isSameLocalDay(t.dueAt!, dayStart))
      .sort((a, b) => {
        const da = a.dueAt ?? 0;
        const db = b.dueAt ?? 0;
        if (da !== db) return da - db;
        return b.createdAt - a.createdAt;
      });
  }, [
    todos,
    uiState.todos.tab,
    uiState.todos.tagFilter,
    uiState.todos.mode,
    uiState.todos.selectedDayStartMs,
    todosQuery,
  ]);

  const safeTodosIndex = Math.min(
    uiState.todos.selectedIndex,
    Math.max(0, todosFiltered.length - 1)
  );

  function getSelectedTodo(): TodoWorkflow | null {
    return todosFiltered[safeTodosIndex] ?? null;
  }

  async function hideLauncher() {
    try {
      await getCurrentWindow().hide();
    } catch (err) {
      console.debug("hideLauncher failed:", err);
    }
  }

  async function persist(next: TodoWorkflow[]) {
    setTodos(next);
    try {
      await saveTodos(next);
    } catch (err) {
      console.debug("saveTodos failed:", err);
    }
  }

  async function runAction(w: Extract<Workflow, { type: "action" }>) {
    if (w.openApp) {
      await openApp(w.openApp);
      await sleep(w.delayAfterOpenMs ?? 4000);
    }
    if (w.url) await openUrl(w.url);
    await hideLauncher();
  }

  async function setTodoStatus(id: string, status: TodoStatus) {
    const now = Date.now();

    const next = todos.map((t) => {
      if (t.id !== id) return t;

      if (status === "done")
        return { ...t, status, completedAt: t.completedAt ?? now };

      if (status === "archived")
        return { ...t, status, archivedAt: t.archivedAt ?? now };

      return { ...t, status };
    });

    await persist(next);
  }

  async function deleteTodoById(id: string) {
    await persist(todos.filter((t) => t.id !== id));
  }

  async function toggleTodo(todo: TodoWorkflow) {
    if (todo.status === "archived") {
      await setTodoStatus(todo.id, "active");
      return;
    }

    if (todo.status === "done") await setTodoStatus(todo.id, "active");
    else await setTodoStatus(todo.id, "done");
  }

  async function runTodo(todo: TodoWorkflow) {
    if (todo.openApp || todo.url) {
      if (todo.openApp) {
        await openApp(todo.openApp);
        await sleep(todo.delayAfterOpenMs ?? 4000);
      }
      if (todo.url) await openUrl(todo.url);
      await hideLauncher();
      return;
    }

    await toggleTodo(todo);
  }

  function parseTags(parts: string[]) {
    const tags: string[] = [];
    const rest: string[] = [];
    for (const p of parts) {
      if (p.startsWith("#") && p.length > 1) tags.push(p.slice(1));
      else rest.push(p);
    }
    return { tags: Array.from(new Set(tags)), rest };
  }

  async function createTodoFromQuery(rawInput: string) {
    const raw = rawInput.trim();
    if (!raw.toLowerCase().startsWith("t ")) return;

    const body = raw.slice(2).trim();
    if (!body) return;

    let parts = body.split(/\s+/).filter(Boolean);

    const last = parts[parts.length - 1];
    const url = last && isLikelyUrl(last) ? last : undefined;
    if (url) parts = parts.slice(0, -1);

    let dueAt: number | undefined;
    const dueIdx = parts.findIndex((p) => p.trim().startsWith("@"));
    if (dueIdx >= 0) {
      dueAt = parseDueToken(parts[dueIdx]);
      parts.splice(dueIdx, 1);
    }

    const { tags, rest } = parseTags(parts);

    const title = rest.join(" ").trim();
    if (!title) return;

    if (
      dueAt == null &&
      uiState.view === "todos" &&
      uiState.todos.mode === "daily"
    ) {
      dueAt = uiState.todos.selectedDayStartMs;
    }

    const now = Date.now();

    const todo: TodoWorkflow = {
      id: `todo-${now}`,
      type: "todo",
      name: title,
      keywords: ["todo"],
      description: url ? "Quick link attached" : undefined,
      status: "active",
      createdAt: now,
      tags,
      dueAt,
      url,
      openApp: undefined,
      delayAfterOpenMs: undefined,
      durationMinutes: undefined,
    };

    await persist([todo, ...todos]);

    setSearchQuery("");
    setTodosQuery("");

    dispatch({ type: "TODOS_SET_TAB", tab: "active" });

    if (dueAt != null) dispatch({ type: "TODOS_SET_MODE", mode: "daily" });

    if (uiState.view !== "todos") {
      dispatch({ type: "GO_VIEW", view: "todos" });
    }

    dispatch({ type: "TODOS_SET_SELECTION", index: 0 });

    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  }

  async function runByIndex(globalIndex: number) {
    const w = flat[globalIndex];
    if (!w) return;

    if (w.type === "command") {
      dispatch({ type: "RUN_COMMAND", command: w.command });
      return;
    }

    await runAction(w);
  }

  async function runSelectedInTodosView() {
    const todo = getSelectedTodo();
    if (todo) await runTodo(todo);
  }

  async function onGlobalKeyDownCapture(
    e: React.KeyboardEvent<HTMLDivElement>
  ) {
    const key = e.key.toLowerCase();
    const isCmd = e.metaKey || e.ctrlKey;

    const isCmdL = isCmd && key === "l";
    const isCmdK = isCmd && key === "k";
    const isArchiveShortcut = isCmd && key === "a";
    const isCmdD = isCmd && key === "d";
    const isCmdO = isCmd && key === "o";
    const isCmdC = isCmd && key === "c";

    const isDeleteShortcut = isCmd && e.key === "Backspace";
    const isCmdArrowLeft = isCmd && e.key === "ArrowLeft";
    const isCmdArrowRight = isCmd && e.key === "ArrowRight";
    const isCmdT = isCmd && key === "t";
    const isEsc = e.key === "Escape";

    const inTodosDaily =
      uiState.view === "todos" && uiState.todos.mode === "daily";

    if (inTodosDaily && uiState.todos.calendarOpen) {
      const delta =
        e.key === "ArrowLeft"
          ? -1
          : e.key === "ArrowRight"
            ? 1
            : e.key === "ArrowUp"
              ? -7
              : e.key === "ArrowDown"
                ? 7
                : 0;

      if (delta !== 0) {
        e.preventDefault();
        dispatch({ type: "TODOS_SHIFT_DAY", delta });
        return;
      }
    }

    // Esc closes calendar first
    if (inTodosDaily && uiState.todos.calendarOpen && isEsc) {
      e.preventDefault();
      dispatch({ type: "TODOS_SET_CALENDAR_OPEN", open: false });
      return;
    }

    // Toggle calendar
    if (uiState.view === "todos" && isCmdC) {
      e.preventDefault();
      if (uiState.todos.mode === "daily") {
        dispatch({ type: "TODOS_TOGGLE_CALENDAR" });
      }
      return;
    }

    // Scheduled / Occasional
    if (uiState.view === "todos" && isCmdD) {
      e.preventDefault();
      dispatch({ type: "TODOS_SET_MODE", mode: "daily" });
      return;
    }

    if (uiState.view === "todos" && isCmdO) {
      e.preventDefault();
      dispatch({ type: "TODOS_SET_MODE", mode: "occasional" });
      return;
    }

    // Tab switch view
    if (e.key === "Tab") {
      e.preventDefault();
      dispatch({
        type: "GO_VIEW",
        view: uiState.view === "todos" ? "search" : "todos",
      });
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      });
      return;
    }

    if (isCmdL) {
      e.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
      return;
    }

    if (isCmdK) {
      e.preventDefault();
      setSearchQuery("");
      setTodosQuery("");
      dispatch({ type: "SET_SELECTION", index: 0 });
      dispatch({ type: "TODOS_SET_SELECTION", index: 0 });
      return;
    }

    // 1/2/3 tabs
    if (e.key === "1" || e.key === "2" || e.key === "3") {
      if (uiState.view === "search" && searchQuery.trim().length > 0) return;

      e.preventDefault();
      dispatch({
        type: "TODOS_SET_TAB",
        tab: e.key === "1" ? "active" : e.key === "2" ? "done" : "archived",
      });
      return;
    }

    // Archive/Unarchive
    if (uiState.view === "todos" && isArchiveShortcut) {
      e.preventDefault();
      const todo = getSelectedTodo();
      if (!todo) return;

      await setTodoStatus(
        todo.id,
        todo.status === "archived" ? "active" : "archived"
      );
      return;
    }

    // Delete
    if (uiState.view === "todos" && isDeleteShortcut) {
      e.preventDefault();
      const todo = getSelectedTodo();
      if (!todo) return;

      await deleteTodoById(todo.id);
      return;
    }

    // Daily day navigation (Cmd+←/→, Cmd+T)
    if (inTodosDaily) {
      if (isCmdArrowLeft) {
        e.preventDefault();
        dispatch({ type: "TODOS_SHIFT_DAY", delta: -1 });
        return;
      }
      if (isCmdArrowRight) {
        e.preventDefault();
        dispatch({ type: "TODOS_SHIFT_DAY", delta: 1 });
        return;
      }
      if (isCmdT) {
        e.preventDefault();
        dispatch({ type: "TODOS_TODAY" });
        return;
      }
    }

    // arrows for selection (only if calendar NOT open)
    if (!(inTodosDaily && uiState.todos.calendarOpen)) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (uiState.view === "todos") {
          dispatch({
            type: "TODOS_MOVE_SELECTION",
            delta: 1,
            max: todosFiltered.length,
          });
        } else {
          dispatch({ type: "MOVE_SELECTION", delta: 1, max: totalItems });
        }
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (uiState.view === "todos") {
          dispatch({
            type: "TODOS_MOVE_SELECTION",
            delta: -1,
            max: todosFiltered.length,
          });
        } else {
          dispatch({ type: "MOVE_SELECTION", delta: -1, max: totalItems });
        }
        return;
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();

      const activeText = activeQuery.trim();

      if (activeText.toLowerCase().startsWith("t ")) {
        await createTodoFromQuery(activeText);
        return;
      }

      if (uiState.view === "todos") {
        await runSelectedInTodosView();
      } else {
        await runByIndex(safeSelectedIndex);
      }
      return;
    }

    if (isEsc) {
      e.preventDefault();

      if (uiState.view === "todos") {
        dispatch({ type: "GO_VIEW", view: "search" });
        dispatch({ type: "SET_SELECTION", index: 0 });
        requestAnimationFrame(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        });
        return;
      }

      await hideLauncher();
      return;
    }
  }

  return (
    <LauncherShell>
      <div
        onKeyDownCapture={onGlobalKeyDownCapture}
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: 0,
          gap: 10,
        }}
      >
        <Header>
          <AppTitle modeTitle={uiState.view === "todos" ? "Todos" : "Search"} />

          <SearchBar
            inputRef={searchInputRef}
            value={activeQuery}
            onChange={(text) => {
              if (uiState.view === "todos") {
                setTodosQuery(text);
                dispatch({ type: "TODOS_SET_SELECTION", index: 0 });
              } else {
                setSearchQuery(text);
                dispatch({ type: "SET_SELECTION", index: 0 });
              }
            }}
            onKeyDown={() => {}}
            placeholder={
              uiState.view === "todos"
                ? "Search todos… (#tag) • Tab switch"
                : kind === "command"
                  ? "Type /command…"
                  : 'Search… or "t <todo>"'
            }
          />
        </Header>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            paddingRight: 4,
          }}
        >
          <BodyRenderer
            uiState={uiState as UIState}
            sections={sections}
            onSelect={(idx) => dispatch({ type: "SET_SELECTION", index: idx })}
            onRun={(idx) => runByIndex(idx)}
            todos={
              todosFiltered as unknown as Extract<Workflow, { type: "todo" }>[]
            }
            onTodosSelect={(idx) =>
              dispatch({ type: "TODOS_SET_SELECTION", index: idx })
            }
            onTodosSetMode={(mode) =>
              dispatch({ type: "TODOS_SET_MODE", mode })
            }
            onTodosShiftDay={(delta) =>
              dispatch({ type: "TODOS_SHIFT_DAY", delta })
            }
            onTodosToday={() => dispatch({ type: "TODOS_TODAY" })}
            onTodosSetDay={(dayStartMs) =>
              dispatch({ type: "TODOS_SET_DAY", dayStartMs })
            }
            onTodosSetCalendarOpen={(open) =>
              dispatch({ type: "TODOS_SET_CALENDAR_OPEN", open })
            }
          />
        </div>

        {uiState.view === "search" && (
          <FooterHints
            kind={kind}
            view={uiState.view}
            todosMode={uiState.todos.mode}
          />
        )}
      </div>
    </LauncherShell>
  );
}
