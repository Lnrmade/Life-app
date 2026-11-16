export interface ParsedGrocery {
  name: string;
  qty?: string;
  needed: boolean;
}

const UNITS = "g|gr|gram|kg|kilo|ml|cl|l|liter|st|stuks?|pak|pakken|pakjes?|blik|blikken|zak|zakken|fles|flessen|pcs|x";

/**
 * Reads a pasted list: one item per line (or comma separated on a single line).
 * Understands bullets, numbering, "[x]" style checkboxes and simple quantities
 * like "2x melk", "melk x2", "500 g gehakt".
 */
export function parseGroceryText(text: string, defaultNeeded: boolean): ParsedGrocery[] {
  let lines = text.split(/\r?\n/);
  if (lines.filter((l) => l.trim()).length === 1 && /[,;]/.test(text)) lines = text.split(/[,;]/);

  const out: ParsedGrocery[] = [];
  const seen = new Set<string>();

  for (const raw of lines) {
    let line = raw.trim();
    if (!line) continue;
    let needed = defaultNeeded;

    // Checkboxes decide for themselves: ticked means you already have it.
    const box = line.match(/^(?:[-*+]\s*)?(\[[ xX✓✔]?\]|[☐☑✅✓✔])\s*/);
    if (box) {
      needed = !/[xX✓✔☑✅]/.test(box[1]);
      line = line.slice(box[0].length);
    }
    line = line.replace(/^(?:[-*+•◦▪‣–—]|\d+[.)])\s+/, "").trim();
    if (!line) continue;

    let qty: string | undefined;
    let m: RegExpMatchArray | null;
    if ((m = line.match(new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(${UNITS})\\b\\.?\\s+(.+)$`, "i")))) {
      qty = m[2].toLowerCase() === "x" ? m[1] : `${m[1]} ${m[2]}`;
      line = m[3];
    } else if ((m = line.match(new RegExp(`^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*(${UNITS.replace("|x", "")})\\.?$`, "i")))) {
      qty = `${m[2]} ${m[3]}`;
      line = m[1];
    } else if ((m = line.match(/^(\d+)\s*[x×]\s*(.+)$/i))) {
      qty = m[1];
      line = m[2];
    } else if ((m = line.match(/^(.+?)\s*[x×]\s*(\d+)$/i)) || (m = line.match(/^(.+?)\s*\((\d+)\)$/))) {
      qty = m[2];
      line = m[1];
    } else if ((m = line.match(/^(\d+)\s+(\D.+)$/))) {
      qty = m[1];
      line = m[2];
    }

    const name = line.trim().replace(/\s+/g, " ");
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: name[0].toUpperCase() + name.slice(1), qty, needed });
  }
  return out;
}
