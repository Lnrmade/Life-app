"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Character } from "@/components/Character";
import { Heatmap } from "@/components/Heatmap";
import { LogSheet } from "@/components/LogSheet";
import { PixelIcon } from "@/components/PixelIcon";
import { Bar } from "@/components/ui";
import { prettyDate, todayKey } from "@/lib/dates";
import { money, n1 } from "@/lib/format";
import { BODY_NAMES, DETRAIN_DAYS, TRACKERS, WEALTH_NAMES, dayValues, gameState, summarize } from "@/lib/game";
import { useLife } from "@/lib/store";
import type { TrackerId } from "@/lib/types";

const ENERGY_NAMES = { tired: "Tired", ok: "Steady", rested: "Rested" } as const;

export default function Home() {
  const logs = useLife((s) => s.logs);
  const settings = useLife((s) => s.settings);
  const event = useLife((s) => s.event);
  const [logging, setLogging] = useState<TrackerId | null>(null);

  // After a log, bring the character into view so you see him react.
  useEffect(() => {
    if (event && Date.now() - event.at < 500) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [event]);

  const today = todayKey();
  const game = useMemo(() => gameState({ logs, settings }, today), [logs, settings, today]);
  const { level, body, money: wallet, wealth, sleep, streak, look } = game;
  const isNew = game.xp.total === 0 && wallet.total === 0;

  const bodyHint = body.lost > 0
    ? `${body.idleDays} days without training. One session brings him back.`
    : body.nextAt !== null
      ? `${(body.nextAt - body.xp).toLocaleString("nl-NL")} XP to ${BODY_NAMES[body.earned + 1]}`
      : "Top shape. Keep it.";
  const moneyHint = wealth.nextAt !== null
    ? `${money(Math.max(0, wealth.nextAt - wallet.total))} to ${WEALTH_NAMES[wealth.tier + 1]}`
    : "Fully kitted out.";
  const sleepHint = sleep.avg === null ? "Log a night to set his mood." : `${n1(sleep.avg)}h a night this week`;

  return (
    <main>
      <header className="mb-4 flex items-center justify-between">
        <h1 className="font-pixel text-[32px] leading-none">
          Today<span className="text-ash">, {prettyDate(today)}</span>
        </h1>
        <div className="flex items-center gap-2">
          {streak > 0 && (
            <div className="flex h-10 items-center gap-1.5 rounded-full bg-coal px-3 font-pixel text-[21px] text-cash" title={`${streak}-day streak`}>
              <PixelIcon name="flame" size={14} />
              {streak}
              <span className="sr-only">day streak</span>
            </div>
          )}
          <Link href="/settings" aria-label="Settings" className="grid size-10 place-items-center rounded-full bg-coal text-ash hover:text-bone">
            <PixelIcon name="gear" size={16} />
          </Link>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[400px_1fr] lg:items-start lg:gap-6">
        {/* The character */}
        <section aria-label="Your character" className="mb-5 overflow-hidden rounded-[22px] bg-coal lg:sticky lg:top-4 lg:mb-0">
          <div className="stage-dots relative flex justify-center pt-2">
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3"
              style={{ background: "radial-gradient(60% 70% at 50% 100%, rgb(255 210 63 / 0.13), transparent 70%)" }}
            />
            <Character
              look={look}
              effect={event ? { kind: event.effect, at: event.at } : null}
              width={240}
              label={`${BODY_NAMES[look.stage]} and ${WEALTH_NAMES[look.tier].toLowerCase()}, ${ENERGY_NAMES[look.energy].toLowerCase()}`}
              className="relative"
            />
          </div>

          <div className="px-4 pb-4">
            <div className="mb-2 mt-1 flex items-end justify-between">
              <div className="font-pixel text-[27px] leading-none">
                Level {level.level} <span className="text-ash">{level.title}</span>
              </div>
              <div className="text-[13px] tabular-nums text-ash">
                {level.into.toLocaleString("nl-NL")} / {level.span.toLocaleString("nl-NL")} XP
              </div>
            </div>
            <Bar value={level.into / level.span} color="var(--color-cash)" height={10} />

            <dl className="mt-4 grid grid-cols-3 gap-2">
              <Stat term="Body" value={BODY_NAMES[look.stage]} hint={bodyHint} color="var(--color-gym)" warn={body.lost > 0} />
              <Stat term="Money" value={money(wallet.total)} hint={moneyHint} color="var(--color-cash)" />
              <Stat term="Energy" value={ENERGY_NAMES[look.energy]} hint={sleepHint} color="var(--color-sleep)" warn={look.energy === "tired"} />
            </dl>

            {isNew && (
              <p className="mt-4 rounded-xl bg-pit p-3 text-[14px] text-ash">
                This is you on day one. Log a workout and he starts filling out. Add your money under Finance and the cash shows up
                in his hands. Skip training for {DETRAIN_DAYS} days and he shrinks a stage.
              </p>
            )}
          </div>
        </section>

        {/* Trackers */}
        <section aria-label="Trackers" className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          {TRACKERS.map((t) => {
            const sum = summarize(t.id, { logs, settings }, today);
            return (
              <article key={t.id} className="relative rounded-[18px] bg-coal p-3" style={{ "--tc": t.color } as React.CSSProperties}>
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/track/${t.id}`} className="flex min-w-0 items-center gap-2 after:absolute after:inset-0 after:rounded-[18px]">
                    <span className="text-(--tc)">
                      <PixelIcon name={t.id} size={16} />
                    </span>
                    <h2 className="truncate font-pixel text-[23px] leading-none">{t.name}</h2>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setLogging(t.id)}
                    aria-label={t.verb}
                    className="relative z-10 grid size-10 shrink-0 place-items-center rounded-xl bg-(--tc) text-ink transition-transform active:scale-90"
                  >
                    <PixelIcon name="plus" size={14} />
                  </button>
                </div>
                <p className="mb-2.5 mt-1.5 truncate text-[13px] text-ash">{sum.line}</p>
                <Heatmap values={dayValues(t.id, logs, settings)} today={today} weeks={12} color={t.color} />
              </article>
            );
          })}
        </section>
      </div>

      <LogSheet tracker={logging} onClose={() => setLogging(null)} />
    </main>
  );
}

function Stat({ term, value, hint, color, warn }: { term: string; value: string; hint: string; color: string; warn?: boolean }) {
  return (
    <div className="rounded-xl bg-pit p-2.5">
      <dt className="text-[12px] text-ash">{term}</dt>
      <dd>
        <div className="font-pixel text-[22px] leading-tight" style={{ color }}>
          {value}
        </div>
        <div className={`mt-1 text-[11.5px] leading-snug ${warn ? "text-bad" : "text-ash"}`}>{hint}</div>
      </dd>
    </div>
  );
}
