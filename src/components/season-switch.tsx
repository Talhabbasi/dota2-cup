"use client";

import { Children, useState, type ReactNode } from "react";

export function SeasonSwitch({
  labels,
  notes,
  ariaLabel,
  children,
}: {
  labels: string[];
  notes?: string[];
  ariaLabel: string;
  children: ReactNode;
}) {
  const panels = Children.toArray(children);
  const [index, setIndex] = useState(0);
  const current = Math.min(index, Math.max(panels.length - 1, 0));

  return (
    <div>
      <div className="team-view-toggle team-season-tabs" role="tablist" aria-label={ariaLabel}>
        {labels.map((label, i) => {
          const on = i === current;
          return (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={on}
              className={on ? "active" : ""}
              onClick={() => setIndex(i)}
            >
              {label}
            </button>
          );
        })}
      </div>
      {notes?.[current] ? <p className="team-season-note">{notes[current]}</p> : null}
      {panels[current] ?? null}
    </div>
  );
}
