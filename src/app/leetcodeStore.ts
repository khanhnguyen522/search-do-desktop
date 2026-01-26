import {
  readTextFile,
  writeTextFile,
  mkdir,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";

export type LcStatus = "new" | "done";

export type LcProgressItem = {
  slug: string;
  status: LcStatus;
  solvedCount: number;
  lastSolvedAt?: number;
};

export type LcTodayPlan = {
  ymd: string; // "YYYY-MM-DD"
  slugs: string[];
};

export type LcState = {
  version: 1;
  settings: { dailyNew: number };
  progress: Record<string, LcProgressItem>;
  lastOpenedSlug?: string;
  todayPlan?: LcTodayPlan;
};

const DIR = "search-do";
const FILE = `${DIR}/leetcode_state.json`;

export const defaultLcState: LcState = {
  version: 1,
  settings: { dailyNew: 2 },
  progress: {},
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function normalizeState(raw: unknown): LcState {
  if (!isRecord(raw)) return defaultLcState;

  const version = raw.version;
  if (version !== 1) return defaultLcState;

  const settingsRaw = isRecord(raw.settings) ? raw.settings : {};
  const dailyNew =
    typeof settingsRaw.dailyNew === "number" ? settingsRaw.dailyNew : undefined;

  const progress = isRecord(raw.progress)
    ? (raw.progress as Record<string, LcProgressItem>)
    : defaultLcState.progress;

  const tpRaw = raw.todayPlan;
  const todayPlan: LcTodayPlan | undefined =
    isRecord(tpRaw) &&
    typeof tpRaw.ymd === "string" &&
    Array.isArray(tpRaw.slugs) &&
    tpRaw.slugs.every((x) => typeof x === "string")
      ? { ymd: tpRaw.ymd, slugs: tpRaw.slugs }
      : undefined;

  const lastOpenedSlug =
    typeof raw.lastOpenedSlug === "string" ? raw.lastOpenedSlug : undefined;

  return {
    ...defaultLcState,
    version: 1,
    settings: {
      ...defaultLcState.settings,
      ...(dailyNew != null ? { dailyNew } : {}),
    },
    progress,
    lastOpenedSlug,
    todayPlan,
  };
}

export async function loadLcState(): Promise<LcState> {
  try {
    const text = await readTextFile(FILE, { baseDir: BaseDirectory.AppData });
    const data: unknown = JSON.parse(text);
    return normalizeState(data);
  } catch {
    return defaultLcState;
  }
}

export async function saveLcState(state: LcState) {
  await mkdir(DIR, { baseDir: BaseDirectory.AppData, recursive: true });
  const text = JSON.stringify(state, null, 2);
  await writeTextFile(FILE, text, { baseDir: BaseDirectory.AppData });
}
