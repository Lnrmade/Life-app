"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AuthContext } from "./AuthContext";
import type { AuthUser } from "./AuthContext";
import { AuthScreen } from "./AuthScreen";
import { LegacyOffer } from "./LegacyOffer";
import { PixelIcon } from "./PixelIcon";
import type { IconName } from "./PixelIcon";
import { hasPendingChanges, startSync, stopSync, useSyncStatus, wipeLocal } from "@/lib/cloud";
import { activateScope, useLife } from "@/lib/store";
import { supabase } from "@/lib/supabase";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/groceries", label: "Groceries", icon: "cart" },
  { href: "/wishlist", label: "Wishlist", icon: "heart" },
  { href: "/trips", label: "Trips", icon: "pin" },
];

type Phase =
  | { kind: "loading" }
  | { kind: "out" }
  | { kind: "recovery" }
  | { kind: "ready"; user: AuthUser | null; offline: boolean };

const LAST_USER = "life-last-user";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const phaseRef = useRef<Phase>({ kind: "loading" });
  const loaded = useRef<string | null>(null); // whose data is on screen: a user id, or "local"
  const generation = useRef(0);
  const finishRecoveryRef = useRef<() => Promise<void>>(async () => {});

  const event = useLife((s) => s.event);
  const [dismissed, setDismissed] = useState(0);
  const toast = event && event.at !== dismissed ? event : null;
  const sync = useSyncStatus();

  useEffect(() => {
    let alive = true;
    const show = (p: Phase) => {
      phaseRef.current = p;
      setPhase(p);
    };

    // Brings someone's data onto the screen and starts keeping it in step with the server.
    const enter = async (user: AuthUser | null, offline = false) => {
      const id = user?.id ?? "local";
      if (loaded.current === id) {
        const now = phaseRef.current;
        if (now.kind !== "ready" || now.offline !== offline) show({ kind: "ready", user, offline });
        return;
      }
      const mine = ++generation.current;
      stopSync();
      loaded.current = id;
      await activateScope(id);
      if (!alive || mine !== generation.current) return;
      if (user && supabase) {
        try { localStorage.setItem(LAST_USER, JSON.stringify(user)); } catch { /* ignore */ }
        startSync(supabase, user.id);
      }
      show({ kind: "ready", user, offline });
    };

    // Clears the screen. This device's copy is removed too, unless it still holds changes that were never uploaded.
    const leave = async () => {
      const mine = ++generation.current;
      const who = loaded.current;
      const pending = hasPendingChanges();
      stopSync();
      loaded.current = null;
      await activateScope(null);
      if (who && who !== "local") wipeLocal(who, pending);
      if (!alive || mine !== generation.current) return;
      show({ kind: "out" });
    };

    if (!supabase) {
      void enter(null);
      return () => {
        alive = false;
      };
    }

    const sb = supabase;
    const asUser = (u: { id: string; email?: string }): AuthUser => ({ id: u.id, email: u.email ?? "" });

    // Opened with no connection and an expired login: carry on from the saved copy.
    const offlineFallback = () => {
      try {
        const cached = JSON.parse(localStorage.getItem(LAST_USER) ?? "null") as AuthUser | null;
        const hasLogin = Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k));
        if (cached?.id && hasLogin) return void enter(cached, true);
      } catch { /* fall through */ }
      show({ kind: "out" });
    };

    const { data } = sb.auth.onAuthStateChange((evt, session) => {
      // Supabase asks that its own functions are not called from inside this callback.
      setTimeout(() => {
        if (!alive) return;
        if (evt === "SIGNED_OUT") return void leave();
        if (evt === "PASSWORD_RECOVERY") return show({ kind: "recovery" });
        if (phaseRef.current.kind === "recovery") return;
        if (session?.user) return void enter(asUser(session.user));
        if (evt === "INITIAL_SESSION") offlineFallback();
      }, 0);
    });

    finishRecoveryRef.current = async () => {
      phaseRef.current = { kind: "loading" };
      const { data: got } = await sb.auth.getSession();
      if (got.session?.user) await enter(asUser(got.session.user));
      else show({ kind: "out" });
    };

    return () => {
      alive = false;
      data.subscription.unsubscribe();
      stopSync();
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!event) return;
    const timer = setTimeout(() => setDismissed(event.at), 2200);
    return () => clearTimeout(timer);
  }, [event]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" || pathname.startsWith("/track") : pathname.startsWith(href));

  if (phase.kind === "loading") return <div className="min-h-dvh" aria-busy="true" />;
  if (phase.kind === "out" || phase.kind === "recovery") {
    return <AuthScreen mode={phase.kind === "recovery" ? "recovery" : "login"} onRecovered={() => void finishRecoveryRef.current()} />;
  }

  const notice =
    phase.user && (sync.state === "offline" || phase.offline)
      ? "Offline. Your changes are saved on this device and upload when you are back online."
      : phase.user && sync.state === "error"
        ? "Could not sync right now. Your changes are safe on this device and it will try again."
        : "";

  return (
    <AuthContext.Provider value={{ user: phase.user, offline: phase.offline }}>
      <div className="mx-auto min-h-dvh w-full max-w-[1040px] px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[calc(14px+env(safe-area-inset-top))] sm:px-6">
        {notice && (
          <p role="status" className="mb-3 rounded-xl bg-coal px-3 py-2 text-[13px] text-ash">
            {notice}
          </p>
        )}
        {children}
      </div>

      {phase.user && <LegacyOffer userId={phase.user.id} />}

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.at}
            initial={{ y: -24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            className="pointer-events-none fixed inset-x-0 top-[calc(12px+env(safe-area-inset-top))] z-50 flex justify-center"
            role="status"
          >
            <div className="px-corners flex items-center gap-2 bg-cash px-4 py-2 font-pixel text-[21px] text-ink">
              {toast.xp > 0 && <span>+{toast.xp} XP</span>}
              <span className="opacity-70">{toast.label}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <ul className="mx-auto flex max-w-[520px] items-stretch justify-between px-2">
          {TABS.map((tab) => {
            const active = isActive(tab.href);
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-[64px] flex-col items-center justify-center gap-1.5 text-[12px] font-medium transition-colors ${active ? "text-cash" : "text-ash hover:text-bone"}`}
                >
                  <PixelIcon name={tab.icon} size={20} />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </AuthContext.Provider>
  );
}
