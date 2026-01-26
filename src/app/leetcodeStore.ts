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

function normalizeState(raw: any): LcState {
  if (!raw || raw.version !== 1) return defaultLcState;

  return {
    ...defaultLcState,
    ...raw,
    settings: {
      ...defaultLcState.settings,
      ...(raw.settings ?? {}),
    },
    progress: raw.progress ?? {},
    todayPlan: raw.todayPlan,
  };
}

export async function loadLcState(): Promise<LcState> {
  try {
    const text = await readTextFile(FILE, { baseDir: BaseDirectory.AppData });
    const data = JSON.parse(text);
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
