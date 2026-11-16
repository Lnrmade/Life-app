"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Heatmap } from "@/components/Heatmap";
import { LogSheet } from "@/components/LogSheet";
import { PixelIcon } from "@/components/PixelIcon";
import { Bar, PrimaryButton, Stepper, Tile } from "@/components/ui";
import { addDays, relativeDay, todayKey, weekStart } from "@/lib/dates";
import { hoursLabel, money, n1 } from "@/lib/format";
import { TRACKERS, dayValues, moneyFrom, summarize, trackerMeta } from "@/lib/game";
import { useLife } from "@/lib/store";
import type { GymLog, MoneyTx, SavingsTx, SleepLog, SportLog, TrackerId, WorkLog } from "@/lib/types";

type AnyLog = GymLog | SportLog | SleepLog | WorkLog | MoneyTx | SavingsTx;

export default function TrackerPage() {
  const { id } = useParams<{ id: string }>();
  if (!TRACKERS.some((t) => t.id === id)) notFound();
  return <Tracker id={id as TrackerId} />;
}

function Tracker({ id }: { id: TrackerId }) {
  const meta = trackerMeta(id);
  const logs = useLife((s) => s.logs);
  const settings = useLife((s) => s.settings);
  const setSettings = useLife((s) => s.setSettings);
  const removeLog = useLife((s) => s.removeLog);
  const [logging, setLogging] = useState(false);
  const [shown, setShown] = useState(30);

  const today = todayKey();
  const sum = summarize(id, { logs, settings }, today);
  const values = useMemo(() => dayValues(id, logs, settings), [id, logs, settings]);
  const history = useMemo(
    () => [...(logs[id] as AnyLog[])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [logs, id],
  );

  const monday = weekStart(today);
  const last30 = addDays(today, -29);
  const wallet = moneyFrom(logs, settings, today);

  const tiles: { value: string; label: string }[] = (() => {
    switch (id) {
      case "gym": {
        const week = logs.gym.filter((l) => l.date >= monday).length;
        const mins = logs.gym.reduce((s, l) => s + l.minutes, 0);
        return [
          { value: `${week}/${settings.gymPerWeek}`, label: "This week" },
          { value: String(logs.gym.length), label: "Workouts" },
          { value: `${Math.round(mins / 60)}h`, label: "Under the bar" },
        ];
      }
      case "sport": {
        const week = logs.sport.filter((l) => l.date >= monday).length;
        const km = logs.sport.reduce((s, l) => s + (l.km ?? 0), 0);
        return [
          { value: `${week}/${settings.sportPerWeek}`, label: "This week" },
          { value: String(logs.sport.length), label: "Sessions" },
          { value: `${n1(km)} km`, label: "Distance" },
        ];
      }
      case "sleep": {
        const avg = (rows: SleepLog[]) => (rows.length ? rows.reduce((s, l) => s + l.hours, 0) / rows.length : null);
        const a7 = avg(logs.sleep.filter((l) => l.date >= addDays(today, -6)));
        const a30 = avg(logs.sleep.filter((l) => l.date >= last30));
        const hit = logs.sleep.filter((l) => l.date >= last30 && l.hours >= settings.sleepHours - 0.25).length;
        return [
          { value: a7 === null ? "–" : hoursLabel(Math.round(a7 * 4) / 4), label: "7-day average" },
          { value: a30 === null ? "–" : hoursLabel(Math.round(a30 * 4) / 4), label: "30-day average" },
          { value: String(hit), label: "Nights on goal, 30 days" },
        ];
      }
      case "work": {
        const week = logs.work.filter((l) => l.date >= monday).reduce((s, l) => s + l.hours, 0);
        const month = logs.work.filter((l) => l.date >= last30).reduce((s, l) => s + l.hours, 0);
        const total = logs.work.reduce((s, l) => s + l.hours, 0);
        return [
          { value: `${n1(week)}h`, label: `Of ${settings.workHoursPerWeek}h this week` },
          { value: `${n1(month)}h`, label: "Last 30 days" },
          { value: `${Math.round(total)}h`, label: "All time" },
        ];
      }
      case "finance":
        return [
          { value: money(wallet.cash), label: "Cash" },
          { value: money(wallet.monthIn), label: "In this month" },
          { value: money(wallet.monthOut), label: "Out this month" },
        ];
      case "savings":
        return [
          { value: money(wallet.saved), label: "Saved" },
          { value: `${Math.round(sum.progress * 100)}%`, label: "Of your goal" },
          { value: money(Math.max(0, settings.savingsGoal - wallet.saved)), label: "To go" },
        ];
    }
  })();

  const describe = (l: AnyLog): { main: string; sub?: string; amount?: { text: string; good: boolean } } => {
    switch (id) {
      case "gym": { const g = l as GymLog; return { main: g.kind, sub: [`${g.minutes} min`, g.note].filter(Boolean).join(", ") }; }
      case "sport": { const s = l as SportLog; return { main: s.sport, sub: [`${s.minutes} min`, s.km ? `${n1(s.km)} km` : ""].filter(Boolean).join(", ") }; }
      case "sleep": return { main: hoursLabel((l as SleepLog).hours) };
      case "work": { const w = l as WorkLog; return { main: hoursLabel(w.hours), sub: w.note }; }
      case "finance": {
        const t = l as MoneyTx;
        return { main: t.category, sub: t.note, amount: { text: `${t.type === "income" ? "+" : "−"}${money(t.amount)}`, good: t.type === "income" } };
      }
      case "savings": {
        const s = l as SavingsTx;
        return { main: s.amount >= 0 ? "Into savings" : "Out of savings", sub: s.note, amount: { text: `${s.amount >= 0 ? "+" : "−"}${money(Math.abs(s.amount))}`, good: s.amount >= 0 } };
      }
    }
  };

  return (
    <main className="mx-auto max-w-[640px]" style={{ "--tc": meta.color } as React.CSSProperties}>
      <header className="mb-5 flex items-center gap-3">
        <Link href="/" aria-label="Back to home" className="grid size-10 place-items-center rounded-full bg-coal text-ash hover:text-bone">
          <PixelIcon name="back" size={14} />
        </Link>
        <span className="text-(--tc)">
          <PixelIcon name={id} size={22} />
        </span>
        <div>
          <h1 className="font-pixel text-[34px] leading-none">{meta.name}</h1>
          <p className="mt-1 text-[13px] text-ash">{sum.line}</p>
        </div>
      </header>

      <section className="rounded-[20px] bg-coal p-4">
        <div className="mb-4 grid grid-cols-3 gap-2">
          {tiles.map((t) => (
            <Tile key={t.label} value={t.value} label={t.label} />
          ))}
        </div>
        {id === "savings" && (
          <div className="mb-4">
            <Bar value={sum.progress} height={12} />
          </div>
        )}
        <Heatmap values={values} today={today} weeks={20} color={meta.color} labels gap={4} />
        <PrimaryButton className="mt-4" onClick={() => setLogging(true)}>
          {meta.verb}
        </PrimaryButton>
      </section>

      <section className="mt-4 rounded-[20px] bg-coal p-4">
        <h2 className="mb-3 font-pixel text-[23px] leading-none">Goal</h2>
        {id === "gym" && (
          <GoalRow text="Workouts a week">
            <Stepper label="workouts a week" value={settings.gymPerWeek} min={1} max={14} onChange={(v) => setSettings({ gymPerWeek: v })} />
          </GoalRow>
        )}
        {id === "sport" && (
          <GoalRow text="Sessions a week">
            <Stepper label="sessions a week" value={settings.sportPerWeek} min={1} max={14} onChange={(v) => setSettings({ sportPerWeek: v })} />
          </GoalRow>
        )}
        {id === "sleep" && (
          <GoalRow text="Hours a night">
            <Stepper label="hours a night" value={settings.sleepHours} min={5} max={10} step={0.5} format={hoursLabel} onChange={(v) => setSettings({ sleepHours: v })} />
          </GoalRow>
        )}
        {id === "work" && (
          <GoalRow text="Hours a week">
            <Stepper label="hours a week" value={settings.workHoursPerWeek} min={5} max={90} step={5} format={(v) => `${v}h`} onChange={(v) => setSettings({ workHoursPerWeek: v })} />
          </GoalRow>
        )}
        {(id === "finance" || id === "savings") && (
          <p className="text-[14px] text-ash">
            Starting balances, your savings goal and the amount that counts as rich are in{" "}
            <Link href="/settings" className="text-bone underline underline-offset-4">
              settings
            </Link>
            .
          </p>
        )}
      </section>

      <section className="mt-4 rounded-[20px] bg-coal p-4">
        <h2 className="mb-1 font-pixel text-[23px] leading-none">History</h2>
        {history.length === 0 ? (
          <p className="pt-2 text-[14px] text-ash">Nothing logged yet. Your first entry lights up today&apos;s square.</p>
        ) : (
          <ul className="divide-y divide-line">
            {history.slice(0, shown).map((l) => {
              const d = describe(l);
              return (
                <li key={l.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{d.main}</div>
                    <div className="truncate text-[13px] text-ash">
                      {relativeDay(l.date, today)}
                      {d.sub ? `, ${d.sub}` : ""}
                    </div>
                  </div>
                  {d.amount && (
                    <div className={`font-pixel text-[22px] tabular-nums ${d.amount.good ? "text-savings" : "text-bone"}`}>{d.amount.text}</div>
                  )}
                  <button
                    type="button"
                    aria-label={`Delete entry from ${relativeDay(l.date, today)}`}
                    onClick={() => removeLog(id, l.id)}
                    className="grid size-10 shrink-0 place-items-center rounded-full text-dim hover:bg-pit hover:text-bad"
                  >
                    <PixelIcon name="trash" size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {history.length > shown && (
          <button type="button" onClick={() => setShown((n) => n + 50)} className="mt-2 h-11 w-full rounded-xl bg-pit text-[14px] text-ash hover:text-bone">
            Show older entries
          </button>
        )}
      </section>

      <LogSheet tracker={logging ? id : null} onClose={() => setLogging(false)} />
    </main>
  );
}

function GoalRow({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[15px] text-ash">{text}</span>
      {children}
    </div>
  );
}
