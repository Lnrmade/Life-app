"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useAuth } from "@/components/AuthContext";
import { Character } from "@/components/Character";
import { PixelIcon } from "@/components/PixelIcon";
import { Label, Stepper, TextInput } from "@/components/ui";
import { requestWipe, syncNow, useSyncStatus } from "@/lib/cloud";
import { todayKey } from "@/lib/dates";
import { demoData } from "@/lib/demo";
import { hoursLabel, parseAmount } from "@/lib/format";
import { gameState } from "@/lib/game";
import { snapshot, useLife } from "@/lib/store";
import { cloudEnabled, supabase } from "@/lib/supabase";
import { EMPTY_DATA } from "@/lib/types";
import type { LifeData, Settings } from "@/lib/types";

const SKINS = ["#f2c9a4", "#e0a676", "#c0875a", "#8a583a"];
const HAIRS = ["#1c1b20", "#4b2e1c", "#b78338", "#8a8a90"];

function EuroField({ id, label, hint, field }: { id: string; label: string; hint?: string; field: keyof Settings }) {
  const stored = useLife((s) => s.settings[field]) as number;
  const setSettings = useLife((s) => s.setSettings);
  const [text, setText] = useState(String(stored).replace(".", ","));
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ash">€</span>
        <TextInput
          id={id}
          inputMode="decimal"
          className="pl-9"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const v = parseAmount(e.target.value);
            if (Number.isFinite(v)) setSettings({ [field]: v });
          }}
        />
      </div>
      {hint && <p className="mt-1.5 text-[13px] text-ash">{hint}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const settings = useLife((s) => s.settings);
  const logs = useLife((s) => s.logs);
  const setSettings = useLife((s) => s.setSettings);
  const replaceAll = useLife((s) => s.replaceAll);
  const file = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const look = gameState({ logs, settings }, todayKey()).look;
  const { user, offline } = useAuth();
  const sync = useSyncStatus();
  const [busy, setBusy] = useState(false);

  const syncLine =
    offline || sync.state === "offline" ? "Offline. Changes upload when you are back online."
    : sync.state === "syncing" ? "Syncing"
    : sync.state === "error" ? `Could not sync: ${sync.error}`
    : sync.lastAt ? `Synced at ${new Date(sync.lastAt).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}`
    : "Not synced yet";

  const signOut = async () => {
    if (!supabase) return;
    setBusy(true);
    await syncNow();
    const unsent = useSyncStatus.getState().state !== "idle";
    if (unsent && !confirm("Some changes could not be uploaded yet. They stay on this device and upload next time you log in here. Log out anyway?")) {
      setBusy(false);
      return;
    }
    await supabase.auth.signOut();
  };

  const deleteAccount = async () => {
    if (!supabase) return;
    if (!confirm("Delete your account and everything in it? Your logins and all your data are removed for good. This cannot be undone.")) return;
    setBusy(true);
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setBusy(false);
      setMessage(`Could not delete the account: ${error.message}`);
      return;
    }
    requestWipe();
    await supabase.auth.signOut({ scope: "local" });
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `life-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMessage("Backup downloaded.");
  };

  const importData = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as LifeData;
      if (!data || typeof data !== "object" || !data.logs) throw new Error("not a backup");
      replaceAll(data);
      setMessage("Backup restored.");
    } catch {
      setMessage("That file is not a Life backup. Pick a .json file exported from this page.");
    }
  };

  return (
    <main className="mx-auto max-w-[640px]">
      <header className="mb-5 flex items-center gap-3">
        <Link href="/" aria-label="Back to home" className="grid size-10 place-items-center rounded-full bg-coal text-ash hover:text-bone">
          <PixelIcon name="back" size={14} />
        </Link>
        <h1 className="font-pixel text-[34px] leading-none">Settings</h1>
      </header>

      <section className="mb-4 rounded-[20px] bg-coal p-4">
        <h2 className="mb-3 font-pixel text-[23px] leading-none">Account</h2>
        {cloudEnabled && user ? (
          <div className="space-y-3">
            <div>
              <div className="font-medium">{user.email}</div>
              <p role="status" className="text-[14px] text-ash">{syncLine}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => void syncNow()} disabled={sync.state === "syncing"} className="h-12 rounded-xl bg-pit font-medium hover:bg-line disabled:opacity-40">
                Sync now
              </button>
              <button type="button" onClick={() => void signOut()} disabled={busy} className="h-12 rounded-xl bg-pit font-medium hover:bg-line disabled:opacity-40">
                Log out
              </button>
            </div>
            <button type="button" onClick={() => void deleteAccount()} disabled={busy} className="h-11 w-full text-[14px] text-bad underline underline-offset-4 disabled:opacity-40">
              Delete my account and data
            </button>
          </div>
        ) : (
          <p className="text-[14px] text-ash">
            Accounts are not set up, so your data stays on this device only. Use the backup below to move it somewhere else.
          </p>
        )}
      </section>

      <section className="rounded-[20px] bg-coal p-4">
        <h2 className="mb-3 font-pixel text-[23px] leading-none">Your character</h2>
        <div className="flex items-center gap-4">
          <div className="stage-dots shrink-0 rounded-xl bg-ink">
            <Character look={look} width={120} />
          </div>
          <div className="space-y-4">
            <Swatches label="Skin" colors={SKINS} value={settings.skin} onChange={(skin) => setSettings({ skin })} />
            <Swatches label="Hair" colors={HAIRS} value={settings.hair} onChange={(hair) => setSettings({ hair })} />
            <Link href="/evolution" className="inline-block text-[14px] text-bone underline underline-offset-4">
              See every stage he can reach
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-4 space-y-4 rounded-[20px] bg-coal p-4">
        <h2 className="font-pixel text-[23px] leading-none">Money</h2>
        <EuroField id="cash" field="openingCash" label="Cash you start with" hint="What is in your current account today. Transactions you log add to or subtract from this." />
        <EuroField id="saved" field="openingSavings" label="Savings you start with" />
        <EuroField id="goal" field="savingsGoal" label="Savings goal" />
        <EuroField id="rich" field="richTarget" label="Rich means" hint="Cash plus savings at which he wears the suit and the stack in his hands is at its thickest. Outfits unlock at 2%, 10%, 25%, 50% and 100% of this." />
        <label className="flex items-center justify-between gap-4 pt-1">
          <span className="text-[15px]">Wishlist counts savings as money you can spend</span>
          <input
            type="checkbox"
            className="size-6 accent-(--color-cash)"
            checked={settings.wishIncludesSavings}
            onChange={(e) => setSettings({ wishIncludesSavings: e.target.checked })}
          />
        </label>
      </section>

      <section className="mt-4 space-y-4 rounded-[20px] bg-coal p-4">
        <h2 className="font-pixel text-[23px] leading-none">Weekly goals</h2>
        <Row text="Gym workouts a week">
          <Stepper label="gym workouts a week" value={settings.gymPerWeek} min={1} max={14} onChange={(v) => setSettings({ gymPerWeek: v })} />
        </Row>
        <Row text="Sport sessions a week">
          <Stepper label="sport sessions a week" value={settings.sportPerWeek} min={1} max={14} onChange={(v) => setSettings({ sportPerWeek: v })} />
        </Row>
        <Row text="Sleep a night">
          <Stepper label="hours of sleep" value={settings.sleepHours} min={5} max={10} step={0.5} format={hoursLabel} onChange={(v) => setSettings({ sleepHours: v })} />
        </Row>
        <Row text="Work hours a week">
          <Stepper label="work hours a week" value={settings.workHoursPerWeek} min={5} max={90} step={5} format={(v) => `${v}h`} onChange={(v) => setSettings({ workHoursPerWeek: v })} />
        </Row>
      </section>

      <section className="mt-4 rounded-[20px] bg-coal p-4">
        <h2 className="mb-2 font-pixel text-[23px] leading-none">Your data</h2>
        <p className="mb-4 text-[14px] text-ash">
          {user
            ? "Your data syncs to your account, so it follows you to every device you log in on. A backup file is optional."
            : "Everything is stored in this browser on this device. Nothing is uploaded. Download a backup now and then, and use it to move to another phone or laptop."}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={exportData} className="h-12 rounded-xl bg-pit font-medium hover:bg-line">
            Download backup
          </button>
          <button type="button" onClick={() => file.current?.click()} className="h-12 rounded-xl bg-pit font-medium hover:bg-line">
            Restore backup
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(user ? "Replace everything in your account with six months of example data? Use Erase everything afterwards to start for real." : "Replace everything with six months of example data?")) {
                replaceAll(demoData());
                setMessage("Example data loaded. Erase everything to start for real.");
              }
            }}
            className="h-12 rounded-xl bg-pit font-medium hover:bg-line"
          >
            Load example data
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(user ? "Erase all logs, lists, trips and settings in your account, on every device? This cannot be undone." : "Erase all logs, lists, trips and settings on this device? This cannot be undone.")) {
                replaceAll(EMPTY_DATA);
                setMessage("Everything erased.");
              }
            }}
            className="h-12 rounded-xl bg-pit font-medium text-bad hover:bg-line"
          >
            Erase everything
          </button>
        </div>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importData(f);
            e.target.value = "";
          }}
        />
        <p role="status" className="mt-3 min-h-5 text-[14px] text-cash">
          {message}
        </p>
      </section>
    </main>
  );
}

function Row({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[15px]">{text}</span>
      {children}
    </div>
  );
}

function Swatches({ label, colors, value, onChange }: { label: string; colors: string[]; value: number; onChange: (i: number) => void }) {
  return (
    <div>
      <div className="mb-1.5 text-[13px] text-ash">{label}</div>
      <div className="flex gap-2" role="radiogroup" aria-label={label}>
        {colors.map((c, i) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={`${label} ${i + 1}`}
            onClick={() => onChange(i)}
            className={`size-9 rounded-lg ${value === i ? "ring-2 ring-bone ring-offset-2 ring-offset-coal" : ""}`}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}
