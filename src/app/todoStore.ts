import {
  readTextFile,
  writeTextFile,
  mkdir,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";

export type TodoWorkflow = {
  id: string;
  type: "todo";
  name: string;
  keywords: string[];
  description?: string;
  status: "active" | "done" | "archived";
  createdAt: number;
  completedAt?: number;
  archivedAt?: number;
  tags: string[];
  dueAt?: number;
  url?: string;
  openApp?: string;
  delayAfterOpenMs?: number;
  durationMinutes?: number;
};

const DIR = "search-do";
const FILE = `${DIR}/todos.json`;

export async function loadTodos(): Promise<TodoWorkflow[]> {
  try {
    const text = await readTextFile(FILE, { baseDir: BaseDirectory.AppData });
    const data = JSON.parse(text);
    return Array.isArray(data) ? (data as TodoWorkflow[]) : [];
  } catch (err) {
    console.debug("loadTodos:", err);
    return [];
  }
}

export async function saveTodos(todos: TodoWorkflow[]) {
  try {
    await mkdir(DIR, { baseDir: BaseDirectory.AppData, recursive: true });
    const text = JSON.stringify(todos, null, 2);
    await writeTextFile(FILE, text, { baseDir: BaseDirectory.AppData });
    console.log("saved todos to AppData:", FILE);
  } catch (err) {
    console.error("saveTodos failed:", err);
    throw err;
  }
}
