import { DEFAULT_SETTINGS } from "./types";
import type { LifeData, TrackerId } from "./types";

/**
 * Pure rules for syncing with the database. Nothing here touches the network or the
 * browser, so it can be tested on its own.
 *
 * Every logged thing (a workout, a grocery item, a trip ...) is one row, keyed by
 * kind + id. The app remembers a fingerprint of each row as of the last sync (the
 * "shadow"). Anything whose fingerprint differs from its shadow is a pending local
 * change and gets uploaded; anything the server has that we have not changed
 * locally gets downloaded. On a clash, the device that has the pending change wins.
 */

export type Kind = TrackerId | "grocery" | "wish" | "trip" | "settings";
export const TRACKER_KINDS: TrackerId[] = ["gym", "sport", "sleep", "work", "finance", "savings"];

export interface Row {
  kind: Kind;
  id: string;
  data: unknown;
  deleted: boolean;
  updated_at?: string;
}

export interface Item {
  kind: Kind;
  id: string;
  value: unknown;
  hash: string;
}

export type Flat = Map<string, Item>;
/** key -> fingerprint as of the last successful sync */
export type Shadow = Record<string, string>;

export const keyOf = (kind: Kind, id: string) => `${kind}:${id}`;
export const splitKey = (key: string): [Kind, string] => {
  const at = key.indexOf(":");
  return [key.slice(0, at) as Kind, key.slice(at + 1)];
};

/** JSON with sorted keys and no undefined, so the same data always gives the same text. */
export function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map((x) => (x === undefined ? "null" : canon(x))).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canon(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

/** Small, fast 53-bit string hash (cyrb53). Not for security, only for noticing changes. */
export function hash(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export const settingsAreDefault = (s: LifeData["settings"]) => canon(s) === canon(DEFAULT_SETTINGS);

export function isEmptyData(d: LifeData): boolean {
  return (
    TRACKER_KINDS.every((k) => (d.logs[k] ?? []).length === 0) &&
    d.groceries.length === 0 &&
    d.wishlist.length === 0 &&
    d.trips.length === 0 &&
    settingsAreDefault(d.settings)
  );
}

/** Everything that should exist as a row. Settings only count once they differ from the defaults. */
export function flatten(d: LifeData): Flat {
  const out: Flat = new Map();
  const put = (kind: Kind, id: string, value: unknown) => out.set(keyOf(kind, id), { kind, id, value, hash: hash(canon(value)) });
  for (const k of TRACKER_KINDS) for (const l of d.logs[k] as unknown as { id: string }[]) put(k, l.id, l);
  for (const g of d.groceries) put("grocery", g.id, g);
  // A link still being looked up is not worth uploading yet.
  for (const w of d.wishlist) if (w.status !== "loading") put("wish", w.id, w);
  for (const t of d.trips) put("trip", t.id, t);
  if (!settingsAreDefault(d.settings)) put("settings", "main", d.settings);
  return out;
}

/** What has to be uploaded, and the fingerprints to record once it has been. */
export function diff(current: Flat, shadow: Shadow): { rows: Row[]; marks: Record<string, string | null> } {
  const rows: Row[] = [];
  const marks: Record<string, string | null> = {};
  for (const [key, item] of current) {
    if (shadow[key] === item.hash) continue;
    rows.push({ kind: item.kind, id: item.id, data: item.value, deleted: false });
    marks[key] = item.hash;
  }
  for (const key of Object.keys(shadow)) {
    if (current.has(key)) continue;
    const [kind, id] = splitKey(key);
    rows.push({ kind, id, data: null, deleted: true });
    marks[key] = null;
  }
  return { rows, marks };
}

export function hasPending(d: LifeData, shadow: Shadow): boolean {
  return diff(flatten(d), shadow).rows.length > 0;
}

/* ---------- applying what the server has ---------- */

type Listed = { id: string };

function listFor(d: LifeData, kind: Kind): Listed[] | null {
  switch (kind) {
    case "grocery": return d.groceries;
    case "wish": return d.wishlist;
    case "trip": return d.trips;
    case "settings": return null;
    default: return (d.logs[kind] as unknown as Listed[]) ?? null;
  }
}

const clone = (d: LifeData): LifeData => ({
  logs: Object.fromEntries(TRACKER_KINDS.map((k) => [k, [...(d.logs[k] ?? [])]])) as unknown as LifeData["logs"],
  groceries: [...d.groceries],
  wishlist: [...d.wishlist],
  trips: [...d.trips],
  settings: d.settings,
});

export function applyRemote(
  d: LifeData,
  incoming: Row[],
  shadow0: Shadow,
): { data: LifeData; shadow: Shadow; changed: boolean } {
  const shadow = { ...shadow0 };
  const current = flatten(d);
  const draft = clone(d);
  let changed = false;
  let wishTouched = false;

  // If the same row arrives twice in one batch, the later one wins.
  const latest = new Map<string, Row>();
  for (const r of incoming) latest.set(keyOf(r.kind, r.id), r);

  for (const [key, row] of latest) {
    const mine = current.get(key);
    // Already identical: just remember it as synced, whatever its history.
    if (mine && !row.deleted && row.kind !== "settings" && mine.hash === hash(canon(row.data))) {
      shadow[key] = mine.hash;
      continue;
    }
    // A change made here that has not been uploaded yet beats whatever the server has.
    const pending = mine ? mine.hash !== shadow[key] : key in shadow;
    if (pending) continue;

    if (row.deleted) {
      if (!mine) continue;
      const list = listFor(draft, row.kind);
      if (list) {
        const at = list.findIndex((x) => x.id === row.id);
        if (at >= 0) list.splice(at, 1);
      } else if (row.kind === "settings") {
        draft.settings = { ...DEFAULT_SETTINGS };
      }
      delete shadow[key];
      changed = true;
      wishTouched ||= row.kind === "wish";
      continue;
    }

    const h = hash(canon(row.data));
    if (row.kind === "settings") {
      // Settings added by a newer version of the app fall back to defaults here.
      draft.settings = { ...DEFAULT_SETTINGS, ...(row.data as object) };
      shadow[key] = hash(canon(draft.settings));
      changed = true;
      continue;
    } else {
      const list = listFor(draft, row.kind);
      if (!list) continue; // a kind this version does not know about
      const at = list.findIndex((x) => x.id === row.id);
      if (at >= 0) list[at] = row.data as Listed;
      else list.push(row.data as Listed);
    }
    shadow[key] = h;
    changed = true;
    wishTouched ||= row.kind === "wish";
  }

  if (wishTouched) draft.wishlist.sort((a, b) => b.addedAt - a.addedAt);
  return { data: changed ? draft : d, shadow, changed };
}

/** Adds what is missing from `incoming` to `base`. Used to adopt data that was on the device before accounts. */
export function mergeData(base: LifeData, incoming: LifeData): LifeData {
  const out = clone(base);
  const addMissing = (into: Listed[], from: Listed[], same?: (a: Listed, b: Listed) => boolean) => {
    const have = new Set(into.map((x) => x.id));
    for (const x of from) {
      if (have.has(x.id)) continue;
      if (same && into.some((y) => same(y, x))) continue;
      into.push(x);
    }
  };
  for (const k of TRACKER_KINDS) addMissing(out.logs[k] as unknown as Listed[], (incoming.logs[k] ?? []) as unknown as Listed[]);
  const byName = (a: Listed, b: Listed) =>
    (a as { name?: string }).name?.trim().toLowerCase() === (b as { name?: string }).name?.trim().toLowerCase();
  addMissing(out.groceries, incoming.groceries ?? [], byName);
  addMissing(out.wishlist, incoming.wishlist ?? [], (a, b) => (a as { url?: string }).url === (b as { url?: string }).url);
  addMissing(out.trips, incoming.trips ?? []);
  out.wishlist.sort((a, b) => b.addedAt - a.addedAt);
  if (settingsAreDefault(out.settings) && incoming.settings) out.settings = { ...DEFAULT_SETTINGS, ...incoming.settings };
  return out;
}
