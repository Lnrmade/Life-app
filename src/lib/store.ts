"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_SETTINGS, EMPTY_DATA } from "./types";
import type { GroceryItem, LifeData, Logs, Settings, TrackerId, Trip, WishItem } from "./types";

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export type CharacterEffect = "flex" | "cash" | "zzz" | "spark";

export interface GameEvent {
  effect: CharacterEffect;
  xp: number;
  label: string;
  at: number;
}

interface Actions {
  addLog: <K extends TrackerId>(kind: K, entry: Omit<Logs[K][number], "id">) => void;
  removeLog: (kind: TrackerId, id: string) => void;
  setSettings: (patch: Partial<Settings>) => void;

  addGroceries: (items: { name: string; qty?: string; needed: boolean }[]) => { added: number; updated: number };
  toggleGrocery: (id: string) => void;
  removeGrocery: (id: string) => void;
  setAllGroceries: (needed: boolean) => void;
  clearGroceries: () => void;

  addWish: (url: string) => string;
  updateWish: (id: string, patch: Partial<WishItem>) => void;
  removeWish: (id: string) => void;

  saveTrip: (trip: Omit<Trip, "id"> & { id?: string }) => void;
  removeTrip: (id: string) => void;

  replaceAll: (data: LifeData) => void;

  /** Not persisted: the last thing logged, so the character can react. */
  event: GameEvent | null;
  fire: (event: Omit<GameEvent, "at">) => void;
}

export type LifeStore = LifeData & Actions;

const norm = (s: string) => s.trim().toLowerCase();

export const useLife = create<LifeStore>()(
  persist(
    (set, get) => ({
      ...EMPTY_DATA,
      event: null,

      addLog: (kind, entry) =>
        set((s) => ({ logs: { ...s.logs, [kind]: [...s.logs[kind], { ...entry, id: uid() }] } })),
      removeLog: (kind, id) =>
        set((s) => ({ logs: { ...s.logs, [kind]: (s.logs[kind] as { id: string }[]).filter((l) => l.id !== id) } })),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      addGroceries: (incoming) => {
        const list = [...get().groceries];
        let added = 0, updated = 0;
        // Counting down keeps the pasted order: the first line ends up on top.
        let stamp = Date.now() + incoming.length;
        for (const item of incoming) {
          const name = item.name.trim();
          if (!name) continue;
          const at = list.findIndex((g) => norm(g.name) === norm(name));
          if (at >= 0) {
            const prev = list[at];
            const changed = prev.needed !== item.needed;
            list[at] = { ...prev, qty: item.qty ?? prev.qty, needed: item.needed, movedAt: changed ? stamp-- : prev.movedAt };
            updated++;
          } else {
            list.push({ id: uid(), name, qty: item.qty, needed: item.needed, movedAt: stamp-- });
            added++;
          }
        }
        set({ groceries: list });
        return { added, updated };
      },
      toggleGrocery: (id) =>
        set((s) => ({
          groceries: s.groceries.map((g): GroceryItem => (g.id === id ? { ...g, needed: !g.needed, movedAt: Date.now() } : g)),
        })),
      removeGrocery: (id) => set((s) => ({ groceries: s.groceries.filter((g) => g.id !== id) })),
      setAllGroceries: (needed) =>
        set((s) => ({ groceries: s.groceries.map((g) => (g.needed === needed ? g : { ...g, needed })) })),
      clearGroceries: () => set({ groceries: [] }),

      addWish: (url) => {
        const id = uid();
        let site = url;
        try { site = new URL(url).hostname.replace(/^www\./, ""); } catch { /* keep raw */ }
        const item: WishItem = { id, url, title: site, site, currency: "EUR", addedAt: Date.now(), status: "loading" };
        set((s) => ({ wishlist: [item, ...s.wishlist] }));
        return id;
      },
      updateWish: (id, patch) => set((s) => ({ wishlist: s.wishlist.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),
      removeWish: (id) => set((s) => ({ wishlist: s.wishlist.filter((w) => w.id !== id) })),

      saveTrip: (trip) =>
        set((s) =>
          trip.id
            ? { trips: s.trips.map((t) => (t.id === trip.id ? { ...t, ...trip, id: t.id } : t)) }
            : { trips: [...s.trips, { ...trip, id: uid() }] },
        ),
      removeTrip: (id) => set((s) => ({ trips: s.trips.filter((t) => t.id !== id) })),

      replaceAll: (data) =>
        set({
          logs: { ...EMPTY_DATA.logs, ...data.logs },
          groceries: data.groceries ?? [],
          wishlist: data.wishlist ?? [],
          trips: data.trips ?? [],
          settings: { ...DEFAULT_SETTINGS, ...data.settings },
        }),

      fire: (event) => set({ event: { ...event, at: Date.now() } }),
    }),
    {
      name: "life-app-v1",
      version: 1,
      skipHydration: true,
      partialize: (s): LifeData => ({
        logs: s.logs,
        groceries: s.groceries,
        wishlist: s.wishlist,
        trips: s.trips,
        settings: s.settings,
      }),
      merge: (saved, current) => {
        const data = (saved ?? {}) as Partial<LifeData>;
        return {
          ...current,
          ...data,
          logs: { ...current.logs, ...data.logs },
          settings: { ...DEFAULT_SETTINGS, ...data.settings },
        };
      },
    },
  ),
);

export const snapshot = (): LifeData => {
  const s = useLife.getState();
  return { logs: s.logs, groceries: s.groceries, wishlist: s.wishlist, trips: s.trips, settings: s.settings };
};
