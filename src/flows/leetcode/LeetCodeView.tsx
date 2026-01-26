import { useEffect, useMemo, useRef, useState } from "react";

export type LcProblem = { slug: string; category: string };

export type LcListItem = {
  slug: string;
  category: string;
  title: string;
  url: string;
  status: "new" | "done";
};

export type LcCategoryStat = {
  key: string;
  total: number;
  done: number;
  pct: number; // 0..1
};

const theme = {
  bg0: "rgba(10,10,12,0.25)",
  bg1: "rgba(255,255,255,0.06)",
  bg2: "rgba(255,255,255,0.10)",
  stroke: "rgba(255,255,255,0.10)",
  stroke2: "rgba(255,255,255,0.16)",
  text: "rgba(255,255,255,0.92)",
  sub: "rgba(255,255,255,0.62)",
  faint: "rgba(255,255,255,0.42)",
  accent: "#7C5CFF",
  accent2: "#4BA3FF",
  good: "#3DDC97",
};

type Props = {
  tab: "today" | "category" | "random";
  category: string;
  onSetTab: (tab: "today" | "category" | "random") => void;
  onSetCategory: (cat: string) => void;
  items: LcListItem[];
  selectedIndex: number;
  onSelect: (idx: number) => void;
  categories: LcCategoryStat[];
  todayTotal: number;
  todayDone: number;
};

function Pill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        border: `1px solid ${active ? theme.stroke2 : theme.stroke}`,
        background: active ? theme.bg2 : "transparent",
        color: active ? theme.text : theme.sub,
        cursor: "pointer",
        transition: "all 120ms ease",
      }}
    >
      {label}
    </button>
  );
}

function ChipBtn({
  label,
  onClick,
  title,
}: {
  label: string;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      style={{
        fontSize: 12,
        fontWeight: 800,
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${theme.stroke}`,
        background: "rgba(255,255,255,0.04)",
        color: theme.sub,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const w = Math.max(0, Math.min(1, pct)) * 100;
  return (
    <div
      style={{
        height: 6,
        borderRadius: 999,
        background: "rgba(255,255,255,0.08)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${w}%`,
          background: `linear-gradient(90deg, ${theme.accent2}, ${theme.accent})`,
        }}
      />
    </div>
  );
}

function SectionTitle({ left, right }: { left: string; right?: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 8,
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 12, color: theme.sub }}>
        {left}
      </div>
      {right && <div style={{ fontSize: 12, color: theme.faint }}>{right}</div>}
    </div>
  );
}

export function LeetCodeView({
  tab,
  category,
  onSetTab,
  onSetCategory,
  items,
  selectedIndex,
  onSelect,
  categories,
  todayTotal,
  todayDone,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const [categoryPicking, setCategoryPicking] = useState(true);

  useEffect(() => {
    if (tab !== "category") setCategoryPicking(true);
  }, [tab]);

  useEffect(() => {
    const el = listRef.current?.querySelector(
      `[data-lc-index="${selectedIndex}"]`
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const global = useMemo(() => {
    const total = categories.reduce((s, c) => s + c.total, 0);
    const done = categories.reduce((s, c) => s + c.done, 0);
    return { total, done };
  }, [categories]);

  const activeCat = useMemo(() => {
    return (
      categories.find((c) => c.key === category) ?? {
        key: category,
        total: 0,
        done: 0,
        pct: 0,
      }
    );
  }, [categories, category]);

  const headerStats = useMemo(() => {
    if (tab === "today") {
      return {
        label: `${todayDone}/${todayTotal} done today`,
        pct: todayTotal ? todayDone / todayTotal : 0,
      };
    }

    if (tab === "category") {
      if (categoryPicking) {
        return {
          label: `${global.done}/${global.total} overall`,
          pct: global.total ? global.done / global.total : 0,
        };
      }

      return {
        label: `${activeCat.done}/${activeCat.total} done in ${activeCat.key}`,
        pct: activeCat.total ? activeCat.done / activeCat.total : 0,
      };
    }

    const it = items[0];
    const done = it?.status === "done";
    return {
      label: it ? (done ? "DONE" : "NEW") : "",
      pct: it ? (done ? 1 : 0) : 0,
    };
  }, [tab, todayDone, todayTotal, categoryPicking, global, activeCat, items]);

  const headerRight =
    tab === "today"
      ? "Enter: Open • Cmd+D: Done • Cmd+T: Add today → Todos"
      : tab === "category"
        ? categoryPicking
          ? "Pick a category"
          : "Enter: Open • Cmd+D: Done • Back to categories"
        : "Enter: Open • Cmd+D: Done";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        height: "100%",
        minHeight: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 14,
          borderRadius: 16,
          border: `1px solid ${theme.stroke}`,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
          boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
        }}
      >
        <div
          style={{ display: "flex", justifyContent: "space-between", gap: 10 }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 14, color: theme.text }}>
                LeetCode
              </div>
              <div style={{ fontSize: 12, color: theme.sub }}>
                {headerStats.label}
              </div>
            </div>
            <ProgressBar pct={headerStats.pct} />
          </div>

          <div style={{ fontSize: 12, color: theme.faint, textAlign: "right" }}>
            {headerRight}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Pill
            active={tab === "today"}
            label="Today"
            onClick={() => onSetTab("today")}
          />
          <Pill
            active={tab === "category"}
            label="Category"
            onClick={() => {
              onSetTab("category");
              setCategoryPicking(true);
            }}
          />
          <Pill
            active={tab === "random"}
            label="Random"
            onClick={() => onSetTab("random")}
          />
        </div>
      </div>

      {/* Category picker (only when tab=category and picking=true) */}
      {tab === "category" && categoryPicking && (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: 12,
            borderRadius: 16,
            border: `1px solid ${theme.stroke}`,
            background: theme.bg0,
          }}
        >
          <SectionTitle
            left="CATEGORIES"
            right={`${categories.length} total`}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            {categories.map((c) => {
              const remaining = c.total - c.done;
              const active = c.key === category;

              return (
                <button
                  key={c.key}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSetCategory(c.key);
                    setCategoryPicking(false);
                  }}
                  style={{
                    textAlign: "left",
                    padding: 12,
                    borderRadius: 14,
                    border: `1px solid ${active ? theme.stroke2 : theme.stroke}`,
                    background: active ? theme.bg2 : theme.bg1,
                    cursor: "pointer",
                    transition: "all 120ms ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 850,
                        fontSize: 13,
                        color: theme.text,
                      }}
                    >
                      {c.key}
                    </div>
                    <div style={{ fontSize: 12, color: theme.sub }}>
                      {c.done}/{c.total}
                    </div>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <ProgressBar pct={c.pct} />
                  </div>

                  <div
                    style={{ marginTop: 8, fontSize: 12, color: theme.faint }}
                  >
                    {remaining} remaining
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Category list mode header row */}
      {tab === "category" && !categoryPicking && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "0 2px",
            userSelect: "none",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Viewing:{" "}
            <span style={{ fontWeight: 850, opacity: 0.95 }}>{category}</span>
            <span style={{ opacity: 0.65 }}>
              {" "}
              • {activeCat.done}/{activeCat.total} done
            </span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <ChipBtn label="Back" onClick={() => setCategoryPicking(true)} />
          </div>
        </div>
      )}

      {/* List (Today / Random / Category list mode) */}
      {!(tab === "category" && categoryPicking) && (
        <div
          ref={listRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            borderRadius: 16,
            border: `1px solid ${theme.stroke}`,
            background: theme.bg0,
            padding: 8,
          }}
        >
          {items.length === 0 ? (
            <div
              style={{
                opacity: 0.75,
                fontSize: 13,
                padding: 12,
                color: theme.sub,
              }}
            >
              {tab === "today"
                ? "No problems in Today plan."
                : tab === "category"
                  ? "No problems in this category."
                  : "No random problem."}
            </div>
          ) : (
            items.map((it, i) => {
              const selected = i === selectedIndex;
              const done = it.status === "done";

              return (
                <div
                  key={it.slug}
                  data-lc-index={i}
                  onMouseEnter={() => onSelect(i)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 14,
                    background: selected ? theme.bg2 : "transparent",
                    border: `1px solid ${selected ? theme.stroke2 : "transparent"}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    transition: "all 120ms ease",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 850,
                        fontSize: 14,
                        color: done ? "rgba(255,255,255,0.65)" : theme.text,
                        textDecoration: done ? "line-through" : "none",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {it.title}
                    </div>

                    <div
                      style={{ fontSize: 12, color: theme.faint, marginTop: 2 }}
                    >
                      {it.category} • {it.slug}
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 900,
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: `1px solid ${
                        done ? "rgba(61,220,151,0.35)" : theme.stroke
                      }`,
                      color: done ? theme.good : theme.sub,
                      background: done
                        ? "rgba(61,220,151,0.10)"
                        : "rgba(255,255,255,0.04)",
                      flexShrink: 0,
                    }}
                  >
                    {done ? "DONE" : "NEW"}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
