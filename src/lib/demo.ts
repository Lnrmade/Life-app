import { addDays, fromKey, todayKey } from "./dates";
import { DEFAULT_SETTINGS } from "./types";
import type { LifeData } from "./types";

/** Six months of made-up history, so you can see where the app goes before your own data is in. */
export function demoData(): LifeData {
  let seed = 7;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
  let n = 0;
  const id = () => `demo-${n++}`;

  const today = todayKey();
  const data: LifeData = {
    logs: { gym: [], sport: [], sleep: [], work: [], finance: [], savings: [] },
    groceries: [],
    wishlist: [],
    trips: [],
    settings: { ...DEFAULT_SETTINGS, openingCash: 650, openingSavings: 400, savingsGoal: 8000, richTarget: 25000 },
  };

  const DAYS = 180;
  for (let back = DAYS; back >= 0; back--) {
    const date = addDays(today, -back);
    const dow = (fromKey(date).getDay() + 6) % 7; // 0 = Monday
    const drive = 0.55 + 0.4 * (1 - back / DAYS); // more consistent as time goes on

    if ([0, 1, 3, 4].includes(dow) && rnd() < drive) {
      data.logs.gym.push({ id: id(), date, kind: ["Push", "Pull", "", "Legs", "Upper"][dow] || "Full body", minutes: pick([45, 60, 60, 75, 90]) });
    }
    if ((dow === 2 || dow === 5) && rnd() < drive) {
      const sport = dow === 5 ? "Football" : pick(["Running", "Padel"]);
      data.logs.sport.push({ id: id(), date, sport, minutes: sport === "Running" ? 40 : 90, km: sport === "Running" ? 5 + Math.round(rnd() * 40) / 10 : undefined });
    }
    if (rnd() < 0.93) {
      data.logs.sleep.push({ id: id(), date, hours: Math.round((6.4 + rnd() * 2.2 - (dow >= 5 ? -0.5 : 0)) * 4) / 4 });
    }
    if (dow < 5 && rnd() < 0.92) data.logs.work.push({ id: id(), date, hours: pick([6, 7, 7.5, 8, 8, 9]) });
    else if (dow === 5 && rnd() < 0.35) data.logs.work.push({ id: id(), date, hours: pick([2, 3, 4]), note: "Client site" });

    const dom = fromKey(date).getDate();
    if (dom === 25) data.logs.finance.push({ id: id(), date, type: "income", amount: 2350, category: "Salary" });
    if (dom === 1) data.logs.finance.push({ id: id(), date, type: "expense", amount: 780, category: "Rent" });
    if (dom === 3) data.logs.finance.push({ id: id(), date, type: "expense", amount: 64, category: "Subscriptions", note: "Gym, phone, streaming" });
    if (dom === 12 && rnd() < 0.7) data.logs.finance.push({ id: id(), date, type: "income", amount: pick([350, 500, 750]), category: "Client", note: "Website build" });
    if (dow === 5) data.logs.finance.push({ id: id(), date, type: "expense", amount: 55 + Math.round(rnd() * 40), category: "Groceries" });
    if (rnd() < 0.2) data.logs.finance.push({ id: id(), date, type: "expense", amount: 12 + Math.round(rnd() * 45), category: pick(["Eating out", "Fun", "Transport", "Clothes"]) });
    if (dom === 26) data.logs.savings.push({ id: id(), date, amount: pick([300, 400, 500]) });
  }

  let stamp = Date.now() - 100000;
  const grocery = (name: string, needed: boolean, qty?: string) =>
    data.groceries.push({ id: id(), name, qty, needed, movedAt: stamp++ });
  ["Rijst", "Pasta", "Olijfolie", "Tomatenblokjes", "Pindakaas", "Havermout", "Koffiebonen", "Wasmiddel", "Tandpasta", "Diepvries spinazie", "Tonijn", "Zwarte bonen", "Wraps", "Griekse yoghurt"].forEach((nm) => grocery(nm, false));
  grocery("Eieren", true, "12");
  grocery("Kipfilet", true, "1 kg");
  grocery("Bananen", true);
  grocery("Kwark", true, "3");
  grocery("Volkoren brood", true);
  grocery("Avocado", true, "2");

  data.wishlist = [
    { id: id(), url: "https://example.com/headphones", title: "Wireless noise cancelling headphones", site: "example.com", price: 329, currency: "EUR", addedAt: stamp++, status: "ready" },
    { id: id(), url: "https://example.com/monitor", title: "27 inch 4K monitor", site: "example.com", price: 449.99, currency: "EUR", addedAt: stamp++, status: "ready" },
    { id: id(), url: "https://example.com/bike", title: "Gravel bike", site: "example.com", price: 12499, currency: "EUR", addedAt: stamp++, status: "ready" },
    { id: id(), url: "https://example.com/shoes", title: "Running shoes", site: "example.com", price: 139.95, currency: "EUR", addedAt: stamp++, status: "ready" },
  ];

  data.trips = [
    { id: id(), country: "528", cities: ["Tilburg", "Amsterdam"], note: "Home" },
    { id: id(), country: "056", from: addDays(today, -400), to: addDays(today, -398), cities: ["Antwerp"] },
    { id: id(), country: "276", from: addDays(today, -200), to: addDays(today, -194), cities: ["Berlin", "Cologne"], note: "Visited family" },
    { id: id(), country: "250", from: addDays(today, -320), to: addDays(today, -310), cities: ["Paris", "Lyon"] },
    { id: id(), country: "724", from: addDays(today, -120), to: addDays(today, -112), cities: ["Barcelona"] },
    { id: id(), country: "380", from: addDays(today, -520), to: addDays(today, -512), cities: ["Rome", "Milan"] },
    { id: id(), country: "826", from: addDays(today, -60), to: addDays(today, -57), cities: ["London"] },
    { id: id(), country: "504", from: addDays(today, -700), to: addDays(today, -690), cities: ["Marrakesh"] },
    { id: id(), country: "392", from: addDays(today, -900), to: addDays(today, -884), cities: ["Tokyo", "Kyoto"] },
  ];

  return data;
}
