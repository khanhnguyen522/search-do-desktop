import type { Workflow } from "../../app/engine";
import React, { useEffect, useRef } from "react";

export type Section = {
  title: string;
  items: Workflow[];
};

type Props = {
  sections: Section[];
  selectedIndex: number; // global index
  onSelect: (globalIndex: number) => void;
  onRun: (globalIndex: number) => void;
};

export function SearchResults({
  sections,
  selectedIndex,
  onSelect,
  onRun,
}: Props) {
  const total = sections.reduce((sum, s) => sum + s.items.length, 0);
  if (total === 0) return <div style={{ opacity: 0.65 }}>No results</div>;

  let global = 0;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const el = container.querySelector(
      `[data-index="${selectedIndex}"]`
    ) as HTMLElement | null;
    if (!el) return;

    el.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <div ref={containerRef}>
      {sections.map((sec) => {
        if (sec.items.length === 0) return null;

        return (
          <div key={sec.title} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, opacity: 0.7, margin: "6px 0" }}>
              {sec.title.toUpperCase()}
            </div>

            {sec.items.map((w) => {
              const idx = global++;
              const isSelected = idx === selectedIndex;

              return (
                <div
                  key={w.id}
                  data-index={idx}
                  onMouseEnter={() => onSelect(idx)}
                  onClick={() => onRun(idx)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    cursor: "pointer",
                    background: isSelected
                      ? "rgba(255,255,255,0.10)"
                      : "transparent",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {w.name}
                    </div>

                    <div style={{ fontSize: 11, opacity: 0.7 }}>
                      {"description" in w && w.description
                        ? w.description
                        : w.keywords.join(", ")}
                    </div>
                  </div>

                  <div style={{ fontSize: 11, opacity: 0.7 }}>
                    {w.type === "command"
                      ? "↵"
                      : w.durationMinutes
                      ? `${Math.round(w.durationMinutes * 60)}s`
                      : ""}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
