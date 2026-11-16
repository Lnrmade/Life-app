const eur0 = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" });
const num = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 });

/** Euros. Drops the cents when there are none. */
export const money = (n: number, forceCents = false) =>
  (forceCents || Math.round(n * 100) % 100 !== 0 ? eur2 : eur0).format(n).replace(/ /g, " ");

export const moneyIn = (n: number, currency: string) => {
  if (!currency || currency === "EUR") return money(n);
  try {
    return new Intl.NumberFormat("nl-NL", { style: "currency", currency }).format(n).replace(/ /g, " ");
  } catch {
    return `${n} ${currency}`;
  }
};

export const n1 = (n: number) => num.format(n);

/** Parses what people type into a money field: "1.299,50", "12,5", "12.50", "€ 40". */
export const parseAmount = (raw: string): number => {
  let s = raw.replace(/[^\d.,-]/g, "");
  if (!s) return NaN;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // The later one is the decimal mark.
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma > -1) {
    const decimals = s.length - lastComma - 1;
    s = decimals === 3 && s.indexOf(",") === lastComma && s.length > 4 ? s.replace(",", "") : s.replace(/,/g, ".");
    if ((s.match(/\./g) ?? []).length > 1) s = s.replace(/\.(?=.*\.)/g, "");
  } else if (lastDot > -1) {
    const decimals = s.length - lastDot - 1;
    if ((s.match(/\./g) ?? []).length > 1 || (decimals === 3 && s.length > 4)) s = s.replace(/\./g, "");
  }
  return Number(s);
};

export const hoursLabel = (h: number) => {
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  return mins ? `${whole}h ${String(mins).padStart(2, "0")}` : `${whole}h`;
};
