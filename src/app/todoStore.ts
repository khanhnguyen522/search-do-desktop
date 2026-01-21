import {
  BaseDirectory,
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import type { Workflow } from "./engine";

export type TodoWorkflow = Extract<Workflow, { type: "todo" }>;

const DIR = "search-do";
const FILE = `${DIR}/todos.json`;

function safeParseJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function getStr(x: Record<string, unknown>, key: string): string | undefined {
  const v = x[key];
  return typeof v === "string" ? v : undefined;
}

function getNum(x: Record<string, unknown>, key: string): number | undefined {
  const v = x[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function getBool(x: Record<string, unknown>, key: string): boolean | undefined {
  const v = x[key];
  return typeof v === "boolean" ? v : undefined;
}

function getStrArray(x: Record<string, unknown>, key: string): string[] {
  const v = x[key];
  if (!Array.isArray(v)) return [];
  return v.filter((t): t is string => typeof t === "string");
}

function normalizeTodo(x: unknown): TodoWorkflow | null {
  if (!isRecord(x)) return null;
  if (x.type !== "todo") return null;

  const createdAt = getNum(x, "createdAt") ?? Date.now();

  const id =
    getStr(x, "id")?.trim() ||
    // stable-ish fallback (avoid changing every load)
    `todo-${createdAt}-${Math.random().toString(16).slice(2, 8)}`;

  const name = getStr(x, "name") ?? "Untitled";
  const description = getStr(x, "description");

  const keywordsRaw = getStrArray(x, "keywords");
  const keywords = keywordsRaw.length > 0 ? keywordsRaw : ["todo"];

  const tags = getStrArray(x, "tags");

  let status: "active" | "done" | "archived" = "active";
  const statusRaw = getStr(x, "status");
  if (
    statusRaw === "active" ||
    statusRaw === "done" ||
    statusRaw === "archived"
  ) {
    status = statusRaw;
  } else {
    const done = getBool(x, "done") ?? false;
    const archived = getBool(x, "archived") ?? false;
    if (archived) status = "archived";
    else if (done) status = "done";
    else status = "active";
  }

  const completedAt = getNum(x, "completedAt");
  const archivedAt = getNum(x, "archivedAt");
  const dueAt = getNum(x, "dueAt");

  const url = getStr(x, "url");
  const openApp = getStr(x, "openApp");
  const delayAfterOpenMs = getNum(x, "delayAfterOpenMs");
  const durationMinutes = getNum(x, "durationMinutes");

  return {
    id,
    type: "todo",
    name,
    keywords,
    description,
    status,
    createdAt,
    completedAt,
    archivedAt,
    tags,
    dueAt,
    url,
    openApp,
    delayAfterOpenMs,
    durationMinutes,
  };
}

async function ensureDir() {
  const dirExists = await exists(DIR, { baseDir: BaseDirectory.AppData });
  if (!dirExists) {
    await mkdir(DIR, { baseDir: BaseDirectory.AppData });
  }
}

export async function loadTodos(): Promise<TodoWorkflow[]> {
  await ensureDir();

  const ok = await exists(FILE, { baseDir: BaseDirectory.AppData });
  if (!ok) return [];

  const text = await readTextFile(FILE, { baseDir: BaseDirectory.AppData });
  const raw = safeParseJson<unknown[]>(text, []);

  const todos: TodoWorkflow[] = [];
  for (const item of raw) {
    const t = normalizeTodo(item);
    if (t) todos.push(t);
  }

  return todos;
}

export async function saveTodos(todos: TodoWorkflow[]) {
  await ensureDir();

  await writeTextFile(FILE, JSON.stringify(todos, null, 2), {
    baseDir: BaseDirectory.AppData,
  });
}
