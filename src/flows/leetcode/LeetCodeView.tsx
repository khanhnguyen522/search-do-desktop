import { useEffect, useMemo, useRef, useState } from "react";
import { YearHeatmap } from "../../ui/YearHeatmap";

export type LcDifficulty = "easy" | "medium" | "hard";

export type LcProblem = {
  slug: string;
  category: string;
  difficulty?: "easy" | "medium" | "hard";
};

export type LcListItem = {
  slug: string;
  category: string;
  difficulty: LcDifficulty;
  title: string;
  url: string;
  status: "new" | "done";
};

export type LcCategoryStat = {
  key: string;
  total: number;
  done: number;
  pct: number;
};

export type LcDashboard = {
  total: number;
  done: number;
  pct: number;
  totalByDiff: Record<LcDifficulty, number>;
  doneByDiff: Record<LcDifficulty, number>;
  solvedCountByYmd: Record<string, number>;
  monthStartMs: number;
  currentStreak: number;
  bestStreak: number;
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
  warn: "#F5C451",
  bad: "#FF6B6B",
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
  countByYmd: Record<string, number>;
  dashboard: LcDashboard;

  // ✅ NEW: source of truth for status (fix Today not reflecting done)
  statusBySlug?: Record<string, "new" | "done">;
};

const ui = {
  headerTitleSize: 13,
  headerTitleWeight: 860 as const,
  headerSubSize: 11,
  headerSubWeight: 620 as const,
  itemTitleSize: 13,
  itemTitleWeight: 760 as const,
  itemSubSize: 11,
  itemSubWeight: 540 as const,
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
        fontWeight: active ? 760 : 650,
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

function SectionTitle({ left, right }: { left: string; right?: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 10,
        userSelect: "none",
      }}
    >
      <div style={{ fontWeight: 750, fontSize: 11, color: theme.faint }}>
        {left}
      </div>
      {right && <div style={{ fontSize: 11, color: theme.faint }}>{right}</div>}
    </div>
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

function Donut3({
  done,
  total,
  doneByDiff,
  totalByDiff,
  footer,
}: {
  done: number;
  total: number;
  doneByDiff: Record<LcDifficulty, number>;
  totalByDiff: Record<LcDifficulty, number>;
  footer: string;
}) {
  const r = 26;
  const c = 2 * Math.PI * r;

  const gap = 6;

  const order: LcDifficulty[] = ["easy", "medium", "hard"];
  const colorOf: Record<LcDifficulty, string> = {
    easy: theme.good,
    medium: theme.warn,
    hard: theme.bad,
  };

  const safeTotal = total > 0 ? total : 1;
  const segLen = (d: LcDifficulty) => (c * (totalByDiff[d] || 0)) / safeTotal;
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

  let offset = 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
      }}
    >
      <svg width={74} height={74} viewBox="0 0 74 74">
        <g transform="translate(37 37) rotate(-90)">
          <circle
            r={r}
            cx="0"
            cy="0"
            fill="transparent"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth="8"
          />

          {order.map((d) => {
            const rawSeg = segLen(d);
            if (rawSeg <= 0) return null;

            const seg = Math.max(0, rawSeg - gap);

            const t = totalByDiff[d] || 0;
            const dn = doneByDiff[d] || 0;
            const pct = t ? clamp01(dn / t) : 0;

            const doneLen = seg * pct;
            const remLen = seg - doneLen;

            const start = offset + gap / 2;
            const dashOffset = -start;

            offset += rawSeg;

            return (
              <g key={d}>
                {remLen > 0 && (
                  <circle
                    r={r}
                    cx="0"
                    cy="0"
                    fill="transparent"
                    stroke="rgba(255,255,255,0.14)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${seg} ${c - seg}`}
                    strokeDashoffset={dashOffset}
                    opacity={0.9}
                  />
                )}

                {doneLen > 0 && (
                  <circle
                    r={r}
                    cx="0"
                    cy="0"
                    fill="transparent"
                    stroke={colorOf[d]}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${doneLen} ${c - doneLen}`}
                    strokeDashoffset={dashOffset}
                    opacity={0.95}
                  />
                )}
              </g>
            );
          })}
        </g>

        <text
          x="37"
          y="38"
          textAnchor="middle"
          fontSize="18"
          fontWeight="900"
          fill={theme.text}
        >
          {done}
        </text>
        <text
          x="37"
          y="55"
          textAnchor="middle"
          fontSize="11"
          fontWeight="750"
          fill={theme.faint}
        >
          /{total}
        </text>
      </svg>

      <div style={{ fontSize: 11, color: theme.faint, fontWeight: 700 }}>
        {footer}
      </div>
    </div>
  );
}

function DifficultyRow({
  label,
  color,
  done,
  total,
}: {
  label: string;
  color: string;
  done: number;
  total: number;
}) {
  const pct = total ? done / total : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{ width: 64, fontSize: 11, fontWeight: 750, color: theme.sub }}
      >
        {label}
      </div>
      <div style={{ flex: 1 }}>
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
              width: `${Math.round(pct * 100)}%`,
              background: color,
              opacity: 0.9,
            }}
          />
        </div>
      </div>
      <div
        style={{
          width: 52,
          textAlign: "right",
          fontSize: 11,
          fontWeight: 750,
          color: theme.faint,
        }}
      >
        {done}/{total}
      </div>
    </div>
  );
}

function ymdLocal(ts: number) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function DiffBadge({ d }: { d: LcDifficulty }) {
  const cfg =
    d === "easy"
      ? {
          label: "EASY",
          c: theme.good,
          bg: "rgba(61,220,151,0.10)",
          bd: "rgba(61,220,151,0.30)",
        }
      : d === "medium"
        ? {
            label: "MED",
            c: theme.warn,
            bg: "rgba(245,196,81,0.10)",
            bd: "rgba(245,196,81,0.30)",
          }
        : {
            label: "HARD",
            c: theme.bad,
            bg: "rgba(255,107,107,0.10)",
            bd: "rgba(255,107,107,0.30)",
          };

  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 900,
        padding: "5px 8px",
        borderRadius: 999,
        border: `1px solid ${cfg.bd}`,
        color: cfg.c,
        background: cfg.bg,
        letterSpacing: 0.4,
        userSelect: "none",
      }}
    >
      {cfg.label}
    </div>
  );
}

type HeaderStats = { label: string; pct: number; showBar: boolean };
type LcPanel = "problems" | "stats";
type HeatRange = "6m" | "12m";

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
  countByYmd,
  dashboard,
  statusBySlug,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const [categoryPicking, setCategoryPicking] = useState(true);
  const [panel, setPanel] = useState<LcPanel>("problems");
  const [heatRange, setHeatRange] = useState<HeatRange>("12m");

  const resolvedItems: LcListItem[] = useMemo(() => {
    if (!statusBySlug) return items;
    return items.map((it) => {
      const s = statusBySlug[it.slug];
      return s ? { ...it, status: s } : it;
    });
  }, [items, statusBySlug]);

  const footerHint =
    panel === "stats"
      ? "Esc: Back • Switch tab: Problems/Stats"
      : tab === "category" && categoryPicking
        ? "Enter: Pick • Esc: Back"
        : tab === "category" && !categoryPicking
          ? "Enter: Open • Cmd/Ctrl+D: Done • Back: Categories"
          : "Enter: Open • Cmd/Ctrl+D: Done";

  useEffect(() => {
    if (tab !== "category") setCategoryPicking(true);
  }, [tab]);

  useEffect(() => {
    if (panel !== "problems") return;

    const el = listRef.current?.querySelector(
      `[data-lc-index="${selectedIndex}"]`
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, panel]);

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

    const it = resolvedItems[0];
    const done = it?.status === "done";
    return {
      label: it ? (done ? "DONE" : "NEW") : "Random pick",
      pct: 0,
      showBar: false,
    };
  }, [
    tab,
    todayDone,
    todayTotal,
    categoryPicking,
    global,
    activeCat,
    resolvedItems,
  ]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        height: "100%",
        minHeight: 0,
        minWidth: 0,
        overflowX: "hidden",
      }}
    >
      <div
        style={{
          padding: 12,
          borderRadius: ui.radius,
          border: `1px solid ${theme.stroke}`,
          background: "rgba(255,255,255,0.03)",
          minWidth: 0,
          overflowX: "hidden",
        }}
      >
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
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 10,
              width: "100%",
              minWidth: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
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
                {panel === "stats"
                  ? `${Math.round(dashboard.pct * 100)}% overall`
                  : headerStats.label}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <Pill
                active={panel === "problems"}
                label="Problems"
                onClick={() => setPanel("problems")}
              />
              <Pill
                active={panel === "stats"}
                label="Stats"
                onClick={() => setPanel("stats")}
              />
            </div>
          </div>

          {panel === "problems" && headerStats.showBar && (
            <ProgressBar pct={headerStats.pct} />
          )}
        </div>

        {panel === "problems" && (
          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {tab === "category" && !categoryPicking && (
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  setCategoryPicking(true);
                }}
                title="Back to categories"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontSize: ui.chipSize,
                  fontWeight: 760,
                  border: `1px solid ${theme.stroke}`,
                  background: "rgba(255,255,255,0.04)",
                  color: theme.text,
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <span style={{ fontSize: 14, lineHeight: 1 }}>←</span>
                Back
              </button>
            )}

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
        )}
      </div>

      {panel === "stats" && (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              padding: 12,
              borderRadius: ui.radius,
              border: `1px solid ${theme.stroke}`,
              background: "rgba(255,255,255,0.03)",
              minWidth: 0,
            }}
          >
            <SectionTitle
              left="OVERVIEW"
              right={`${Math.round(dashboard.pct * 100)}%`}
            />

            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <Donut3
                done={dashboard.done}
                total={dashboard.total}
                doneByDiff={dashboard.doneByDiff}
                totalByDiff={dashboard.totalByDiff}
                footer="Solved"
              />

              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 9,
                  minWidth: 0,
                }}
              >
                <DifficultyRow
                  label="Easy"
                  color={theme.good}
                  done={dashboard.doneByDiff.easy}
                  total={dashboard.totalByDiff.easy}
                />
                <DifficultyRow
                  label="Medium"
                  color={theme.warn}
                  done={dashboard.doneByDiff.medium}
                  total={dashboard.totalByDiff.medium}
                />
                <DifficultyRow
                  label="Hard"
                  color={theme.bad}
                  done={dashboard.doneByDiff.hard}
                  total={dashboard.totalByDiff.hard}
                />
              </div>
            </div>
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: ui.radius,
              border: `1px solid ${theme.stroke}`,
              background: "rgba(255,255,255,0.03)",
              overflow: "hidden",
              minWidth: 0,
            }}
          >
            <SectionTitle left="STREAK" right="Activity" />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 12,
                marginBottom: 10,
              }}
            >
              <div style={{ display: "flex", gap: 16 }}>
                <div>
                  <div
                    style={{ fontSize: 20, fontWeight: 950, color: theme.text }}
                  >
                    {dashboard.currentStreak}
                  </div>
                  <div style={{ fontSize: 11, color: theme.faint }}>
                    Current
                  </div>
                </div>
                <div>
                  <div
                    style={{ fontSize: 20, fontWeight: 950, color: theme.text }}
                  >
                    {dashboard.bestStreak}
                  </div>
                  <div style={{ fontSize: 11, color: theme.faint }}>Best</div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{ fontSize: 11, color: theme.sub, textAlign: "right" }}
                >
                  Today{" "}
                  <span style={{ fontWeight: 950, color: theme.text }}>
                    {dashboard.solvedCountByYmd[ymdLocal(Date.now())] ?? 0}
                  </span>
                </div>

                <select
                  value={heatRange}
                  onChange={(e) => {
                    const v = e.target.value;
                    const next: HeatRange = v === "6m" ? "6m" : "12m";
                    setHeatRange(next);
                  }}
                  style={{
                    fontSize: 11,
                    fontWeight: 750,
                    color: theme.text,
                    background: "rgba(255,255,255,0.06)",
                    border: `1px solid ${theme.stroke}`,
                    borderRadius: 10,
                    padding: "6px 8px",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="6m">Last 6 months</option>
                  <option value="12m">Last 12 months</option>
                </select>
              </div>
            </div>

            <YearHeatmap countByYmd={countByYmd} range={heatRange} />
          </div>
        </div>
      )}

      {panel === "problems" && (
        <>
          {tab === "category" && categoryPicking && (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                overflowX: "hidden",
                padding: 10,
                borderRadius: ui.radius,
                border: `1px solid ${theme.stroke}`,
                background: "rgba(255,255,255,0.015)",
                minWidth: 0,
              }}
            >
              <SectionTitle
                left="CATEGORIES"
                right={`${categories.length} total`}
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 10,
                  minWidth: 0,
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
                        border: `1px solid ${
                          active ? theme.stroke2 : theme.stroke
                        }`,
                        background: active
                          ? "rgba(255,255,255,0.06)"
                          : "rgba(255,255,255,0.03)",
                        cursor: "pointer",
                        userSelect: "none",
                        width: "100%",
                        boxSizing: "border-box",
                        minWidth: 0,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          alignItems: "baseline",
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: 12,
                            color: theme.text,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          {c.key}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: theme.sub,
                            flexShrink: 0,
                          }}
                        >
                          {c.done}/{c.total}
                        </div>
                      </div>

                      <div style={{ marginTop: 8, minWidth: 0 }}>
                        <ProgressBar pct={c.pct} />
                      </div>

                      <div
                        style={{
                          marginTop: 7,
                          fontSize: 11,
                          color: theme.faint,
                        }}
                      >
                        {remaining} remaining
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
                minWidth: 0,
              }}
            >
              {resolvedItems.length === 0 ? (
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
                resolvedItems.map((it, i) => {
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

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        <DiffBadge d={it.difficulty} />

                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 900,
                            padding: "5px 9px",
                            borderRadius: 999,
                            border: `1px solid ${
                              done ? "rgba(61,220,151,0.35)" : theme.stroke
                            }`,
                            color: done ? theme.good : theme.sub,
                            background: done
                              ? "rgba(61,220,151,0.10)"
                              : "rgba(255,255,255,0.03)",
                            userSelect: "none",
                            opacity: 0.95,
                          }}
                        >
                          {done ? "DONE" : "NEW"}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}

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
