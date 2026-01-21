import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import workflowsData from "../workflows.json";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
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

  // ✅ split queries per view
  const [searchQuery, setSearchQuery] = useState("");
  const [todosQuery, setTodosQuery] = useState("");

  const [todos, setTodos] = useState<TodoWorkflow[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const activeQuery = uiState.view === "todos" ? todosQuery : searchQuery;

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const kind: "command" | "filter" = searchQuery.trim().startsWith("/")
    ? "command"
    : "filter";

  // Load todos once
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

  // Inform engine that kind changed => reset global selection (search only)
  useEffect(() => {
    dispatch({ type: "QUERY_KIND_CHANGED", kind });
  }, [kind]);

  // Window sizing
  useEffect(() => {
    const w = getCurrentWindow();
    (async () => {
      await w.show();
      await new Promise((r) => setTimeout(r, 50));
      await w.setSize(new LogicalSize(720, 820));
    })();
  }, []);

  // ✅ Search view ONLY: command/action (no todos)
  const workflowsForSearch: SearchWorkflow[] = useMemo(() => {
    return staticWorkflows.filter(isSearchWorkflow);
  }, [staticWorkflows]);

  // ===== Search view filtering =====
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

  // ✅ flat typed as SearchWorkflow => runByIndex safe
  const flat: SearchWorkflow[] = useMemo(() => {
    const out: SearchWorkflow[] = [];
    for (const s of sections) {
      for (const item of s.items) {
        // Search section contains only command/action, but keep guard
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

  // ===== Todos view filtering (single source of truth) =====
  const todosFiltered: TodoWorkflow[] = useMemo(() => {
    return computeTodosFiltered(
      todos,
      uiState.todos.tab,
      uiState.todos.tagFilter,
      todosQuery
    );
  }, [todos, uiState.todos.tab, uiState.todos.tagFilter, todosQuery]);

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
    // archived => Enter unarchives
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

  async function createTodoFromQuery() {
    // syntax: "t buy milk" OR "t buy milk https://..."
    const raw = searchQuery.trim();
    const titleAndMaybeUrl = raw.slice(2).trim();
    if (!titleAndMaybeUrl) return;

    const parts = titleAndMaybeUrl.split(/\s+/);
    const last = parts[parts.length - 1];
    const url = isLikelyUrl(last) ? last : undefined;

    const title = url ? parts.slice(0, -1).join(" ").trim() : titleAndMaybeUrl;
    if (!title) return;

    const now = Date.now();

    const todo: TodoWorkflow = {
      id: `todo-${now}`,
      type: "todo",
      name: title,
      keywords: ["todo"],
      description: url ? "Quick link attached" : undefined,
      status: "active",
      createdAt: now,
      tags: [],
      url,
    };

    await persist([todo, ...todos]);

    setSearchQuery("");
    setTodosQuery("");

    dispatch({ type: "TODOS_SET_TAB", tab: "active" });
    dispatch({ type: "GO_VIEW", view: "todos" });
    dispatch({ type: "TODOS_SET_SELECTION", index: 0 });

    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
  }

  // ✅ w is SearchWorkflow => safe to call runAction only when action
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

  async function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const isCmdL = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "l";
    const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";

    // ✅ option 1 shortcuts
    const isArchiveShortcut =
      (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a";

    const isDeleteShortcut = (e.metaKey || e.ctrlKey) && e.key === "Backspace";

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
      // avoid interfering while typing in SEARCH view
      if (uiState.view === "search" && searchQuery.trim().length > 0) return;

      e.preventDefault();
      dispatch({
        type: "TODOS_SET_TAB",
        tab: e.key === "1" ? "active" : e.key === "2" ? "done" : "archived",
      });
      return;
    }

    // Archive/Unarchive (todos view only)
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

    // Delete (todos view only)
    if (uiState.view === "todos" && isDeleteShortcut) {
      e.preventDefault();
      const todo = getSelectedTodo();
      if (!todo) return;

      await deleteTodoById(todo.id);
      return;
    }

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

    if (e.key === "Enter") {
      e.preventDefault();

      if (
        uiState.view === "search" &&
        searchQuery.trim().toLowerCase().startsWith("t ")
      ) {
        await createTodoFromQuery();
        return;
      }

      if (uiState.view === "todos") {
        await runSelectedInTodosView();
      } else {
        await runByIndex(safeSelectedIndex);
      }
      return;
    }

    if (e.key === "Escape") {
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
            onKeyDown={onKeyDown}
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
            overflowY: "auto",
            paddingRight: 4,
          }}
        >
          <BodyRenderer
            uiState={uiState as UIState}
            sections={sections}
            onSelect={(idx) => dispatch({ type: "SET_SELECTION", index: idx })}
            onRun={(idx) => runByIndex(idx)}
            // ✅ PASS FILTERED LIST ONLY (no double-filter bugs)
            todos={
              todosFiltered as unknown as Extract<Workflow, { type: "todo" }>[]
            }
            onTodosSelect={(idx) =>
              dispatch({ type: "TODOS_SET_SELECTION", index: idx })
            }
          />
        </div>
        <FooterHints kind={kind} />
      </div>
    </LauncherShell>
  );
}
