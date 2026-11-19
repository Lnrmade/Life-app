"use client";

import { create } from "zustand";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyRemote, diff, flatten, hasPending, keyOf } from "./sync";
import type { Row, Shadow } from "./sync";
import { scopedKey, snapshot, useLife } from "./store";

/**
 * Keeps this device and the database in step. The app always works from the local copy,
 * so it is fast and works offline; this runs alongside, downloads what changed elsewhere
 * and uploads what changed here. The rules live in sync.ts.
 */

export interface SyncStatus {
  state: "idle" | "syncing" | "offline" | "error";
  lastAt: number | null;
  error: string | null;
}

export const useSyncStatus = create<SyncStatus>(() => ({ state: "idle", lastAt: null, error: null }));

interface Memory {
  /** Newest server timestamp we have seen. */
  cursor: string | null;
  shadow: Shadow;
}

const memoryKey = (userId: string) => `life-sync:${userId}`;

function loadMemory(userId: string): Memory {
  try {
    const raw = JSON.parse(localStorage.getItem(memoryKey(userId)) ?? "null") as Memory | null;
    if (raw && typeof raw === "object" && raw.shadow) return { cursor: raw.cursor ?? null, shadow: raw.shadow };
  } catch { /* start fresh */ }
  return { cursor: null, shadow: {} };
}

const PAGE = 1000;
const BATCH = 200;

const looksOffline = (message: string) => (typeof navigator !== "undefined" && navigator.onLine === false) || /fetch|network|load failed|timeout/i.test(message);

let active: { userId: string; syncNow: () => Promise<void>; stop: () => void; pending: () => boolean } | null = null;
let forceWipe = false;

export function startSync(sb: SupabaseClient, userId: string) {
  stopSync();
  let mem = loadMemory(userId);
  let running = false;
  let again = false;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const save = () => {
    try { localStorage.setItem(memoryKey(userId), JSON.stringify(mem)); } catch { /* storage full */ }
  };

  async function pull() {
    // Look back a little further than the newest row we know, so rows that were committed late are not missed.
    const since = mem.cursor ? new Date(Math.max(0, Date.parse(mem.cursor) - 2000)).toISOString() : null;
    const rows: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      let q = sb
        .from("entries")
        .select("kind,id,data,deleted,updated_at")
        .order("updated_at", { ascending: true })
        .order("kind")
        .order("id")
        .range(from, from + PAGE - 1);
      if (since) q = q.gt("updated_at", since);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      rows.push(...((data ?? []) as Row[]));
      if (!data || data.length < PAGE) break;
    }
    let cursor = mem.cursor;
    for (const r of rows) if (r.updated_at && (!cursor || r.updated_at > cursor)) cursor = r.updated_at;

    const result = applyRemote(snapshot(), rows, mem.shadow);
    mem = { cursor, shadow: result.shadow };
    if (result.changed) {
      const d = result.data;
      useLife.setState({ logs: d.logs, groceries: d.groceries, wishlist: d.wishlist, trips: d.trips, settings: d.settings });
    }
    save();
  }

  async function push() {
    const { rows, marks } = diff(flatten(snapshot()), mem.shadow);
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await sb.from("entries").upsert(
        batch.map((r) => ({ user_id: userId, kind: r.kind, id: r.id, data: r.data, deleted: r.deleted })),
        { onConflict: "user_id,kind,id" },
      );
      if (error) throw new Error(error.message);
      for (const r of batch) {
        const key = keyOf(r.kind, r.id);
        if (marks[key] === null) delete mem.shadow[key];
        else mem.shadow[key] = marks[key]!;
      }
      save();
    }
  }

  async function run() {
    if (stopped) return;
    if (running) {
      again = true;
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      useSyncStatus.setState({ state: "offline" });
      return;
    }
    running = true;
    useSyncStatus.setState({ state: "syncing", error: null });
    try {
      do {
        again = false;
        await pull();
        await push();
      } while (again && !stopped);
      if (!stopped) useSyncStatus.setState({ state: "idle", lastAt: Date.now(), error: null });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (!stopped) useSyncStatus.setState({ state: looksOffline(message) ? "offline" : "error", error: message });
    } finally {
      running = false;
    }
  }

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void run(), 1500);
  };

  const unsubscribe = useLife.subscribe((s, prev) => {
    if (s.logs !== prev.logs || s.groceries !== prev.groceries || s.wishlist !== prev.wishlist || s.trips !== prev.trips || s.settings !== prev.settings) schedule();
  });
  const onVisible = () => {
    if (document.visibilityState === "visible") void run();
    else if (hasPending(snapshot(), mem.shadow)) void run(); // push before the app is suspended
  };
  const onOnline = () => void run();
  const onOffline = () => useSyncStatus.setState({ state: "offline" });
  const interval = setInterval(() => document.visibilityState === "visible" && void run(), 60_000);
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  const handle = {
    userId,
    syncNow: run,
    pending: () => hasPending(snapshot(), mem.shadow),
    stop: () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(interval);
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    },
  };
  active = handle;
  useSyncStatus.setState({ state: "idle", lastAt: null, error: null });
  void run();
  return handle;
}

export function stopSync() {
  active?.stop();
  active = null;
}

export const syncNow = () => active?.syncNow() ?? Promise.resolve();
export const hasPendingChanges = () => active?.pending() ?? false;

/** Ask for the next sign-out to also erase this device's copy, even if it was not fully uploaded (account deleted). */
export const requestWipe = () => {
  forceWipe = true;
};

/** Removes this person's data from the device. Skipped when changes are still waiting to upload, unless forced. */
export function wipeLocal(userId: string, pending: boolean) {
  const force = forceWipe;
  forceWipe = false;
  if (pending && !force) return false;
  try {
    localStorage.removeItem(scopedKey(userId));
    localStorage.removeItem(memoryKey(userId));
    localStorage.removeItem("life-last-user");
  } catch { /* ignore */ }
  return true;
}
