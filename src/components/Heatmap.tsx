"use client";

import { useMemo } from "react";
import { addDays, fromKey, weekStart } from "@/lib/dates";

interface Props {
  values: Map<string, number>;
  today: string;
  weeks: number;
  color: string;
  /** Show weekday and month labels (the big version). */
  labels?: boolean;
  gap?: number;
}

const DAYS = ["M", "", "W", "", "F", "", "S"];

/** Weeks run left to right, Monday on top. The newest week is the last column. */
export function Heatmap({ values, today, weeks, color, labels = false, gap = 3 }: Props) {
  const { cells, months } = useMemo(() => {
    const first = addDays(weekStart(today), -(weeks - 1) * 7);
    const list: { key: string; v: number | null; future: boolean }[] = [];
    const monthMarks: { col: number; name: string }[] = [];
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const key = addDays(first, w * 7 + d);
        list.push({ key, v: values.get(key) ?? null, future: key > today });
        if (d === 0) {
          const date = fromKey(key);
          if (date.getDate() <= 7) monthMarks.push({ col: w, name: date.toLocaleDateString("en-GB", { month: "short" }) });
        }
      }
    }
    return { cells: list, months: monthMarks };
  }, [values, today, weeks]);

  const grid = (
    <div
      className="grid"
      style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`, gridTemplateRows: "repeat(7, auto)", gridAutoFlow: "column", gap }}
    >
      {cells.map((c) => (
        <div
          key={c.key}
          title={c.future ? undefined : c.key}
          className="aspect-square rounded-[3px]"
          style={{
            background: c.future
              ? "transparent"
              : c.v === null
                ? "#232327"
                : `color-mix(in srgb, ${color} ${Math.round(28 + c.v * 72)}%, var(--color-pit))`,
            boxShadow: c.key === today ? `0 0 0 1.5px var(--color-ash)` : undefined,
          }}
        />
      ))}
    </div>
  );

  if (!labels) return grid;

  return (
    <div className="flex gap-2">
      <div className="grid grid-rows-7 pt-[18px] text-[11px] leading-none text-dim" style={{ gap }}>
        {DAYS.map((d, i) => (
          <span key={i} className="flex items-center">{d}</span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative mb-1.5 h-3 text-[11px] leading-none text-dim">
          {months.map((m) => (
            <span key={m.col} className="absolute" style={{ left: `${(m.col / weeks) * 100}%` }}>
              {m.name}
            </span>
          ))}
        </div>
        {grid}
      </div>
    </div>
  );
}
