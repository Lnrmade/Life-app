import { addDays, daysBetween, fromKey, monthOf, weekStart } from "./dates";
import type { LifeData, Logs, Settings, TrackerId } from "./types";

/* ---------- XP ---------- */

const gymXp = (minutes: number) => 40 + Math.min(60, Math.round(minutes / 2));
const sportXp = (minutes: number) => 30 + Math.min(60, Math.round(minutes / 2));

const sleepXp = (hours: number, goal: number) => {
  const r = hours / goal;
  if (r >= 0.95) return 30;
  if (r >= 0.85) return 20;
  if (r >= 0.7) return 10;
  return 0;
};

const sumByDay = <T extends { date: string }>(rows: T[], value: (row: T) => number) => {
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.date, (map.get(row.date) ?? 0) + value(row));
  return map;
};

export interface XpBreakdown {
  gym: number;
  sport: number;
  sleep: number;
  work: number;
  finance: number;
  savings: number;
  strength: number;
  total: number;
}

export function xpBreakdown(logs: Logs, settings: Settings): XpBreakdown {
  const gym = logs.gym.reduce((s, l) => s + gymXp(l.minutes), 0);
  const sport = logs.sport.reduce((s, l) => s + sportXp(l.minutes), 0);
  const sleep = logs.sleep.reduce((s, l) => s + sleepXp(l.hours, settings.sleepHours), 0);
  let work = 0;
  for (const hours of sumByDay(logs.work, (l) => l.hours).values()) work += Math.min(80, Math.round(hours * 8));
  let finance = 0;
  for (const count of sumByDay(logs.finance, () => 1).values()) finance += Math.min(15, count * 5);
  const savings = logs.savings.reduce((s, l) => s + (l.amount > 0 ? Math.min(50, Math.round(l.amount / 10)) : 0), 0);
  return { gym, sport, sleep, work, finance, savings, strength: gym + sport, total: gym + sport + sleep + work + finance + savings };
}

/** XP a single new entry is worth, for the "+XP" toast. */
export function xpForEntry(id: TrackerId, entry: Record<string, unknown>, settings: Settings): number {
  switch (id) {
    case "gym": return gymXp(Number(entry.minutes));
    case "sport": return sportXp(Number(entry.minutes));
    case "sleep": return sleepXp(Number(entry.hours), settings.sleepHours);
    case "work": return Math.min(80, Math.round(Number(entry.hours) * 8));
    case "finance": return 5;
    case "savings": return Number(entry.amount) > 0 ? Math.min(50, Math.round(Number(entry.amount) / 10)) : 0;
  }
}

/* ---------- Level ---------- */

/** XP needed to reach level n: 150, 450, 900, 1500 ... */
export const xpForLevel = (n: number) => (150 * n * (n + 1)) / 2;

const TITLES: [number, string][] = [
  [0, "Newcomer"], [2, "Rookie"], [5, "Regular"], [9, "Grinder"], [14, "Machine"], [20, "Boss"], [30, "Legend"],
];

export function levelFrom(totalXp: number) {
  let level = 0;
  while (xpForLevel(level + 1) <= totalXp) level++;
  const floor = xpForLevel(level);
  const span = xpForLevel(level + 1) - floor;
  let title = TITLES[0][1];
  for (const [min, name] of TITLES) if (level >= min) title = name;
  return { level, into: totalXp - floor, span, title };
}

/* ---------- Body ---------- */

export const BODY_NAMES = ["Normal", "Toned", "Fit", "Athletic", "Buff", "Jacked"];
export const BODY_THRESHOLDS = [0, 600, 2000, 4500, 8000, 13000];
/** Days without training before he drops a stage. */
export const DETRAIN_DAYS = 14;

export function bodyFrom(logs: Logs, strengthXp: number, today: string) {
  let earned = 0;
  for (let i = 0; i < BODY_THRESHOLDS.length; i++) if (strengthXp >= BODY_THRESHOLDS[i]) earned = i;
  let last = "";
  for (const l of logs.gym) if (l.date > last) last = l.date;
  for (const l of logs.sport) if (l.date > last) last = l.date;
  const idleDays = last ? Math.max(0, daysBetween(last, today)) : 0;
  const lost = Math.min(earned, Math.floor(idleDays / DETRAIN_DAYS));
  const nextAt = earned < BODY_THRESHOLDS.length - 1 ? BODY_THRESHOLDS[earned + 1] : null;
  return { stage: earned - lost, earned, lost, idleDays, xp: strengthXp, nextAt };
}

/* ---------- Money ---------- */

export const WEALTH_NAMES = ["Broke", "Getting by", "Comfortable", "Doing well", "Loaded", "Rich"];
/** Share of the rich target needed for each outfit tier. */
export const WEALTH_STEPS = [0, 0.02, 0.1, 0.25, 0.5, 1];
export const MAX_BILLS = 12;

export function moneyFrom(logs: Logs, settings: Settings, today: string) {
  const month = monthOf(today);
  let income = 0, expense = 0, monthIn = 0, monthOut = 0;
  for (const tx of logs.finance) {
    if (tx.type === "income") { income += tx.amount; if (monthOf(tx.date) === month) monthIn += tx.amount; }
    else { expense += tx.amount; if (monthOf(tx.date) === month) monthOut += tx.amount; }
  }
  const moved = logs.savings.reduce((s, l) => s + l.amount, 0);
  const saved = settings.openingSavings + moved;
  const cash = settings.openingCash + income - expense - moved;
  return { cash, saved, total: cash + saved, monthIn, monthOut };
}

export function wealthFrom(total: number, richTarget: number) {
  const target = Math.max(1, richTarget);
  const r = Math.max(0, total) / target;
  let tier = 0;
  for (let i = 0; i < WEALTH_STEPS.length; i++) if (r >= WEALTH_STEPS[i]) tier = i;
  if (total <= 0) tier = 0;
  const bills = total <= 0 ? 0 : Math.max(1, Math.min(MAX_BILLS, Math.ceil(MAX_BILLS * Math.sqrt(r))));
  const floor = r < 0.5 ? 0 : r < 1 ? 1 : Math.min(6, 1 + Math.floor(r));
  const nextAt = tier < WEALTH_STEPS.length - 1 ? WEALTH_STEPS[tier + 1] * target : null;
  return { tier, bills, floor, nextAt };
}

/* ---------- Energy (sleep) ---------- */

export type Energy = "tired" | "ok" | "rested";

export function energyFrom(logs: Logs, settings: Settings, today: string) {
  const since = addDays(today, -6);
  const recent = logs.sleep.filter((l) => l.date >= since && l.date <= today);
  if (!recent.length) return { energy: "ok" as Energy, avg: null as number | null, nights: 0 };
  const avg = recent.reduce((s, l) => s + l.hours, 0) / recent.length;
  const gap = settings.sleepHours - avg;
  const energy: Energy = gap <= 0.5 ? "rested" : gap <= 1.5 ? "ok" : "tired";
  return { energy, avg, nights: recent.length };
}

/* ---------- Streak ---------- */

export function activeDays(logs: Logs) {
  const days = new Set<string>();
  for (const list of Object.values(logs)) for (const l of list as { date: string }[]) days.add(l.date);
  return days;
}

/** Consecutive days with at least one log. Today may still be open. */
export function streakFrom(logs: Logs, today: string) {
  const days = activeDays(logs);
  let cursor = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(cursor)) { n++; cursor = addDays(cursor, -1); }
  return n;
}

/* ---------- Per-tracker views ---------- */

export const TRACKERS: { id: TrackerId; name: string; color: string; verb: string }[] = [
  { id: "gym", name: "Gym", color: "var(--color-gym)", verb: "Log workout" },
  { id: "sport", name: "Sport", color: "var(--color-sport)", verb: "Log session" },
  { id: "sleep", name: "Sleep", color: "var(--color-sleep)", verb: "Log sleep" },
  { id: "work", name: "Work", color: "var(--color-work)", verb: "Log hours" },
  { id: "finance", name: "Finance", color: "var(--color-finance)", verb: "Add transaction" },
  { id: "savings", name: "Savings", color: "var(--color-savings)", verb: "Move money" },
];

export const trackerMeta = (id: TrackerId) => TRACKERS.find((t) => t.id === id)!;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Heatmap intensity per day, 0..1. Days without a log are absent. */
export function dayValues(id: TrackerId, logs: Logs, settings: Settings): Map<string, number> {
  const out = new Map<string, number>();
  const put = (date: string, v: number) => out.set(date, Math.max(out.get(date) ?? 0, v));
  switch (id) {
    case "gym":
      for (const [d, m] of sumByDay(logs.gym, (l) => l.minutes)) put(d, 0.45 + 0.55 * clamp01(m / 60));
      break;
    case "sport":
      for (const [d, m] of sumByDay(logs.sport, (l) => l.minutes)) put(d, 0.45 + 0.55 * clamp01(m / 60));
      break;
    case "sleep":
      for (const l of logs.sleep) put(l.date, 0.2 + 0.8 * clamp01((l.hours - 4) / Math.max(1, settings.sleepHours - 4)));
      break;
    case "work":
      for (const [d, h] of sumByDay(logs.work, (l) => l.hours)) put(d, 0.25 + 0.75 * clamp01(h / Math.max(1, settings.workHoursPerWeek / 5)));
      break;
    case "finance":
      for (const [d, c] of sumByDay(logs.finance, () => 1)) put(d, 0.4 + 0.6 * clamp01(c / 3));
      break;
    case "savings":
      for (const [d, a] of sumByDay(logs.savings, (l) => l.amount)) if (a > 0) put(d, 0.45 + 0.55 * clamp01(a / 200));
      break;
  }
  return out;
}

export interface TrackerSummary {
  /** Short line under the name, e.g. "2 of 4 this week". */
  line: string;
  /** 0..1 towards this period's goal. */
  progress: number;
}

export function summarize(id: TrackerId, data: Pick<LifeData, "logs" | "settings">, today: string): TrackerSummary {
  const { logs, settings } = data;
  const monday = weekStart(today);
  const inWeek = <T extends { date: string }>(rows: T[]) => rows.filter((l) => l.date >= monday && l.date <= today);
  switch (id) {
    case "gym": {
      const n = inWeek(logs.gym).length;
      return { line: `${n} of ${settings.gymPerWeek} this week`, progress: clamp01(n / settings.gymPerWeek) };
    }
    case "sport": {
      const n = inWeek(logs.sport).length;
      return { line: `${n} of ${settings.sportPerWeek} this week`, progress: clamp01(n / settings.sportPerWeek) };
    }
    case "sleep": {
      const { avg } = energyFrom(logs, settings, today);
      return {
        line: avg === null ? `Goal ${settings.sleepHours}h a night` : `${avg.toFixed(1).replace(".", ",")}h average this week`,
        progress: avg === null ? 0 : clamp01(avg / settings.sleepHours),
      };
    }
    case "work": {
      const h = inWeek(logs.work).reduce((s, l) => s + l.hours, 0);
      return { line: `${Math.round(h * 10) / 10} of ${settings.workHoursPerWeek}h this week`, progress: clamp01(h / settings.workHoursPerWeek) };
    }
    case "finance": {
      const m = moneyFrom(logs, settings, today);
      const net = m.monthIn - m.monthOut;
      return { line: `${net >= 0 ? "+" : "−"}€${Math.abs(Math.round(net)).toLocaleString("nl-NL")} in ${fromKey(today).toLocaleDateString("en-GB", { month: "short" })}`, progress: m.monthIn > 0 ? clamp01(net / m.monthIn) : 0 };
    }
    case "savings": {
      const m = moneyFrom(logs, settings, today);
      const pct = settings.savingsGoal > 0 ? clamp01(m.saved / settings.savingsGoal) : 0;
      return { line: `${Math.round(pct * 100)}% of €${settings.savingsGoal.toLocaleString("nl-NL")}`, progress: pct };
    }
  }
}

/* ---------- Everything the character needs ---------- */

export interface Look {
  stage: number; // body 0..5
  tier: number; // outfit 0..5
  bills: number; // thickness of the stack in his hands, 0..12
  floor: number; // cash bricks at his feet
  energy: Energy;
  aura: boolean; // 7-day streak
  skin: number;
  hair: number;
}

export function gameState(data: Pick<LifeData, "logs" | "settings">, today: string) {
  const xp = xpBreakdown(data.logs, data.settings);
  const level = levelFrom(xp.total);
  const body = bodyFrom(data.logs, xp.strength, today);
  const money = moneyFrom(data.logs, data.settings, today);
  const wealth = wealthFrom(money.total, data.settings.richTarget);
  const sleep = energyFrom(data.logs, data.settings, today);
  const streak = streakFrom(data.logs, today);
  const look: Look = {
    stage: body.stage,
    tier: wealth.tier,
    bills: wealth.bills,
    floor: wealth.floor,
    energy: sleep.energy,
    aura: streak >= 7,
    skin: data.settings.skin,
    hair: data.settings.hair,
  };
  return { xp, level, body, money, wealth, sleep, streak, look };
}
