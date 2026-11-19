"use client";

import { useEffect, useState } from "react";
import { Sheet } from "./Sheet";
import { PrimaryButton } from "./ui";
import { STORE_NAME, useLife } from "@/lib/store";
import { isEmptyData, TRACKER_KINDS } from "@/lib/sync";
import { DEFAULT_SETTINGS, EMPTY_DATA } from "@/lib/types";
import type { LifeData } from "@/lib/types";

const countOf = (d: LifeData) =>
  TRACKER_KINDS.reduce((n, k) => n + (d.logs[k]?.length ?? 0), 0) + d.groceries.length + d.wishlist.length + d.trips.length;

/**
 * Before accounts existed, the app kept one copy of the data on the device. The first
 * time someone signs in here, ask whether that copy is theirs and should join their account.
 */
export function LegacyOffer({ userId }: { userId: string }) {
  const [offer, setOffer] = useState<LifeData | null>(null);
  const adopt = useLife((s) => s.adoptData);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (localStorage.getItem(`life-legacy-dismissed:${userId}`)) return;
      const raw = localStorage.getItem(STORE_NAME);
      if (!raw) return;
      const state = (JSON.parse(raw) as { state?: Partial<LifeData> }).state;
      if (!state?.logs) return;
      const data: LifeData = {
        ...EMPTY_DATA,
        ...state,
        logs: { ...EMPTY_DATA.logs, ...state.logs },
        settings: { ...DEFAULT_SETTINGS, ...state.settings },
      } as LifeData;
      if (!isEmptyData(data)) timer = setTimeout(() => setOffer(data), 600);
    } catch { /* unreadable or blocked: nothing to offer */ }
    return () => clearTimeout(timer);
  }, [userId]);

  const remember = () => {
    try { localStorage.setItem(`life-legacy-dismissed:${userId}`, "1"); } catch { /* ignore */ }
  };

  const add = () => {
    if (!offer) return;
    adopt(offer);
    try { localStorage.removeItem(STORE_NAME); } catch { /* ignore */ }
    remember();
    setOffer(null);
  };

  return (
    <Sheet open={!!offer} onClose={() => setOffer(null)} title="Data found on this device">
      {offer && (
        <div className="space-y-4">
          <p className="text-ash">
            This device has {countOf(offer)} items from before accounts. If they are yours, add them to your account so they sync
            and are not lost.
          </p>
          <PrimaryButton onClick={add}>Add to my account</PrimaryButton>
          <button
            type="button"
            onClick={() => {
              remember();
              setOffer(null);
            }}
            className="h-12 w-full rounded-xl bg-pit font-medium hover:bg-line"
          >
            Not mine, leave it
          </button>
        </div>
      )}
    </Sheet>
  );
}
