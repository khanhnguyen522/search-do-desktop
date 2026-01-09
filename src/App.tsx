import { useEffect, useMemo, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import workflowsData from "./workflows.json";
import { Command } from "@tauri-apps/plugin-shell";
import { getCurrentWindow } from "@tauri-apps/api/window";

type Workflow = {
  id: string;
  name: string;
  keywords: string[];
  url?: string;
  openApp?: string;
  delayAfterOpenMs?: number;
  durationMinutes?: number;
};

function formatMMSS(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function App() {
  const workflows: Workflow[] = workflowsData;

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);

  const notifReadyRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        let granted = await isPermissionGranted();
        if (!granted) granted = (await requestPermission()) === "granted";
        notifReadyRef.current = granted;
      } catch {
        notifReadyRef.current = false;
      }
    })();
  }, []);

  const normalized = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!normalized) return workflows;

    return workflows
      .map((w) => {
        let score = 0;

        if (w.name.toLowerCase().includes(normalized))
          score = Math.max(score, 50);

        for (const k of w.keywords) {
          const kw = k.toLowerCase();
          if (kw.startsWith(normalized)) score = Math.max(score, 90);
          else if (kw.includes(normalized)) score = Math.max(score, 60);
        }

        return { w, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.w);
  }, [normalized, workflows]);

  const safeSelectedIndex = Math.min(
    selectedIndex,
    Math.max(0, results.length - 1)
  );

  function clearAllTimers() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    timeoutRef.current = null;
    intervalRef.current = null;
    setActiveTitle(null);
    setRemainingSec(null);
  }

  function notify(title: string, body: string) {
    const stamp = new Date().toLocaleTimeString();
    const t = `${title} (${stamp})`;

    if (notifReadyRef.current) {
      sendNotification({ title: t, body });
    } else {
      alert(`${t}\n${body}`);
    }
  }

  function startCountdown(seconds: number, title: string) {
    clearAllTimers();

    setActiveTitle(title);
    setRemainingSec(seconds);

    intervalRef.current = window.setInterval(() => {
      setRemainingSec((prev) =>
        prev === null ? null : prev <= 1 ? 0 : prev - 1
      );
    }, 1000);

    timeoutRef.current = window.setTimeout(() => {
      notify(
        `Focus complete: ${title}`,
        "Session ended. Take a short break or start the next task."
      );
      clearAllTimers();
    }, seconds * 1000);
  }

  async function hideLauncher() {
    try {
      await getCurrentWindow().hide();
    } catch {}
  }

  async function openApp(appName: string) {
    try {
      const res = await Command.create("open", ["-a", appName]).execute();
      console.log("openApp ok:", appName, res);
    } catch (err) {
      console.error("openApp failed:", appName, err);
      alert(`Failed to open app: ${appName}\n${String(err)}`);
      throw err; // stop workflow if VPN can’t open
    }
  }

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function runWorkflow(w: Workflow) {
    console.log("runWorkflow:", w);

    if (w.openApp) {
      await openApp(w.openApp);
      await sleep(w.delayAfterOpenMs ?? 5000);
    }

    if (w.url) {
      try {
        await openUrl(w.url);
        console.log("openUrl ok:", w.url);
      } catch (err) {
        console.error("openUrl failed:", w.url, err);
        alert(`Failed to open URL\n${w.url}\n${String(err)}`);
      }
    }

    if (w.durationMinutes && w.durationMinutes > 0) {
      startCountdown(Math.round(w.durationMinutes * 60), w.name);
    } else {
      clearAllTimers();
    }

    await hideLauncher();
  }

  async function runSelected() {
    const w = results[safeSelectedIndex];
    if (w) await runWorkflow(w);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runSelected();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setQuery("");
      setSelectedIndex(0);
      clearAllTimers();
      hideLauncher();
    }
  }

  useEffect(() => {
    setSelectedIndex((i) => Math.min(i, Math.max(0, results.length - 1)));
  }, [results.length]);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h2 style={{ margin: 0 }}>Search-Do</h2>

      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelectedIndex(0);
        }}
        onKeyDown={onKeyDown}
        placeholder='Type keyword (e.g. "leetcode")'
        autoFocus
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid #ccc",
          fontSize: 16,
          marginTop: 10,
        }}
      />

      <div style={{ marginTop: 12 }}>
        {results.length === 0 && <div style={{ opacity: 0.6 }}>No results</div>}

        {results.map((w, i) => (
          <div
            key={w.id}
            onMouseEnter={() => setSelectedIndex(i)}
            onClick={() => runWorkflow(w)}
            style={{
              padding: "10px 12px",
              cursor: "pointer",
              background:
                i === safeSelectedIndex ? "rgba(0,0,0,0.06)" : "transparent",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <strong>{w.name}</strong>
              <div style={{ fontSize: 12, opacity: 0.6 }}>
                {w.keywords.join(", ")}
              </div>
            </div>

            {w.durationMinutes && (
              <div style={{ fontSize: 12, opacity: 0.6 }}>
                {Math.round(w.durationMinutes * 60)}s
              </div>
            )}
          </div>
        ))}
      </div>

      {remainingSec !== null && activeTitle && (
        <div
          style={{
            marginTop: 14,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #eee",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontWeight: 600 }}>{activeTitle}</div>
          <div style={{ fontVariantNumeric: "tabular-nums", opacity: 0.8 }}>
            {formatMMSS(remainingSec)}
          </div>
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.6 }}>
        ↑/↓ · Enter · Esc
      </div>
    </div>
  );
}
