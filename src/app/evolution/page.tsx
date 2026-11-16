"use client";

import Link from "next/link";
import { Character } from "@/components/Character";
import { PixelIcon } from "@/components/PixelIcon";
import { BODY_NAMES, BODY_THRESHOLDS, WEALTH_NAMES, WEALTH_STEPS } from "@/lib/game";
import { money } from "@/lib/format";
import { useLife } from "@/lib/store";

const BILLS = [0, 2, 4, 7, 9, 12];
const FLOOR = [0, 0, 0, 0, 1, 4];

export default function EvolutionPage() {
  const settings = useLife((s) => s.settings);
  return (
    <main>
      <header className="mb-5 flex items-center gap-3">
        <Link href="/settings" aria-label="Back to settings" className="grid size-10 place-items-center rounded-full bg-coal text-ash hover:text-bone">
          <PixelIcon name="back" size={14} />
        </Link>
        <h1 className="font-pixel text-[34px] leading-none">Evolution</h1>
      </header>
      <p className="mb-6 max-w-[60ch] text-ash">
        Training moves him across. Money moves him down. Every combination exists, so he can be jacked and broke, or rich and
        out of shape.
      </p>
      <div className="overflow-x-auto no-scrollbar">
        <table className="border-separate border-spacing-1.5">
          <thead>
            <tr>
              <th />
              {BODY_NAMES.map((name, i) => (
                <th key={name} className="pb-1 text-left align-bottom font-normal">
                  <div className="font-pixel text-[20px] text-gym">{name}</div>
                  <div className="text-[12px] text-ash">{BODY_THRESHOLDS[i].toLocaleString("nl-NL")} XP</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEALTH_NAMES.map((name, tier) => (
              <tr key={name}>
                <th className="pr-2 text-left align-middle font-normal">
                  <div className="font-pixel text-[20px] text-cash">{name}</div>
                  <div className="whitespace-nowrap text-[12px] text-ash">{money(WEALTH_STEPS[tier] * settings.richTarget)}</div>
                </th>
                {BODY_NAMES.map((_, stage) => (
                  <td key={stage} className="stage-dots rounded-xl bg-coal p-1">
                    <Character
                      still
                      width={112}
                      label={`${BODY_NAMES[stage]}, ${name}`}
                      look={{ stage, tier, bills: BILLS[tier], floor: FLOOR[tier], energy: "ok", aura: false, skin: settings.skin, hair: settings.hair }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
