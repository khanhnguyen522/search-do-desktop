import { useMemo, useReducer, useRef, useState } from "react";
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

import type { Workflow } from "./engine";
import { initialState, reducer } from "./engine";

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
  const kind = query.trim().startsWith("/") ? "command" : "filter";

  // báo engine biết kind để reset selection
  useMemo(() => {
    dispatch({ type: "QUERY_KIND_CHANGED", kind });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const results = useMemo(() => {
    // Filter theo kind:
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

  const safeSelectedIndex = Math.min(
    uiState.selectedIndex,
    Math.max(0, results.length - 1)
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

  async function runSelectedIndex(index: number) {
    const w = results[index];
    if (!w) return;

    if (w.type === "command") {
      dispatch({ type: "RUN_COMMAND", command: w.command });
      return;
    }

    await runAction(w);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      dispatch({ type: "MOVE_SELECTION", delta: 1, max: results.length });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      dispatch({ type: "MOVE_SELECTION", delta: -1, max: results.length });
    } else if (e.key === "Enter") {
      e.preventDefault();
      runSelectedIndex(safeSelectedIndex);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setQuery("");
      dispatch({ type: "GO_VIEW", view: "search" });
      hideLauncher();
    }
  }

  return (
    <LauncherShell>
      <Header>
        <AppTitle modeTitle={uiState.practice.modeTitle} />
        <SearchBar
          inputRef={searchInputRef}
          value={query}
          onChange={(text) => setQuery(text)}
          onKeyDown={onKeyDown}
          placeholder={
            kind === "command"
              ? "Type /lc, /today, /search..."
              : 'Type keyword (e.g. "leetcode")'
          }
        />
      </Header>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <BodyRenderer
          uiState={uiState}
          items={results}
          onSelect={(i) => dispatch({ type: "SET_SELECTION", index: i })}
          onRun={(i) => runSelectedIndex(i)}
        />
      </div>

      <FooterHints />
    </LauncherShell>
  );
}
