import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";

export default function App() {
  const [query, setQuery] = useState("");

  async function run() {
    const q = query.trim().toLowerCase();

    if (q === "leetcode") {
      await openUrl("https://leetcode.com");
      return;
    }

    alert(`Không tìm thấy workflow cho: "${query}"`);
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Search → Do (Day 1)</h2>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder='Gõ "leetcode"'
        onKeyDown={(e) => e.key === "Enter" && run()}
        autoFocus
        style={{ padding: 10, width: "100%", marginBottom: 12 }}
      />

      <button onClick={run} style={{ padding: 10 }}>
        Run
      </button>
    </div>
  );
}
