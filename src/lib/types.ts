export type TrackerId = "gym" | "sport" | "sleep" | "work" | "finance" | "savings";

export interface GymLog { id: string; date: string; kind: string; minutes: number; note?: string }
export interface SportLog { id: string; date: string; sport: string; minutes: number; km?: number }
export interface SleepLog { id: string; date: string; hours: number }
export interface WorkLog { id: string; date: string; hours: number; note?: string }
export interface MoneyTx { id: string; date: string; type: "income" | "expense"; amount: number; category: string; note?: string }
/** Positive = moved into savings, negative = taken out. */
export interface SavingsTx { id: string; date: string; amount: number; note?: string }

export interface Logs {
  gym: GymLog[];
  sport: SportLog[];
  sleep: SleepLog[];
  work: WorkLog[];
  finance: MoneyTx[];
  savings: SavingsTx[];
}

export interface GroceryItem {
  id: string;
  name: string;
  qty?: string;
  /** true = still to buy (sits on top). false = got it / in stock. */
  needed: boolean;
  /** When it last switched sides; newest first within each group. */
  movedAt: number;
}

export interface WishItem {
  id: string;
  url: string;
  title: string;
  site: string;
  image?: string;
  price?: number;
  currency: string;
  addedAt: number;
  status: "loading" | "ready" | "failed";
}

export interface Trip {
  id: string;
  country: string; // ISO numeric id from the map data
  from?: string;
  to?: string;
  note?: string;
  cities: string[];
}

export interface Settings {
  gymPerWeek: number;
  sportPerWeek: number;
  sleepHours: number;
  workHoursPerWeek: number;
  openingCash: number;
  openingSavings: number;
  savingsGoal: number;
  /** Total money at which the character is fully kitted out. */
  richTarget: number;
  /** Wishlist: count savings as money you could spend. */
  wishIncludesSavings: boolean;
  skin: number;
  hair: number;
}

export interface LifeData {
  logs: Logs;
  groceries: GroceryItem[];
  wishlist: WishItem[];
  trips: Trip[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  gymPerWeek: 4,
  sportPerWeek: 2,
  sleepHours: 8,
  workHoursPerWeek: 40,
  openingCash: 0,
  openingSavings: 0,
  savingsGoal: 5000,
  richTarget: 10000,
  wishIncludesSavings: true,
  skin: 1,
  hair: 0,
};

export const EMPTY_DATA: LifeData = {
  logs: { gym: [], sport: [], sleep: [], work: [], finance: [], savings: [] },
  groceries: [],
  wishlist: [],
  trips: [],
  settings: DEFAULT_SETTINGS,
};
