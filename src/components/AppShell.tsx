"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLife } from "@/lib/store";
import { PixelIcon } from "./PixelIcon";
import type { IconName } from "./PixelIcon";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/groceries", label: "Groceries", icon: "cart" },
  { href: "/wishlist", label: "Wishlist", icon: "heart" },
  { href: "/trips", label: "Trips", icon: "pin" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const event = useLife((s) => s.event);
  const [dismissed, setDismissed] = useState(0);
  const toast = event && event.at !== dismissed ? event : null;

  // Saved data lives in the browser, so nothing renders until it is loaded.
  useEffect(() => {
    void Promise.resolve(useLife.persist.rehydrate()).then(() => setReady(true));
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

  return (
    <>
      <div className="mx-auto min-h-dvh w-full max-w-[1040px] px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[calc(14px+env(safe-area-inset-top))] sm:px-6">
        {ready ? children : null}
      </div>

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

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
      >
        <ul className="mx-auto flex max-w-[520px] items-stretch justify-between px-2">
          {TABS.map((tab) => {
            const active = isActive(tab.href);
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-[64px] flex-col items-center justify-center gap-1.5 text-[12px] font-medium transition-colors ${
                    active ? "text-cash" : "text-ash hover:text-bone"
                  }`}
                >
                  <PixelIcon name={tab.icon} size={20} />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
