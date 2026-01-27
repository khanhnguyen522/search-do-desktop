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
import type { Workflow, TodoStatus, UIState } from "./engine";
import type { Section } from "../flows/search/SearchResults";
import { loadTodos, saveTodos, type TodoWorkflow } from "./todoStore";

import lcCatalogData from "./leetcodeCatalog.json";
import {
  loadLcState,
  saveLcState,
  defaultLcState,
  type LcState,
} from "./leetcodeStore";

import type {
  LcListItem,
  LcProblem,
  LcCategoryStat,
  LcDashboard,
  LcDifficulty,
} from "../flows/leetcode/LeetCodeView";

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
  tagFilter: string | null,
  searchText: string
): TodoWorkflow[] {
  const qRaw = searchText.trim().toLowerCase();

  return allTodos
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

function lcUrl(slug: string) {
  return `https://leetcode.com/problems/${slug}/description/`;
}

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .map((x) => (x ? x[0].toUpperCase() + x.slice(1) : x))
    .join(" ");
}

export default function App() {
  const staticWorkflows: Workflow[] = workflowsData as Workflow[];
  const [uiState, dispatch] = useReducer(reducer, initialState);

  const [searchQuery, setSearchQuery] = useState("");
  const [todosQuery, setTodosQuery] = useState("");
  const [leetcodeQuery, setLeetcodeQuery] = useState("");

  const [todos, setTodos] = useState<TodoWorkflow[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const lcCatalog: LcProblem[] = lcCatalogData as unknown as LcProblem[];
  const [lcState, setLcState] = useState<LcState>(defaultLcState);

  const activeQuery =
    uiState.view === "todos"
      ? todosQuery
      : uiState.view === "leetcode"
        ? leetcodeQuery
        : searchQuery;

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
    (async () => {
      try {
        const s = await loadLcState();
        setLcState(s);
      } catch (err) {
        console.debug("loadLcState failed:", err);
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
        if (isSearchWorkflow(item as Workflow)) {
          out.push(item as SearchWorkflow);
        }
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

  async function persistLc(next: LcState) {
    setLcState(next);
    try {
      await saveLcState(next);
    } catch (err) {
      console.debug("saveLcState failed:", err);
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

  async function runTodo(todo: TodoWorkflow, opts?: { open?: boolean }) {
    const shouldOpen = opts?.open === true;

    if (shouldOpen && (todo.openApp || todo.url)) {
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
    setLeetcodeQuery("");

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

  function getLcStatus(slug: string): "new" | "done" {
    return lcState.progress?.[slug]?.status === "done" ? "done" : "new";
  }

  function generateTodayPlanSlugs(
    state: LcState,
    catalog: LcProblem[]
  ): string[] {
    const dailyNew = state.settings?.dailyNew ?? 2;
    const out: string[] = [];
    for (const p of catalog) {
      if (out.length >= dailyNew) break;
      const done = state.progress?.[p.slug]?.status === "done";
      if (done) continue;
      out.push(p.slug);
    }
    return out;
  }

  function ensureTodayPlan(state: LcState, catalog: LcProblem[]): LcState {
    const todayYmd = ymdLocal(Date.now());
    const hasToday = state.todayPlan?.ymd === todayYmd;

    if (hasToday && (state.todayPlan?.slugs?.length ?? 0) > 0) return state;

    const slugs = generateTodayPlanSlugs(state, catalog);
    return { ...state, todayPlan: { ymd: todayYmd, slugs } };
  }

  useEffect(() => {
    if (!lcCatalog || lcCatalog.length === 0) return;

    const next = ensureTodayPlan(lcState, lcCatalog);

    const changed =
      next.todayPlan?.ymd !== lcState.todayPlan?.ymd ||
      JSON.stringify(next.todayPlan?.slugs ?? []) !==
        JSON.stringify(lcState.todayPlan?.slugs ?? []);

    if (!changed) return;

    (async () => {
      await persistLc(next);
    })();
  }, [lcCatalog.length, lcState.todayPlan?.ymd]);

  const todaySlugs = useMemo(() => {
    const fixed = ensureTodayPlan(lcState, lcCatalog);
    return fixed.todayPlan?.slugs ?? [];
  }, [lcState, lcCatalog]);

  const planCount = todaySlugs.length;

  const doneTodaySlugs = useMemo(() => {
    const dayStart = startOfLocalDay(Date.now());
    const out: { slug: string; t: number }[] = [];

    const progress = lcState.progress ?? {};
    for (const slug of Object.keys(progress)) {
      const p = progress[slug];
      if (!p) continue;
      if (p.status !== "done") continue;

      const t = p.lastSolvedAt;
      if (typeof t !== "number") continue;

      if (t >= dayStart && t < addDaysLocal(dayStart, 1)) {
        out.push({ slug, t });
      }
    }

    out.sort((a, b) => b.t - a.t);
    return out.map((x) => x.slug);
  }, [lcState]);

  function buildLcCountByYmd(state: LcState) {
    const out: Record<string, number> = {};
    const progress = state.progress ?? {};
    for (const slug of Object.keys(progress)) {
      const p = progress[slug];
      if (!p) continue;
      if (p.status !== "done") continue;
      const t = p.lastSolvedAt;
      if (typeof t !== "number") continue;

      const key = ymdLocal(t);
      out[key] = (out[key] ?? 0) + 1;
    }
    return out;
  }

  const lcCountByYmd = useMemo(() => buildLcCountByYmd(lcState), [lcState]);

  const lcTodayDone = useMemo(() => doneTodaySlugs.length, [doneTodaySlugs]);

  const lcTodayTotal = useMemo(() => {
    return Math.max(planCount, lcTodayDone);
  }, [planCount, lcTodayDone]);

  function pickRandomSlug(state: LcState): string | null {
    const candidates = lcCatalog.filter(
      (p) => state.progress?.[p.slug]?.status !== "done"
    );
    if (candidates.length === 0) return null;
    const idx = Math.floor(Math.random() * candidates.length);
    return candidates[idx]!.slug;
  }

  const lcCategoryStats: LcCategoryStat[] = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>();

    for (const p of lcCatalog) {
      const key = p.category || "other";
      const cur = map.get(key) ?? { total: 0, done: 0 };
      cur.total += 1;

      const st = lcState.progress?.[p.slug]?.status;
      if (st === "done") cur.done += 1;

      map.set(key, cur);
    }

    const out: LcCategoryStat[] = Array.from(map.entries()).map(([key, v]) => ({
      key,
      total: v.total,
      done: v.done,
      pct: v.total === 0 ? 0 : v.done / v.total,
    }));

    out.sort((a, b) => {
      const ra = a.total - a.done;
      const rb = b.total - b.done;
      if (ra !== rb) return rb - ra;
      return a.key.localeCompare(b.key);
    });

    return out;
  }, [lcCatalog, lcState]);

  function monthStartLocal(ts: number) {
    const d = new Date(ts);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function computeStreakFromMap(map: Record<string, number>): {
    current: number;
    best: number;
  } {
    let current = 0;
    let t = startOfLocalDay(Date.now());
    while (true) {
      const key = ymdLocal(t);
      const n = map[key] ?? 0;
      if (n <= 0) break;
      current += 1;
      t = addDaysLocal(t, -1);
    }

    const days = Object.keys(map)
      .filter((k) => (map[k] ?? 0) > 0)
      .sort();

    let best = 0;
    let run = 0;

    function ymdToMs(ymd: string) {
      const [y, m, d] = ymd.split("-").map(Number);
      const dt = new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
      return dt.getTime();
    }

    for (let i = 0; i < days.length; i++) {
      const cur = days[i]!;
      if (i === 0) {
        run = 1;
        best = Math.max(best, run);
        continue;
      }
      const prev = days[i - 1]!;
      const gap = (ymdToMs(cur) - ymdToMs(prev)) / (24 * 3600 * 1000);
      if (gap === 1) run += 1;
      else run = 1;
      best = Math.max(best, run);
    }

    return { current, best };
  }

  const lcDashboard: LcDashboard = useMemo(() => {
    const totalByDiff: Record<LcDifficulty, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
    };
    const doneByDiff: Record<LcDifficulty, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
    };

    for (const p of lcCatalog) {
      const diff = (p.difficulty ?? "easy") as LcDifficulty;
      totalByDiff[diff] += 1;
      if (lcState.progress?.[p.slug]?.status === "done") {
        doneByDiff[diff] += 1;
      }
    }

    const total = lcCatalog.length;
    const done =
      (doneByDiff.easy ?? 0) +
      (doneByDiff.medium ?? 0) +
      (doneByDiff.hard ?? 0);

    const solvedCountByYmd: Record<string, number> = {};
    const progress = lcState.progress ?? {};
    for (const slug of Object.keys(progress)) {
      const it = progress[slug];
      if (!it || it.status !== "done") continue;
      const t = it.lastSolvedAt;
      if (typeof t !== "number") continue;
      const key = ymdLocal(t);
      solvedCountByYmd[key] = (solvedCountByYmd[key] ?? 0) + 1;
    }

    const { current, best } = computeStreakFromMap(solvedCountByYmd);

    return {
      total,
      done,
      pct: total ? done / total : 0,
      totalByDiff,
      doneByDiff,
      solvedCountByYmd,
      monthStartMs: monthStartLocal(Date.now()),
      currentStreak: current,
      bestStreak: best,
    };
  }, [lcCatalog, lcState]);

  const lcItems: LcListItem[] = useMemo(() => {
    if (uiState.view !== "leetcode") return [];

    const tab = uiState.leetcode.tab;
    const q = leetcodeQuery.trim().toLowerCase();

    let base: LcProblem[] = lcCatalog;

    if (tab === "today") {
      const planSet = new Set(todaySlugs);

      const plan = todaySlugs
        .map((slug) => lcCatalog.find((p) => p.slug === slug))
        .filter(Boolean) as LcProblem[];

      const bonusSlots =
        lcTodayDone >= planCount ? Math.max(1, lcTodayDone - planCount + 1) : 0;

      if (bonusSlots <= 0) {
        base = plan;
      } else {
        const bonusDoneToday = doneTodaySlugs
          .filter((slug) => !planSet.has(slug))
          .map((slug) => lcCatalog.find((p) => p.slug === slug))
          .filter(Boolean) as LcProblem[];

        const chosenBonus: LcProblem[] = [];
        for (const p of bonusDoneToday) {
          if (chosenBonus.length >= bonusSlots) break;
          chosenBonus.push(p);
        }

        if (chosenBonus.length < bonusSlots) {
          const chosenSet = new Set(chosenBonus.map((x) => x.slug));

          const bonusNew = lcCatalog
            .filter((p) => !planSet.has(p.slug))
            .filter((p) => !chosenSet.has(p.slug))
            .filter((p) => lcState.progress?.[p.slug]?.status !== "done")
            .slice(0, bonusSlots - chosenBonus.length);

          chosenBonus.push(...bonusNew);
        }

        base = [...plan, ...chosenBonus];
      }
    } else if (tab === "category") {
      base = lcCatalog.filter((p) => p.category === uiState.leetcode.category);
    } else if (tab === "random") {
      const r = pickRandomSlug(lcState);
      base = r ? lcCatalog.filter((p) => p.slug === r) : [];
    }

    if (q) {
      base = base.filter((p) => {
        const title = titleFromSlug(p.slug).toLowerCase();
        return (
          p.slug.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          title.includes(q)
        );
      });
    }

    return base.map((p) => ({
      slug: p.slug,
      category: p.category,
      difficulty: (p.difficulty ?? "easy") as LcDifficulty,
      title: titleFromSlug(p.slug),
      url: lcUrl(p.slug),
      status: getLcStatus(p.slug),
    }));
  }, [
    uiState.view,
    uiState.leetcode.tab,
    uiState.leetcode.category,
    leetcodeQuery,
    lcCatalog,
    lcState,
    todaySlugs,
    doneTodaySlugs,
    planCount,
    lcTodayDone,
  ]);

  const safeLcIndex = Math.min(
    uiState.leetcode.selectedIndex,
    Math.max(0, lcItems.length - 1)
  );

  function getSelectedLc(): LcListItem | null {
    return lcItems[safeLcIndex] ?? null;
  }

  async function lcOpenSelected() {
    const it = getSelectedLc();
    if (!it) return;

    await openUrl(it.url);
    await hideLauncher();
    await persistLc({ ...lcState, lastOpenedSlug: it.slug });
  }

  async function lcMarkDoneSelected() {
    const it = getSelectedLc();
    if (!it) return;

    const now = Date.now();
    const prev = lcState.progress?.[it.slug];
    const solvedCount = (prev?.solvedCount ?? 0) + 1;

    const next: LcState = {
      ...lcState,
      progress: {
        ...lcState.progress,
        [it.slug]: {
          slug: it.slug,
          status: "done",
          solvedCount,
          lastSolvedAt: now,
        },
      },
    };

    await persistLc(next);
  }

  async function onGlobalKeyDownCapture(
    e: React.KeyboardEvent<HTMLDivElement>
  ) {
    const key = e.key.toLowerCase();
    const isCmd = e.metaKey || e.ctrlKey;

    const isCmdL = isCmd && key === "l";
    const isCmdK = isCmd && key === "k";
    const isCmdD = isCmd && key === "d";
    const isCmdO = isCmd && key === "o";
    const isCmdC = isCmd && key === "c";
    const isCmdT = isCmd && key === "t";

    const isDeleteShortcut = isCmd && e.key === "Backspace";
    const isCmdArrowLeft = isCmd && e.key === "ArrowLeft";
    const isCmdArrowRight = isCmd && e.key === "ArrowRight";
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

    if (inTodosDaily && uiState.todos.calendarOpen && isEsc) {
      e.preventDefault();
      dispatch({ type: "TODOS_SET_CALENDAR_OPEN", open: false });
      return;
    }

    if (uiState.view === "todos" && isCmdC) {
      e.preventDefault();
      if (uiState.todos.mode === "daily") {
        dispatch({ type: "TODOS_TOGGLE_CALENDAR" });
      }
      return;
    }

    if (isCmdD) {
      if (uiState.view === "leetcode") {
        e.preventDefault();
        await lcMarkDoneSelected();
        return;
      }
      if (uiState.view === "todos") {
        e.preventDefault();
        dispatch({ type: "TODOS_SET_MODE", mode: "daily" });
        return;
      }
    }

    if (uiState.view === "todos" && isCmdO) {
      e.preventDefault();
      dispatch({ type: "TODOS_SET_MODE", mode: "occasional" });
      return;
    }

    if (isCmdT) {
      if (uiState.view === "leetcode") {
        e.preventDefault();
        dispatch({ type: "LC_SET_TAB", tab: "today" });
        dispatch({ type: "LC_SET_SELECTION", index: 0 });
        return;
      }
      if (inTodosDaily) {
        e.preventDefault();
        dispatch({ type: "TODOS_TODAY" });
        return;
      }
    }

    if (e.key === "Tab") {
      e.preventDefault();
      const next =
        uiState.view === "search"
          ? "todos"
          : uiState.view === "todos"
            ? "leetcode"
            : "search";

      dispatch({ type: "GO_VIEW", view: next });
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
      setLeetcodeQuery("");
      dispatch({ type: "SET_SELECTION", index: 0 });
      dispatch({ type: "TODOS_SET_SELECTION", index: 0 });
      dispatch({ type: "LC_SET_SELECTION", index: 0 });
      return;
    }

    if (uiState.view === "todos" && isDeleteShortcut) {
      e.preventDefault();
      const todo = getSelectedTodo();
      if (!todo) return;

      await deleteTodoById(todo.id);
      return;
    }

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
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (uiState.view === "todos") {
        dispatch({
          type: "TODOS_MOVE_SELECTION",
          delta: 1,
          max: todosFiltered.length,
        });
      } else if (uiState.view === "leetcode") {
        dispatch({
          type: "LC_MOVE_SELECTION",
          delta: 1,
          max: lcItems.length,
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
      } else if (uiState.view === "leetcode") {
        dispatch({
          type: "LC_MOVE_SELECTION",
          delta: -1,
          max: lcItems.length,
        });
      } else {
        dispatch({ type: "MOVE_SELECTION", delta: -1, max: totalItems });
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();

      const activeText = activeQuery.trim();

      if (activeText.toLowerCase().startsWith("t ")) {
        await createTodoFromQuery(activeText);
        return;
      }

      if (uiState.view === "todos") {
        const todo = getSelectedTodo();
        if (!todo) return;

        const wantOpen = isCmd;
        await runTodo(todo, { open: wantOpen });
        return;
      } else if (uiState.view === "leetcode") {
        await lcOpenSelected();
      } else {
        await runByIndex(safeSelectedIndex);
      }
      return;
    }

    if (isEsc) {
      e.preventDefault();

      if (uiState.view === "todos" || uiState.view === "leetcode") {
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

  const title =
    uiState.view === "todos"
      ? "Todos"
      : uiState.view === "leetcode"
        ? "LeetCode"
        : "Search";

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
          <AppTitle modeTitle={title} />

          <SearchBar
            inputRef={searchInputRef}
            value={activeQuery}
            onChange={(text) => {
              if (uiState.view === "todos") {
                setTodosQuery(text);
                dispatch({ type: "TODOS_SET_SELECTION", index: 0 });
              } else if (uiState.view === "leetcode") {
                setLeetcodeQuery(text);
                dispatch({ type: "LC_SET_SELECTION", index: 0 });
              } else {
                setSearchQuery(text);
                dispatch({ type: "SET_SELECTION", index: 0 });
              }
            }}
            onKeyDown={() => {}}
            placeholder={
              uiState.view === "todos"
                ? "Search todos… (#tag)"
                : uiState.view === "leetcode"
                  ? "Search title / slug / category…"
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
            onTodosSetTagFilter={(tag) => {
              dispatch({ type: "TODOS_SET_TAG_FILTER", tag });
              dispatch({ type: "TODOS_SET_SELECTION", index: 0 });
            }}
            onTodosSetCalendarOpen={(open) =>
              dispatch({ type: "TODOS_SET_CALENDAR_OPEN", open })
            }
            lcItems={lcItems}
            lcTab={uiState.leetcode.tab}
            lcCategory={uiState.leetcode.category}
            lcCategories={lcCategoryStats}
            lcSelectedIndex={uiState.leetcode.selectedIndex}
            lcDashboard={lcDashboard}
            lcTodayTotal={lcTodayTotal}
            lcTodayDone={lcTodayDone}
            lcCountByYmd={lcCountByYmd}
            onLcSelect={(idx) =>
              dispatch({ type: "LC_SET_SELECTION", index: idx })
            }
            onLcSetTab={(tab) => dispatch({ type: "LC_SET_TAB", tab })}
            onLcSetCategory={(category) =>
              dispatch({ type: "LC_SET_CATEGORY", category })
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
