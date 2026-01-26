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

/** ✅ Typography tuned to match TodosView vibe */
const ui = {
  headerTitleSize: 13,
  headerTitleWeight: 760 as const,
  headerSubSize: 11,
  headerSubWeight: 520 as const,

  itemTitleSize: 13,
  itemTitleWeight: 740 as const,
  itemSubSize: 11,
  itemSubWeight: 520 as const,

  hintSize: 11,
  chipSize: 12,
  radius: 14,
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
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: ui.chipSize,
        fontWeight: active ? 700 : 600,
        border: `1px solid ${active ? theme.stroke2 : theme.stroke}`,
        background: active ? "rgba(255,255,255,0.08)" : "transparent",
        color: active ? theme.text : theme.sub,
        cursor: "pointer",
        userSelect: "none",
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
        fontSize: ui.chipSize,
        fontWeight: 650,
        padding: "5px 9px",
        borderRadius: 999,
        border: `1px solid ${theme.stroke}`,
        background: "rgba(255,255,255,0.03)",
        color: theme.sub,
        cursor: "pointer",
        userSelect: "none",
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
        width: "100%",
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
        userSelect: "none",
      }}
    >
      <div style={{ fontWeight: 650, fontSize: 11, color: theme.faint }}>
        {left}
      </div>
      {right && <div style={{ fontSize: 11, color: theme.faint }}>{right}</div>}
    </div>
  );
}

type HeaderStats = {
  label: string;
  pct: number;
  showBar: boolean;
};

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

  // footer hint like TodosView
  const footerHint =
    tab === "category" && categoryPicking
      ? "Enter: Pick • Esc: Back"
      : tab === "category" && !categoryPicking
        ? "Enter: Open • Cmd/Ctrl+D: Done • Back: Categories"
        : "Enter: Open • Cmd/Ctrl+D: Done";

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

  const headerStats: HeaderStats = useMemo(() => {
    if (tab === "today") {
      return {
        label: `${todayDone}/${todayTotal} done today`,
        pct: todayTotal ? todayDone / todayTotal : 0,
        showBar: true,
      };
    }

    if (tab === "category") {
      if (categoryPicking) {
        return {
          label: `${global.done}/${global.total} overall`,
          pct: global.total ? global.done / global.total : 0,
          showBar: true,
        };
      }

      return {
        label: `${activeCat.done}/${activeCat.total} done in ${activeCat.key}`,
        pct: activeCat.total ? activeCat.done / activeCat.total : 0,
        showBar: true,
      };
    }

    // ✅ Random: no progress bar (less noisy)
    const it = items[0];
    const done = it?.status === "done";
    return {
      label: it
        ? done
          ? "Random pick • DONE"
          : "Random pick • NEW"
        : "Random pick",
      pct: 0,
      showBar: false,
    };
  }, [tab, todayDone, todayTotal, categoryPicking, global, activeCat, items]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        height: "100%",
        minHeight: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 12,
          borderRadius: ui.radius,
          border: `1px solid ${theme.stroke}`,
          background: "rgba(255,255,255,0.03)",
        }}
      >
        {/* title + label */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            width: "100%",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              width: "100%",
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontWeight: ui.headerTitleWeight,
                fontSize: ui.headerTitleSize,
                color: theme.text,
                flexShrink: 0,
              }}
            >
              LeetCode
            </div>

            <div
              style={{
                fontSize: ui.headerSubSize,
                fontWeight: ui.headerSubWeight,
                color: theme.sub,
                minWidth: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {headerStats.label}
            </div>
          </div>

          {/* ✅ Full-width progress (only when needed) */}
          {headerStats.showBar && <ProgressBar pct={headerStats.pct} />}
        </div>

        {/* pills */}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
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

      {/* Category picker */}
      {tab === "category" && categoryPicking && (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: 10,
            borderRadius: ui.radius,
            border: `1px solid ${theme.stroke}`,
            background: "rgba(255,255,255,0.015)",
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
                    padding: 10,
                    borderRadius: 12,
                    border: `1px solid ${active ? theme.stroke2 : theme.stroke}`,
                    background: active
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(255,255,255,0.03)",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      alignItems: "baseline",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 12,
                        color: theme.text,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        minWidth: 0,
                      }}
                    >
                      {c.key}
                    </div>
                    <div style={{ fontSize: 11, color: theme.sub }}>
                      {c.done}/{c.total}
                    </div>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <ProgressBar pct={c.pct} />
                  </div>

                  <div
                    style={{ marginTop: 7, fontSize: 11, color: theme.faint }}
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
          <div
            style={{
              fontSize: 12,
              color: theme.sub,
              minWidth: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Viewing:{" "}
            <span style={{ fontWeight: 750, color: theme.text }}>
              {category}
            </span>
            <span style={{ opacity: 0.7 }}>
              {" "}
              • {activeCat.done}/{activeCat.total} done
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <ChipBtn label="Back" onClick={() => setCategoryPicking(true)} />
          </div>
        </div>
      )}

      {/* List */}
      {!(tab === "category" && categoryPicking) && (
        <div
          ref={listRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            borderRadius: ui.radius,
            border: `1px solid ${theme.stroke}`,
            background: "rgba(255,255,255,0.015)",
            padding: 6,
          }}
        >
          {items.length === 0 ? (
            <div
              style={{
                opacity: 0.7,
                fontSize: 12,
                padding: "10px 8px",
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
                    padding: "9px 10px",
                    borderRadius: 12,
                    background: selected
                      ? "rgba(255,255,255,0.08)"
                      : "transparent",
                    border: selected
                      ? `1px solid ${theme.stroke2}`
                      : "1px solid transparent",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: ui.itemTitleWeight,
                        fontSize: ui.itemTitleSize,
                        color: done ? "rgba(255,255,255,0.70)" : theme.text,
                        textDecoration: done ? "line-through" : "none",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {it.title}
                    </div>

                    <div
                      style={{
                        fontSize: ui.itemSubSize,
                        fontWeight: ui.itemSubWeight,
                        color: theme.faint,
                        marginTop: 2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {it.category} • {it.slug}
                    </div>
                  </div>

                  {/* status badge */}
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 750,
                      padding: "5px 9px",
                      borderRadius: 999,
                      border: `1px solid ${
                        done ? "rgba(61,220,151,0.35)" : theme.stroke
                      }`,
                      color: done ? theme.good : theme.sub,
                      background: done
                        ? "rgba(61,220,151,0.10)"
                        : "rgba(255,255,255,0.03)",
                      flexShrink: 0,
                      userSelect: "none",
                      opacity: 0.95,
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

      {/* Footer hint (like TodosView) */}
      <div
        style={{
          marginTop: "auto",
          fontSize: ui.hintSize,
          color: theme.faint,
          userSelect: "none",
          paddingTop: 6,
        }}
      >
        {footerHint}
      </div>
    </div>
  );
}
