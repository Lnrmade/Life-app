const pad = (n: number) => String(n).padStart(2, "0");

/** Local-time day key, YYYY-MM-DD. */
export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayKey = () => toKey(new Date());

export const fromKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (k: string, n: number) => {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
};

/** Monday of the week that contains k. */
export const weekStart = (k: string) => {
  const d = fromKey(k);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toKey(d);
};

export const daysBetween = (a: string, b: string) =>
  Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86_400_000);

export const monthOf = (k: string) => k.slice(0, 7);

export const prettyDate = (k: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  fromKey(k).toLocaleDateString("en-GB", opts);

export const relativeDay = (k: string, today = todayKey()) => {
  const diff = daysBetween(k, today);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return prettyDate(k, { weekday: "short", day: "numeric", month: "short" });
};
