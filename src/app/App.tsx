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

import type { Workflow } from "./engine";
import { initialState, reducer } from "./engine";
import type { Section } from "../flows/search/SearchResults";
import { buildTodayPlan, getProblemById } from "../flows/leetcode/leetcodeData";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openApp(appName: string) {
  const res = await Command.create("open", ["-a", appName]).execute();
  console.log("openApp ok:", appName, res);
}

export default function App() {
  const workflows: Workflow[] = workflowsData as Workflow[];

  const [uiState, dispatch] = useReducer(reducer, initialState);
  const [query, setQuery] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);

  const normalized = query.trim().toLowerCase();
  const kind: "command" | "filter" = query.trim().startsWith("/")
    ? "command"
    : "filter";

  // Inform engine that kind changed => reset selection
  useEffect(() => {
    dispatch({ type: "QUERY_KIND_CHANGED", kind });
  }, [kind]);

  useEffect(() => {
    const w = getCurrentWindow();
    (async () => {
      await w.show(); // ✅ ensure window exists & visible
      await new Promise((r) => setTimeout(r, 50));
      await w.setSize(new LogicalSize(720, 820));
      console.log("innerSize after set:", await w.innerSize());
    })();
  }, []);

  // Tick only when there is a running problem timer
  useEffect(() => {
    if (!uiState.practice.runningProblemId) return;

    const id = window.setInterval(() => {
      dispatch({ type: "PRACTICE_TICK_RUNNING" });
    }, 1000);

    return () => window.clearInterval(id);
  }, [uiState.practice.runningProblemId]);

  const filtered = useMemo(() => {
    const base =
      kind === "command"
        ? workflows.filter((w) => w.type === "command")
        : workflows;

    if (!normalized) return base;

    const q = normalized.startsWith("/") ? normalized.slice(1) : normalized;

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
  }, [normalized, workflows, kind]);

  const sections: Section[] = useMemo(() => {
    const commands = filtered.filter((x) => x.type === "command");
    const actions = filtered.filter((x) => x.type === "action");

    if (kind === "command") {
      return [{ title: "Commands", items: commands }];
    }

    return [
      { title: "Commands", items: commands },
      { title: "Actions", items: actions },
    ];
  }, [filtered, kind]);

  const flat: Workflow[] = useMemo(() => {
    const out: Workflow[] = [];
    for (const s of sections) out.push(...s.items);
    return out;
  }, [sections]);

  const totalItems = flat.length;

  const safeSelectedIndex = Math.min(
    uiState.selectedIndex,
    Math.max(0, totalItems - 1)
  );

  async function hideLauncher() {
    try {
      await getCurrentWindow().hide();
    } catch {}
  }

  async function runAction(w: Extract<Workflow, { type: "action" }>) {
    if (w.openApp) {
      await openApp(w.openApp);
      await sleep(w.delayAfterOpenMs ?? 4000);
    }
    if (w.url) {
      await openUrl(w.url);
    }
    await hideLauncher();
  }

  async function runByIndex(globalIndex: number) {
    const w = flat[globalIndex];
    if (!w) return;

    if (w.type === "command") {
      dispatch({ type: "RUN_COMMAND", command: w.command });

      if (w.command.action === "START_FLOW" && w.command.flow === "leetcode") {
        const plan = buildTodayPlan();
        dispatch({ type: "PRACTICE_INIT", modeTitle: "LeetCode", plan });
      }
      return;
    }

    await runAction(w);
  }

  async function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const isCmdL = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "l";
    const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";

    if (isCmdL) {
      e.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
      return;
    }
    if (isCmdK) {
      e.preventDefault();
      setQuery("");
      dispatch({ type: "SET_SELECTION", index: 0 });
      return;
    }

    const inPractice = uiState.view !== "search";

    // ===== Practice keymap =====
    if (inPractice) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        dispatch({ type: "PRACTICE_MOVE_CURSOR", delta: 1 });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        dispatch({ type: "PRACTICE_MOVE_CURSOR", delta: -1 });
        return;
      }
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        dispatch({ type: "PRACTICE_SKIP_NEXT" });
        return;
      }
      if (["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        dispatch({
          type: "PRACTICE_RATE",
          rating: Number(e.key) as 1 | 2 | 3 | 4,
        });
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const cur = uiState.practice.plan[uiState.practice.cursor];
        const p = cur ? getProblemById(cur.problemId) : undefined;

        if (p?.leetcodeUrl) {
          await openUrl(p.leetcodeUrl);
        }

        // ✅ per-problem timer: start/resume current
        dispatch({ type: "PRACTICE_START_CURRENT", seconds: 20 * 60 });
        return;
      }
      if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        const cur = uiState.practice.plan[uiState.practice.cursor];
        const p = cur ? getProblemById(cur.problemId) : undefined;
        if (p?.videoUrl) {
          await openUrl(p.videoUrl);
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        dispatch({ type: "GO_VIEW", view: "search" });
        setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 0);
        return;
      }

      return;
    }

    // ===== Search keymap =====
    if (e.key === "ArrowDown") {
      e.preventDefault();
      dispatch({ type: "MOVE_SELECTION", delta: 1, max: totalItems });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      dispatch({ type: "MOVE_SELECTION", delta: -1, max: totalItems });
    } else if (e.key === "Enter") {
      e.preventDefault();
      await runByIndex(safeSelectedIndex);
    } else if (e.key === "Escape") {
      e.preventDefault();
      await hideLauncher();
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
          <AppTitle modeTitle={uiState.practice.modeTitle} />
          <SearchBar
            inputRef={searchInputRef}
            value={query}
            onChange={(text) => {
              setQuery(text);
              dispatch({ type: "SET_SELECTION", index: 0 });
            }}
            onKeyDown={onKeyDown}
            placeholder={
              kind === "command"
                ? "Type /lc, /today, /search..."
                : 'Type keyword (e.g. "leetcode")'
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
            uiState={uiState}
            sections={sections}
            onSelect={(idx) => dispatch({ type: "SET_SELECTION", index: idx })}
            onRun={(idx) => runByIndex(idx)}
          />
        </div>

        <FooterHints kind={kind} />
      </div>
    </LauncherShell>
  );
}
