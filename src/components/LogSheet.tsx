"use client";

import { useMemo, useState } from "react";
import { addDays, relativeDay, todayKey } from "@/lib/dates";
import { hoursLabel, parseAmount } from "@/lib/format";
import { gameState, trackerMeta, xpForEntry } from "@/lib/game";
import { snapshot, useLife } from "@/lib/store";
import type { CharacterEffect } from "@/lib/store";
import type { TrackerId } from "@/lib/types";
import { Sheet } from "./Sheet";
import { Chips, Label, PrimaryButton, Stepper, TextInput } from "./ui";

const GYM_KINDS = ["Push", "Pull", "Legs", "Upper", "Lower", "Full body", "Cardio"] as const;
const SPORTS = ["Football", "Running", "Padel", "Cycling", "Swimming", "Boxing", "Tennis", "Basketball"];
const MINUTES = [30, 45, 60, 75, 90, 120] as const;
const EXPENSE_CATS = ["Groceries", "Rent", "Eating out", "Transport", "Subscriptions", "Clothes", "Fun", "Other"] as const;
const INCOME_CATS = ["Salary", "Client", "Side job", "Gift", "Refund", "Other"] as const;

function DateChips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const today = todayKey();
  const quick = [today, addDays(today, -1), addDays(today, -2)];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chips label="Day" options={quick} value={quick.includes(value) ? value : null} onChange={onChange} format={(k) => relativeDay(k, today)} />
      <input
        type="date"
        aria-label="Pick another day"
        max={today}
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="h-10 rounded-full border border-line bg-ink px-3 text-[15px] text-ash"
      />
    </div>
  );
}

function MoneyInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-ink px-4 focus-within:border-(--tc)">
      <span className="font-pixel text-[34px] text-ash">€</span>
      <input
        inputMode="decimal"
        autoFocus={autoFocus}
        aria-label="Amount in euros"
        placeholder="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-16 w-full bg-transparent font-pixel text-[41px] text-bone placeholder:text-dim focus:outline-none"
      />
    </div>
  );
}

export function LogSheet({ tracker, onClose }: { tracker: TrackerId | null; onClose: () => void }) {
  const meta = tracker ? trackerMeta(tracker) : null;
  return (
    <Sheet open={!!tracker} onClose={onClose} title={meta?.verb ?? ""} color={meta?.color}>
      {tracker && <LogForm key={tracker} tracker={tracker} onDone={onClose} />}
    </Sheet>
  );
}

function LogForm({ tracker, onDone }: { tracker: TrackerId; onDone: () => void }) {
  const addLog = useLife((s) => s.addLog);
  const fire = useLife((s) => s.fire);
  const settings = useLife((s) => s.settings);
  const pastSports = useLife((s) => s.logs.sport);

  const [date, setDate] = useState(todayKey());
  const [kind, setKind] = useState<string>("Push");
  const [sport, setSport] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [km, setKm] = useState("");
  const [hours, setHours] = useState(tracker === "sleep" ? settings.sleepHours : 8);
  const [note, setNote] = useState("");
  const [txType, setTxType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState<string>("Groceries");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"in" | "out">("in");

  const switchType = (t: "income" | "expense") => {
    setTxType(t);
    setCategory(t === "expense" ? "Groceries" : "Salary");
  };

  // Sports you have logged before come first.
  const sportOptions = useMemo(() => {
    const seen = [...new Set(pastSports.map((l) => l.sport).reverse())];
    return [...seen, ...SPORTS.filter((s) => !seen.includes(s))].slice(0, 8);
  }, [pastSports]);

  const value = parseAmount(amount);
  const amountOk = Number.isFinite(value) && value > 0;
  const valid =
    tracker === "sport" ? sport.trim().length > 0 && minutes > 0
    : tracker === "gym" ? minutes > 0
    : tracker === "finance" || tracker === "savings" ? amountOk
    : hours > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const before = gameState(snapshot(), todayKey()).level.level;
    let entry: Record<string, unknown>;
    let effect: CharacterEffect = "spark";
    switch (tracker) {
      case "gym":
        entry = { date, kind, minutes, note: note.trim() || undefined };
        addLog("gym", entry as never);
        effect = "flex";
        break;
      case "sport": {
        const dist = parseAmount(km);
        entry = { date, sport: sport.trim(), minutes, km: Number.isFinite(dist) && dist > 0 ? dist : undefined };
        addLog("sport", entry as never);
        effect = "flex";
        break;
      }
      case "sleep":
        entry = { date, hours };
        addLog("sleep", entry as never);
        effect = "zzz";
        break;
      case "work":
        entry = { date, hours, note: note.trim() || undefined };
        addLog("work", entry as never);
        break;
      case "finance":
        entry = { date, type: txType, amount: value, category, note: note.trim() || undefined };
        addLog("finance", entry as never);
        effect = txType === "income" ? "cash" : "spark";
        break;
      case "savings":
        entry = { date, amount: direction === "in" ? value : -value, note: note.trim() || undefined };
        addLog("savings", entry as never);
        effect = direction === "in" ? "cash" : "spark";
        break;
    }
    const after = gameState(snapshot(), todayKey()).level.level;
    fire({
      effect,
      xp: xpForEntry(tracker, entry, settings),
      label: after > before ? `Level ${after}!` : trackerMeta(tracker).name,
    });
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {tracker === "gym" && (
        <>
          <div>
            <Label>What did you train?</Label>
            <Chips label="Workout" options={GYM_KINDS} value={kind} onChange={setKind} />
          </div>
          <div>
            <Label>How long?</Label>
            <Chips label="Minutes" options={MINUTES} value={minutes} onChange={setMinutes} format={(m) => `${m} min`} />
          </div>
        </>
      )}

      {tracker === "sport" && (
        <>
          <div>
            <Label htmlFor="sport">Which sport?</Label>
            <TextInput id="sport" value={sport} onChange={(e) => setSport(e.target.value)} placeholder="Football, padel, running" autoComplete="off" />
            <div className="mt-2">
              <Chips label="Sport" options={sportOptions} value={sportOptions.includes(sport) ? sport : null} onChange={setSport} />
            </div>
          </div>
          <div>
            <Label>How long?</Label>
            <Chips label="Minutes" options={MINUTES} value={minutes} onChange={setMinutes} format={(m) => `${m} min`} />
          </div>
          <div>
            <Label htmlFor="km">Distance in km (optional)</Label>
            <TextInput id="km" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} placeholder="5,2" />
          </div>
        </>
      )}

      {tracker === "sleep" && (
        <div>
          <Label>How long did you sleep?</Label>
          <div className="flex flex-col items-center gap-4 rounded-xl bg-ink py-5">
            <Stepper label="hours slept" value={hours} onChange={setHours} step={0.25} min={0.25} max={16} format={hoursLabel} />
            <input type="range" aria-label="Hours slept" min={2} max={12} step={0.25} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="w-[80%]" />
            <p className="text-[13px] text-ash">Your goal is {hoursLabel(settings.sleepHours)} a night.</p>
          </div>
        </div>
      )}

      {tracker === "work" && (
        <>
          <div>
            <Label>Hours worked</Label>
            <div className="flex justify-center rounded-xl bg-ink py-5">
              <Stepper label="hours worked" value={hours} onChange={setHours} step={0.5} min={0.5} max={18} format={hoursLabel} />
            </div>
          </div>
          <div>
            <Label htmlFor="note">What on? (optional)</Label>
            <TextInput id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Client site, outreach, admin" />
          </div>
        </>
      )}

      {tracker === "finance" && (
        <>
          <Chips label="Type" options={["expense", "income"] as const} value={txType} onChange={switchType} format={(t) => (t === "expense" ? "Money out" : "Money in")} />
          <MoneyInput value={amount} onChange={setAmount} autoFocus />
          <div>
            <Label>Category</Label>
            <Chips label="Category" options={txType === "expense" ? EXPENSE_CATS : INCOME_CATS} value={category} onChange={setCategory} />
          </div>
          <div>
            <Label htmlFor="note">Note (optional)</Label>
            <TextInput id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was it?" />
          </div>
        </>
      )}

      {tracker === "savings" && (
        <>
          <Chips label="Direction" options={["in", "out"] as const} value={direction} onChange={setDirection} format={(d) => (d === "in" ? "Into savings" : "Out of savings")} />
          <MoneyInput value={amount} onChange={setAmount} autoFocus />
          <p className="text-[13px] text-ash">
            {direction === "in" ? "Moves money from your cash to your savings." : "Moves money from your savings back to your cash."}
          </p>
          <div>
            <Label htmlFor="note">Note (optional)</Label>
            <TextInput id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Holiday fund, buffer" />
          </div>
        </>
      )}

      <div>
        <Label>{tracker === "sleep" ? "Woke up on" : "When?"}</Label>
        <DateChips value={date} onChange={setDate} />
      </div>

      <PrimaryButton type="submit" disabled={!valid}>
        Save
      </PrimaryButton>
    </form>
  );
}
