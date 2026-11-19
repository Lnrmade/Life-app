import { describe, expect, it } from "vitest";
import { addDays, todayKey, weekStart } from "./dates";
import { parseAmount } from "./format";
import { bodyFrom, gameState, levelFrom, moneyFrom, streakFrom, wealthFrom, xpForLevel } from "./game";
import { parseGroceryText } from "./groceries";
import { extractPreview, isPrivateAddress, parsePrice } from "./preview";
import { DEFAULT_SETTINGS, EMPTY_DATA } from "./types";
import type { Logs } from "./types";

const logs = (patch: Partial<Logs> = {}): Logs => ({ ...EMPTY_DATA.logs, ...patch });

describe("dates", () => {
  it("finds the Monday of a week", () => {
    expect(weekStart("2026-11-16")).toBe("2026-11-16"); // a Monday
    expect(weekStart("2026-11-22")).toBe("2026-11-16"); // the Sunday after
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("parseAmount", () => {
  it("reads Dutch and English number styles", () => {
    expect(parseAmount("12,50")).toBe(12.5);
    expect(parseAmount("12.50")).toBe(12.5);
    expect(parseAmount("1.299,00")).toBe(1299);
    expect(parseAmount("1,299.00")).toBe(1299);
    expect(parseAmount("€ 2.350")).toBe(2350);
    expect(parseAmount("40")).toBe(40);
    expect(parseAmount("")).toBeNaN();
  });
});

describe("game", () => {
  const today = "2026-11-16";

  it("starts as a normal, broke person at level 0", () => {
    const g = gameState(EMPTY_DATA, today);
    expect(g.look).toMatchObject({ stage: 0, tier: 0, bills: 0, floor: 0, energy: "ok", aura: false });
    expect(g.level.level).toBe(0);
  });

  it("levels up on the documented curve", () => {
    expect(xpForLevel(1)).toBe(150);
    expect(levelFrom(149).level).toBe(0);
    expect(levelFrom(150).level).toBe(1);
    expect(levelFrom(450).level).toBe(2);
  });

  it("builds the body from training XP and shrinks it after two idle weeks", () => {
    const gym = Array.from({ length: 30 }, (_, i) => ({ id: String(i), date: addDays(today, -i), kind: "Push", minutes: 60 }));
    const xp = 30 * 70;
    expect(bodyFrom(logs({ gym }), xp, today)).toMatchObject({ stage: 2, lost: 0 });
    expect(bodyFrom(logs({ gym }), xp, addDays(today, 14))).toMatchObject({ stage: 1, lost: 1 });
    expect(bodyFrom(logs({ gym }), xp, addDays(today, 200)).stage).toBe(0);
  });

  it("tracks cash and savings separately", () => {
    const l = logs({
      finance: [
        { id: "a", date: today, type: "income", amount: 2000, category: "Salary" },
        { id: "b", date: today, type: "expense", amount: 500, category: "Rent" },
      ],
      savings: [{ id: "c", date: today, amount: 300 }],
    });
    const m = moneyFrom(l, { ...DEFAULT_SETTINGS, openingCash: 100, openingSavings: 50 }, today);
    expect(m).toMatchObject({ cash: 1300, saved: 350, total: 1650, monthIn: 2000, monthOut: 500 });
  });

  it("thickens the cash stack with money and unlocks outfits at set shares", () => {
    expect(wealthFrom(0, 10000)).toMatchObject({ tier: 0, bills: 0 });
    expect(wealthFrom(-50, 10000)).toMatchObject({ tier: 0, bills: 0 });
    expect(wealthFrom(250, 10000).tier).toBe(1);
    expect(wealthFrom(2500, 10000).tier).toBe(3);
    expect(wealthFrom(10000, 10000)).toMatchObject({ tier: 5, bills: 12 });
    const thickness = [100, 1000, 4000, 9000].map((n) => wealthFrom(n, 10000).bills);
    expect(thickness).toEqual([...thickness].sort((a, b) => a - b));
    expect(new Set(thickness).size).toBe(4);
  });

  it("counts a streak that is still open today", () => {
    const sleep = [1, 2, 3].map((d) => ({ id: String(d), date: addDays(today, -d), hours: 8 }));
    expect(streakFrom(logs({ sleep }), today)).toBe(3);
    expect(streakFrom(logs({ sleep }), addDays(today, 1))).toBe(0);
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("parseGroceryText", () => {
  it("reads a pasted note", () => {
    const items = parseGroceryText("- melk\n* 2x brood\n3. Kipfilet 1 kg\n500 g gehakt\neieren x12\n\nmelk", true);
    expect(items).toEqual([
      { name: "Melk", qty: undefined, needed: true },
      { name: "Brood", qty: "2", needed: true },
      { name: "Kipfilet", qty: "1 kg", needed: true },
      { name: "Gehakt", qty: "500 g", needed: true },
      { name: "Eieren", qty: "12", needed: true },
    ]);
  });

  it("lets checkboxes override the default", () => {
    const items = parseGroceryText("- [x] rijst\n- [ ] pasta\n☑ kaas", true);
    expect(items.map((i) => [i.name, i.needed])).toEqual([["Rijst", false], ["Pasta", true], ["Kaas", false]]);
  });

  it("splits a single comma separated line", () => {
    expect(parseGroceryText("melk, brood, kaas", false).map((i) => i.name)).toEqual(["Melk", "Brood", "Kaas"]);
  });
});

describe("link previews", () => {
  it("parses prices in both notations", () => {
    expect(parsePrice("1.299,00")).toBe(1299);
    expect(parsePrice("1,299.00")).toBe(1299);
    expect(parsePrice("49,95")).toBe(49.95);
    expect(parsePrice("1.299")).toBe(1299);
    expect(parsePrice(329)).toBe(329);
    expect(parsePrice("gratis")).toBeUndefined();
  });

  it("prefers JSON-LD product data", () => {
    const html = `<html><head><title>Shop</title>
      <meta property="og:title" content="Sony WH-1000XM5 &amp; case">
      <meta property="og:image" content="/img/xm5.jpg">
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Product","name":"Sony WH-1000XM5","image":["https://cdn.shop.nl/a.jpg"],"offers":{"@type":"Offer","price":"329.00","priceCurrency":"EUR"}}]}</script>
      </head></html>`;
    expect(extractPreview(html, "https://shop.nl/p/1")).toEqual({
      title: "Sony WH-1000XM5 & case",
      image: "https://shop.nl/img/xm5.jpg",
      price: 329,
      currency: "EUR",
      site: undefined,
    });
  });

  it("falls back to meta tags and the page title", () => {
    const html = `<title> Running  shoes | Store </title><meta content="139,95" property="product:price:amount"><meta property="product:price:currency" content="eur"><meta property="og:site_name" content="Store">`;
    expect(extractPreview(html, "https://store.com/x")).toMatchObject({ title: "Running shoes | Store", price: 139.95, currency: "EUR", site: "Store" });
  });

  it("refuses internal addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.1.10", "172.20.0.1", "169.254.169.254", "::1", "fd00::1", "::ffff:10.0.0.1"]) expect(isPrivateAddress(ip)).toBe(true);
    for (const ip of ["8.8.8.8", "151.101.1.69", "2a00:1450:400e:80c::200e"]) expect(isPrivateAddress(ip)).toBe(false);
  });
});

/* ---------- syncing ---------- */
import { applyRemote, canon, diff, flatten, hash, keyOf, mergeData } from "./sync";
import type { Row, Shadow } from "./sync";
import type { LifeData } from "./types";

const data = (patch: Partial<LifeData> = {}): LifeData => ({ ...EMPTY_DATA, logs: { ...EMPTY_DATA.logs }, ...patch });
const gym = (id: string, minutes = 60) => ({ id, date: "2026-11-16", kind: "Push", minutes });
const shadowOf = (d: LifeData): Shadow => Object.fromEntries([...flatten(d)].map(([k, v]) => [k, v.hash]));

describe("fingerprints", () => {
  it("do not depend on key order or undefined fields", () => {
    expect(canon({ b: 1, a: [1, { y: 2, x: undefined }] })).toBe(canon({ a: [1, { y: 2 }], b: 1 }));
    expect(hash(canon({ a: 1, b: 2 }))).toBe(hash(canon({ b: 2, a: 1 })));
    expect(hash(canon({ a: 1 }))).not.toBe(hash(canon({ a: 2 })));
  });
});

describe("diff", () => {
  it("uploads new and changed items and marks removed ones as deleted", () => {
    const first = data({ logs: { ...EMPTY_DATA.logs, gym: [gym("a"), gym("b")] } });
    const shadow = shadowOf(first);
    expect(diff(flatten(first), shadow).rows).toEqual([]);

    const next = data({ logs: { ...EMPTY_DATA.logs, gym: [gym("a", 90), gym("c")] } });
    const { rows } = diff(flatten(next), shadow);
    expect(rows.map((r) => `${r.id}:${r.deleted ? "del" : "up"}`).sort()).toEqual(["a:up", "b:del", "c:up"]);
    expect(rows.find((r) => r.id === "b")?.data).toBeNull();
  });

  it("leaves default settings and half-loaded wishlist links out", () => {
    const d = data({ wishlist: [{ id: "w", url: "https://x.nl", title: "x", site: "x.nl", currency: "EUR", addedAt: 1, status: "loading" }] });
    expect(flatten(d).size).toBe(0);
    const edited = data({ settings: { ...DEFAULT_SETTINGS, gymPerWeek: 5 } });
    expect([...flatten(edited).keys()]).toEqual(["settings:main"]);
  });

  it("uploads everything on a first sync and deletions when data is erased", () => {
    const d = data({ logs: { ...EMPTY_DATA.logs, gym: [gym("a")] }, groceries: [{ id: "g", name: "Melk", needed: true, movedAt: 1 }] });
    expect(diff(flatten(d), {}).rows).toHaveLength(2);
    expect(diff(flatten(EMPTY_DATA), shadowOf(d)).rows.every((r) => r.deleted)).toBe(true);
  });
});

describe("applyRemote", () => {
  const row = (kind: Row["kind"], id: string, value: unknown, deleted = false): Row => ({ kind, id, data: deleted ? null : value, deleted });

  it("adds what the server has and records it as synced", () => {
    const r = applyRemote(EMPTY_DATA, [row("gym", "a", gym("a"))], {});
    expect(r.changed).toBe(true);
    expect(r.data.logs.gym).toHaveLength(1);
    expect(diff(flatten(r.data), r.shadow).rows).toEqual([]); // nothing to upload straight after
  });

  it("does nothing when the server row equals what is here", () => {
    const d = data({ logs: { ...EMPTY_DATA.logs, gym: [gym("a")] } });
    const r = applyRemote(d, [row("gym", "a", { minutes: 60, kind: "Push", date: "2026-11-16", id: "a" })], {});
    expect(r.changed).toBe(false);
    expect(r.data).toBe(d);
    expect(r.shadow[keyOf("gym", "a")]).toBeTruthy();
  });

  it("keeps a local change that has not been uploaded yet", () => {
    const synced = data({ logs: { ...EMPTY_DATA.logs, gym: [gym("a", 60)] } });
    const shadow = shadowOf(synced);
    const edited = data({ logs: { ...EMPTY_DATA.logs, gym: [gym("a", 90)] } });
    const r = applyRemote(edited, [row("gym", "a", gym("a", 30))], shadow);
    expect(r.changed).toBe(false);
    expect(r.data.logs.gym[0].minutes).toBe(90);
  });

  it("keeps a local deletion that has not been uploaded yet", () => {
    const synced = data({ logs: { ...EMPTY_DATA.logs, gym: [gym("a")] } });
    const r = applyRemote(EMPTY_DATA, [row("gym", "a", gym("a", 99))], shadowOf(synced));
    expect(r.changed).toBe(false);
    expect(r.data.logs.gym).toHaveLength(0);
  });

  it("applies deletions made elsewhere", () => {
    const d = data({ logs: { ...EMPTY_DATA.logs, gym: [gym("a"), gym("b")] } });
    const r = applyRemote(d, [row("gym", "a", null, true)], shadowOf(d));
    expect(r.data.logs.gym.map((g) => g.id)).toEqual(["b"]);
    expect(keyOf("gym", "a") in r.shadow).toBe(false);
  });

  it("lets the server's settings win on a fresh device, then resets when they are deleted", () => {
    const r = applyRemote(EMPTY_DATA, [row("settings", "main", { gymPerWeek: 6, richTarget: 50000 })], {});
    expect(r.data.settings.gymPerWeek).toBe(6);
    expect(r.data.settings.sleepHours).toBe(DEFAULT_SETTINGS.sleepHours);
    const back = applyRemote(r.data, [row("settings", "main", null, true)], r.shadow);
    expect(back.data.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("takes the last version when a row appears twice and keeps the wishlist newest first", () => {
    const w = (id: string, addedAt: number, title: string) => ({ id, url: `https://x.nl/${id}`, title, site: "x.nl", currency: "EUR", addedAt, status: "ready" as const });
    const r = applyRemote(data({ wishlist: [w("old", 1, "Old")] }), [row("wish", "new", w("new", 5, "v1")), row("wish", "new", w("new", 5, "v2"))], {});
    expect(r.data.wishlist.map((x) => `${x.id}:${x.title}`)).toEqual(["new:v2", "old:Old"]);
  });
});

describe("mergeData", () => {
  it("adds what is missing without duplicating and keeps existing settings", () => {
    const base = data({
      logs: { ...EMPTY_DATA.logs, gym: [gym("a")] },
      groceries: [{ id: "1", name: "Melk", needed: true, movedAt: 1 }],
      settings: { ...DEFAULT_SETTINGS, gymPerWeek: 3 },
    });
    const old = data({
      logs: { ...EMPTY_DATA.logs, gym: [gym("a"), gym("b")] },
      groceries: [{ id: "2", name: " melk ", needed: false, movedAt: 2 }, { id: "3", name: "Brood", needed: true, movedAt: 3 }],
      settings: { ...DEFAULT_SETTINGS, gymPerWeek: 6 },
    });
    const merged = mergeData(base, old);
    expect(merged.logs.gym.map((g) => g.id)).toEqual(["a", "b"]);
    expect(merged.groceries.map((g) => g.name)).toEqual(["Melk", "Brood"]);
    expect(merged.settings.gymPerWeek).toBe(3);
    expect(mergeData(EMPTY_DATA, old).settings.gymPerWeek).toBe(6);
  });
});
