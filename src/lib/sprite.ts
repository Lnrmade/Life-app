import type { Look } from "./game";

/**
 * The character is drawn procedurally, one small rectangle at a time, on a
 * 64x80 canvas that the browser scales up without smoothing. Nothing here is
 * an image file: body width, outfit and the cash in his hands are all computed
 * from the Look, so every combination of stage and tier exists.
 */

export const SPRITE_W = 64;
export const SPRITE_H = 80;

const CX = 32;
const OY = 12; // y of the top of the hair
const GROUND = OY + 62;

export type EffectKind = "flex" | "cash" | "zzz" | "spark";

export interface Frame {
  /** ms since the sprite mounted */
  t: number;
  effect?: { kind: EffectKind; age: number } | null;
  /** Freeze idle motion (reduced motion, static previews). */
  still?: boolean;
}

const SKIN = [
  { base: "#f2c9a4", shade: "#d7a47b", line: "#a8694a" },
  { base: "#e0a676", shade: "#c08357", line: "#8a4f37" },
  { base: "#c0875a", shade: "#9c683f", line: "#6c3f27" },
  { base: "#8a583a", shade: "#6b4129", line: "#3f2416" },
];

const HAIR = [
  { base: "#1c1b20", light: "#35333c" },
  { base: "#4b2e1c", light: "#6b4429" },
  { base: "#b78338", light: "#d9a85a" },
  { base: "#8a8a90", light: "#b5b5ba" },
];

interface Outfit {
  top: string;
  topShade: string;
  topLight: string;
  sleeves: "short" | "long";
  cuff?: string;
  pants: string;
  pantsShade: string;
  belt?: string;
  shoe: string;
  shoeSole: string;
  shoeAccent?: string;
  cap?: { crown: string; panel: string; brim: string; mark?: string };
  chain?: string;
  watch?: boolean;
  shades?: boolean;
  style: "tee" | "varsity" | "puffer" | "suit";
}

const GOLD = "#f4c542";
const GOLD_DARK = "#b8892a";

const OUTFITS: Outfit[] = [
  // 0 Broke: faded tee, washed jeans, tired trainers.
  {
    style: "tee", top: "#8e8e94", topShade: "#727278", topLight: "#a1a1a7", sleeves: "short",
    pants: "#5d6f8e", pantsShade: "#4a5a76", shoe: "#77736c", shoeSole: "#57534d",
  },
  // 1 Getting by: clean tee, cap, dark denim.
  {
    style: "tee", top: "#ece3cc", topShade: "#cfc4a8", topLight: "#f8f2e2", sleeves: "short",
    pants: "#27324d", pantsShade: "#1b2439", belt: "#16161a", shoe: "#e9e6de", shoeSole: "#b9b5ab",
    cap: { crown: "#1f2a44", panel: "#ece3cc", brim: "#141c30" },
  },
  // 2 Comfortable: adds a silver chain and fresh white trainers.
  {
    style: "tee", top: "#f4f1e8", topShade: "#d4d0c4", topLight: "#ffffff", sleeves: "short",
    pants: "#1a1d2b", pantsShade: "#11131d", belt: "#0e0e12", shoe: "#ffffff", shoeSole: "#c9c9c9", shoeAccent: "#5cc8ff",
    cap: { crown: "#1f2a44", panel: "#f4f1e8", brim: "#141c30", mark: "#5cc8ff" }, chain: "#cfd6dc",
  },
  // 3 Doing well: varsity jacket, gold chain, watch, boots.
  {
    style: "varsity", top: "#8a1f30", topShade: "#671524", topLight: "#a52c40", sleeves: "long", cuff: "#eadfc6",
    pants: "#9a9aa0", pantsShade: "#7d7d84", belt: "#16161a", shoe: "#b98a52", shoeSole: "#7d5a33",
    cap: { crown: "#17171b", panel: "#17171b", brim: "#0c0c0f", mark: "#eadfc6" }, chain: GOLD, watch: true,
  },
  // 4 Loaded: black puffer, heavy gold, shades.
  {
    style: "puffer", top: "#30303b", topShade: "#1e1e27", topLight: "#50505f", sleeves: "long", cuff: "#1e1e27",
    pants: "#26262e", pantsShade: "#18181e", belt: GOLD_DARK, shoe: "#f3f3f3", shoeSole: "#c43a3a", shoeAccent: "#c43a3a",
    cap: { crown: "#26262e", panel: "#26262e", brim: "#15151a", mark: GOLD }, chain: GOLD, watch: true, shades: true,
  },
  // 5 Rich: midnight suit, gold tie, polished shoes.
  {
    style: "suit", top: "#2c3360", topShade: "#1d2244", topLight: "#434c85", sleeves: "long", cuff: "#f5f2ea",
    pants: "#2c3360", pantsShade: "#1d2244", belt: "#0c0c10", shoe: "#2a2a30", shoeSole: "#0c0c0f", shoeAccent: "#7a7a88",
    watch: true, shades: true,
  },
];

/* Body proportions per stage. */
const SHOULDER = [8, 8, 9, 10, 12, 13]; // half-width of the chest
const WAIST = [7, 7, 7, 8, 8, 9];
const ARM = [3, 3, 4, 5, 6, 7];
const NECK = [4, 4, 4, 6, 6, 8];
const LEG = [6, 6, 6, 7, 7, 8];
const SLEEVE = [7, 7, 6, 6, 5, 5];

const CASH = { a: "#5da85b", b: "#458f4b", top: "#8fd183", edge: "#2f6b39", band: "#f0e8c8", bandShade: "#cfc59c" };

/** Cheap deterministic noise so particles don't need state. */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export function drawCharacter(ctx: CanvasRenderingContext2D, look: Look, frame: Frame) {
  const { t, still } = frame;
  const effect = frame.effect ?? null;
  const stage = Math.max(0, Math.min(5, look.stage));
  const tier = Math.max(0, Math.min(5, look.tier));
  const skin = SKIN[look.skin] ?? SKIN[1];
  const hair = HAIR[look.hair] ?? HAIR[0];
  const fit = OUTFITS[tier];

  const sh = SHOULDER[stage], wa = WAIST[stage], aw = ARM[stage], lw = LEG[stage];

  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };
  const dot = (x: number, y: number, color: string) => rect(x, y, 1, 1, color);
  /** Draws the same thing on both sides of the centre line. */
  const mirror = (x: number, y: number, w: number, h: number, color: string) => {
    rect(x, y, w, h, color);
    rect(2 * CX - x - w, y, w, h, color);
  };

  ctx.clearRect(0, 0, SPRITE_W, SPRITE_H);

  const flexing = effect?.kind === "flex" && effect.age < 1500;
  const pump = flexing ? Math.floor(effect!.age / 190) % 2 : 0;
  // Breathing: the upper body sinks one pixel on the exhale.
  const bob = still || flexing ? 0 : Math.floor(t / 620) % 2;
  const slump = look.energy === "tired" ? 1 : 0;
  const by = OY + bob + slump;
  const blink = !still && t % 3600 < 140;
  const holding = look.bills > 0 && !flexing;

  /* ---- behind him: streak aura ---- */
  if (look.aura && !still) {
    for (let i = 0; i < 16; i++) {
      const life = (t / 900 + hash(i)) % 1;
      const col = CX - sh - aw - 4 + Math.floor(hash(i + 40) * (2 * (sh + aw) + 8));
      const y = GROUND - 2 - life * (34 + hash(i + 9) * 20);
      const color = life < 0.35 ? "#ffd23f" : life < 0.7 ? "#ff9a3c" : "#ff5d3c";
      rect(col, y, life < 0.5 ? 2 : 1, life < 0.5 ? 2 : 1, color);
    }
  }

  /* ---- shadow ---- */
  ctx.globalAlpha = 0.45;
  rect(CX - 15, GROUND - 1, 30, 3, "#000000");
  rect(CX - 18, GROUND, 36, 1, "#000000");
  ctx.globalAlpha = 1;

  /* ---- cash bricks at his feet ---- */
  for (let i = 0; i < look.floor; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const level = Math.floor(i / 2);
    const x = side === 1 ? CX + lw + 5 : CX - lw - 5 - 10;
    const y = GROUND - 4 * (level + 1) + 1;
    rect(x, y, 10, 4, CASH.b);
    rect(x, y, 10, 1, CASH.top);
    rect(x, y + 3, 10, 1, CASH.edge);
    rect(x + 4, y, 2, 4, CASH.band);
  }

  /* ---- legs ---- */
  const legTop = OY + 37;
  // Hips, then two legs with a 2px gap. Baggy: they widen slightly at the hem.
  rect(CX - wa, legTop, 2 * wa, 4, fit.pants);
  mirror(CX - 1 - lw, legTop + 4, lw, 17, fit.pants);
  mirror(CX - 2 - lw, legTop + 15, 1, 6, fit.pants);
  // Shade on the inner seam and the right outer edge.
  rect(CX - 2, legTop + 4, 1, 17, fit.pantsShade);
  rect(CX + lw, legTop + 4, 1, 17, fit.pantsShade);
  rect(CX + wa - 1, legTop, 1, 4, fit.pantsShade);
  if (fit.belt) {
    rect(CX - wa, legTop, 2 * wa, 1, fit.belt);
    rect(CX - 1, legTop, 2, 1, tier >= 4 ? GOLD : "#b9b9c0");
  }
  if (fit.style === "suit") {
    // Trouser crease.
    mirror(CX - 1 - Math.ceil(lw / 2), legTop + 5, 1, 15, fit.topLight);
  }

  /* ---- shoes ---- */
  const shoeY = OY + 58;
  mirror(CX - 2 - lw, shoeY, lw + 2, 4, fit.shoe);
  mirror(CX - 3 - lw, shoeY + 1, 1, 3, fit.shoe);
  mirror(CX - 3 - lw, shoeY + 3, lw + 3, 1, fit.shoeSole);
  if (fit.shoeAccent) mirror(CX - 1 - lw, shoeY + 1, 2, 1, fit.shoeAccent);

  /* ---- torso ---- */
  const torsoTop = by + 16;
  const torsoRows = 21 - bob - slump; // bottom edge stays planted on the hips
  const halfAt = (r: number) => {
    if (r === 0) return sh - 1;
    if (r <= 7) return sh;
    if (r >= 14) return wa;
    return Math.round(sh + ((wa - sh) * (r - 7)) / 7);
  };
  for (let r = 0; r < torsoRows; r++) {
    const half = halfAt(r);
    rect(CX - half, torsoTop + r, 2 * half, 1, fit.top);
    rect(CX + half - 2, torsoTop + r, 2, 1, fit.topShade);
  }

  if (fit.style === "tee") {
    // Collar.
    rect(CX - 3, torsoTop, 6, 1, fit.topShade);
    if (tier >= 1) {
      // Small chest print.
      rect(CX - 3, torsoTop + 6, 6, 1, tier === 1 ? "#3a3a44" : "#5cc8ff");
      rect(CX - 2, torsoTop + 8, 4, 1, tier === 1 ? "#3a3a44" : "#1f2a44");
    }
    if (stage >= 3) {
      // Chest definition showing through the shirt.
      mirror(CX - sh + 2, torsoTop + 9, sh - 3, 1, fit.topShade);
      if (stage >= 4) rect(CX - 1, torsoTop + 3, 1, 6, fit.topShade);
    }
    if (stage === 5) {
      mirror(CX - 3, torsoTop + 12, 2, 1, fit.topShade);
      mirror(CX - 3, torsoTop + 15, 2, 1, fit.topShade);
    }
  } else if (fit.style === "varsity") {
    rect(CX - 2, torsoTop, 4, torsoRows - 3, "#f4f1e8"); // tee underneath
    rect(CX - 3, torsoTop, 1, torsoRows - 3, fit.topShade);
    rect(CX + 2, torsoTop, 1, torsoRows - 3, fit.topShade);
    rect(CX - wa, torsoTop + torsoRows - 3, 2 * wa, 3, fit.cuff!); // ribbed hem
    rect(CX - wa, torsoTop + torsoRows - 2, 2 * wa, 1, fit.topShade);
    rect(CX + 4, torsoTop + 5, 3, 3, fit.cuff!); // chest patch
    dot(CX + 5, torsoTop + 6, fit.top);
  } else if (fit.style === "puffer") {
    for (const r of [5, 10, 15]) {
      if (r < torsoRows) rect(CX - halfAt(r), torsoTop + r, 2 * halfAt(r), 1, fit.topShade);
      if (r + 1 < torsoRows) rect(CX - halfAt(r + 1) + 1, torsoTop + r + 1, 2 * halfAt(r + 1) - 4, 1, fit.topLight);
    }
    rect(CX - 1, torsoTop, 1, torsoRows, "#121218"); // zip
    rect(CX - 4, torsoTop, 8, 2, fit.topLight); // collar
  } else {
    // Suit: shirt V, lapels, tie, buttons, pocket square.
    for (let r = 0; r < 9; r++) {
      const half = Math.max(0, 4 - Math.floor(r / 2));
      rect(CX - half, torsoTop + r, 2 * half, 1, "#f5f2ea");
      if (half > 0) mirror(CX - half - 1, torsoTop + r, 1, 1, fit.topLight);
    }
    rect(CX - 1, torsoTop + 1, 2, 8, GOLD);
    rect(CX - 1, torsoTop + 1, 2, 2, GOLD_DARK);
    dot(CX - 1, torsoTop + 12, fit.topLight);
    dot(CX - 1, torsoTop + 15, fit.topLight);
    rect(CX + 4, torsoTop + 6, 3, 1, "#f5f2ea");
  }

  /* ---- chain ---- */
  if (fit.chain) {
    const c = fit.chain;
    const heavy = tier >= 4;
    mirror(CX - 4, torsoTop, 1, 2, c);
    mirror(CX - 3, torsoTop + 2, 1, 1, c);
    mirror(CX - 2, torsoTop + 3, 1, 1, c);
    rect(CX - 1, torsoTop + 4, 2, 1, c);
    if (heavy) {
      mirror(CX - 4, torsoTop + 2, 1, 1, c);
      mirror(CX - 3, torsoTop + 3, 1, 1, c);
      rect(CX - 2, torsoTop + 5, 4, 3, c);
      rect(CX - 1, torsoTop + 6, 2, 1, GOLD_DARK);
    } else if (tier >= 3) {
      rect(CX - 1, torsoTop + 5, 2, 2, c);
    }
  }

  /* ---- neck ---- */
  const nw = NECK[stage];
  rect(CX - nw / 2, by + 13, nw, 3, skin.base);
  rect(CX - nw / 2, by + 13, nw, 1, skin.shade);
  if (stage >= 4 && fit.style === "tee") {
    // Traps rising into the neck.
    mirror(CX - nw / 2 - 2, by + 15, 2, 1, fit.top);
  }

  /* ---- arms ---- */
  const armX = CX - sh - aw; // left arm's outer edge
  const sleeveLen = fit.sleeves === "long" ? 99 : SLEEVE[stage];
  const sleeveColor = (r: number) => (r < sleeveLen ? fit.top : skin.base);
  const sleeveShade = (r: number) => (r < sleeveLen ? fit.topShade : skin.shade);
  const handW = Math.max(3, Math.min(4, aw));

  const armColumn = (rows: number) => {
    const start = stage >= 4 ? -1 : stage >= 2 ? 0 : 1;
    for (let r = start; r < rows; r++) {
      const bulge = stage >= 3 && r >= 3 && r <= 9 ? 1 : 0;
      const y = torsoTop + r;
      // left (viewer's left)
      rect(armX - bulge, y, aw + bulge, 1, sleeveColor(r));
      // right, with its outer edge in shade
      rect(CX + sh, y, aw + bulge, 1, sleeveColor(r));
      rect(CX + sh + aw + bulge - 1, y, 1, 1, sleeveShade(r));
      // seam against the body
      dot(CX - sh - 1, y, sleeveShade(r));
    }
    if (fit.sleeves === "short") mirror(armX - (stage >= 3 ? 1 : 0), torsoTop + sleeveLen - 1, aw + (stage >= 3 ? 1 : 0), 1, fit.topShade);
    if (stage >= 3 && fit.sleeves === "short") {
      // Bicep highlight.
      mirror(armX, torsoTop + sleeveLen + 1, 1, 3, "#ffffff22");
    }
  };

  if (flexing) {
    // Double biceps: upper arms out, forearms up, fists by the head.
    const thick = Math.max(3, Math.min(6, aw));
    const lift = pump;
    const upperY = torsoTop + 1 - lift;
    mirror(CX - sh - 7, upperY, 8, thick, sleeveColor(0));
    if (fit.sleeves === "short") mirror(CX - sh - 7, upperY, 4, thick, skin.base);
    // The peak.
    const peak = Math.max(1, Math.min(3, stage));
    mirror(CX - sh - 6, upperY - peak, 5, peak, fit.sleeves === "short" ? skin.base : fit.top);
    mirror(CX - sh - 5, upperY - peak, 1, 1, "#ffffff2e");
    const fore = Math.max(3, thick - 1);
    mirror(CX - sh - 7 - 1, upperY - 9, fore, 10, fit.sleeves === "short" ? skin.base : fit.top);
    mirror(CX - sh - 7 - 1, upperY - 12, fore + 1, 4, skin.base); // fist
    mirror(CX - sh - 7 - 1, upperY - 9, fore + 1, 1, skin.shade);
    if (fit.watch) rect(CX + sh + 8 - fore, upperY - 8, fore, 2, GOLD);
  } else if (holding) {
    armColumn(19);
    // Forearms swing in to carry the stack.
    const handY = torsoTop + 15;
    const innerL = armX + aw;
    if (CX - 8 > innerL) {
      mirror(innerL, handY + 1, CX - 8 - innerL, 3, sleeveColor(19));
      mirror(innerL, handY + 3, CX - 8 - innerL, 1, sleeveShade(19));
    }
  } else {
    armColumn(21);
    const handY = torsoTop + 21;
    mirror(armX + Math.floor((aw - handW) / 2), handY, handW, 3, skin.base);
    mirror(armX + Math.floor((aw - handW) / 2), handY + 2, handW, 1, skin.shade);
    if (fit.cuff && fit.style !== "puffer") mirror(armX, handY - 1, aw, 1, fit.cuff);
    if (fit.watch) rect(CX + sh, handY - (fit.cuff && fit.style !== "puffer" ? 2 : 1), aw, 1, GOLD);
  }

  /* ---- head ---- */
  const hy = by; // top of hair
  rect(CX - 6, hy + 2, 12, 10, skin.base);
  rect(CX - 5, hy + 12, 10, 1, skin.base);
  rect(CX - 4, hy + 13, 8, 1, skin.base);
  rect(CX + 4, hy + 5, 2, 7, skin.shade); // cheek in shade
  rect(CX + 3, hy + 12, 2, 1, skin.shade);
  mirror(CX - 7, hy + 7, 1, 3, skin.base); // ears
  dot(CX + 6, hy + 8, skin.shade);

  // Hair, cap or slicked hair.
  if (fit.cap) {
    const cap = fit.cap;
    rect(CX - 4, hy - 1, 8, 1, cap.crown);
    rect(CX - 6, hy, 12, 4, cap.crown);
    rect(CX - 3, hy, 6, 3, cap.panel);
    if (cap.mark) rect(CX - 1, hy + 1, 2, 1, cap.mark);
    rect(CX - 7, hy + 4, 14, 1, cap.brim);
    rect(CX - 6, hy + 5, 12, 1, cap.brim);
    mirror(CX - 6, hy + 6, 1, 2, hair.base); // hair under the cap
  } else {
    rect(CX - 4, hy, 8, 1, hair.base);
    rect(CX - 6, hy + 1, 12, 3, hair.base);
    mirror(CX - 6, hy + 4, 1, 3, hair.base);
    if (tier === 5) {
      // Slicked back, with a shine.
      rect(CX - 5, hy + 4, 10, 1, hair.base);
      rect(CX - 3, hy + 1, 5, 1, hair.light);
      rect(CX - 1, hy + 2, 4, 1, hair.light);
    } else {
      // A bit of a mess.
      rect(CX - 5, hy + 4, 3, 1, hair.base);
      rect(CX + 1, hy + 4, 2, 1, hair.base);
      dot(CX - 2, hy - 1, hair.base);
      dot(CX + 2, hy - 1, hair.base);
      rect(CX - 3, hy + 1, 3, 1, hair.light);
    }
  }

  // Face.
  const eyeY = hy + 7;
  if (fit.shades) {
    rect(CX - 6, eyeY, 12, 1, "#0a0a0c");
    mirror(CX - 5, eyeY, 4, 3, "#0a0a0c");
    mirror(CX - 4, eyeY, 1, 1, "#6d6d7a");
  } else {
    mirror(CX - 5, eyeY - 2, 3, 1, hair.base); // brows
    if (blink) {
      mirror(CX - 4, eyeY + 1, 2, 1, skin.line);
    } else {
      mirror(CX - 4, eyeY, 2, 2, "#ffffff");
      // Pupils look straight ahead.
      rect(CX - 3, eyeY, 1, 2, "#16161a");
      rect(CX + 2, eyeY, 1, 2, "#16161a");
      if (look.energy === "tired") {
        mirror(CX - 4, eyeY, 2, 1, skin.shade); // heavy lids
        mirror(CX - 4, eyeY + 2, 2, 1, skin.line); // bags
      } else if (look.energy === "rested") {
        dot(CX - 4, eyeY, "#ffffff");
      }
    }
  }
  rect(CX - 1, hy + 9, 2, 2, skin.shade); // nose
  const mouthY = hy + 12;
  const happy = look.energy === "rested" || look.aura || flexing || effect?.kind === "cash";
  if (look.energy === "tired" && !flexing) {
    rect(CX - 1, mouthY, 2, 1, skin.line);
  } else if (happy) {
    rect(CX - 2, mouthY, 4, 1, skin.line);
    mirror(CX - 3, mouthY - 1, 1, 1, skin.line);
    if (flexing || effect?.kind === "cash") rect(CX - 2, mouthY - 1, 4, 1, "#ffffff"); // grin
  } else {
    rect(CX - 2, mouthY, 4, 1, skin.line);
  }

  /* ---- cash in his hands ---- */
  if (holding) {
    const bottom = torsoTop + 18;
    const h = look.bills;
    const top = bottom - h + 1;
    const x = CX - 7;
    for (let i = 0; i < h; i++) rect(x, bottom - i, 14, 1, i % 2 === 0 ? CASH.a : CASH.b);
    rect(x, top, 14, 1, CASH.top);
    rect(x, bottom, 14, 1, CASH.edge);
    rect(x + 13, top, 1, h, CASH.edge);
    // Paper band around the middle.
    rect(CX - 2, top, 4, h, CASH.band);
    rect(CX + 1, top, 1, h, CASH.bandShade);
    if (!still) {
      // A glint walks across the top bill.
      const g = Math.floor(t / 110) % 34;
      if (g < 13) dot(x + g, top, "#ffffff");
      // Now and then the top bill lifts.
      if (h > 2 && t % 4200 > 3900) rect(x + 9, top - 1, 5, 1, CASH.top);
    }
    // Hands grip the bottom corners.
    const handY = bottom - 3;
    mirror(CX - 9, handY, 3, 4, skin.base);
    mirror(CX - 9, handY + 3, 3, 1, skin.shade);
    mirror(CX - 7, handY, 1, 2, skin.shade); // thumbs
    if (fit.cuff && fit.style !== "puffer") mirror(CX - 10, handY + 1, 1, 3, fit.cuff);
    if (fit.watch) rect(CX + 9, handY + 1, 1, 3, GOLD);
  }

  /* ---- sparkle for the top tier ---- */
  if (tier === 5 && !still) {
    const spots: [number, number][] = [[10, 22], [54, 30], [8, 50], [56, 56], [50, 12]];
    spots.forEach(([x, y], i) => {
      const phase = (t / 260 + i * 1.7) % 6;
      if (phase < 1) dot(x, y, GOLD);
      else if (phase < 2) {
        rect(x - 1, y, 3, 1, "#fff6c9");
        rect(x, y - 1, 1, 3, "#fff6c9");
      }
    });
  }

  /* ---- one-off effects ---- */
  if (effect && !still) {
    const a = effect.age;
    if (effect.kind === "cash" && a < 2000) {
      for (let i = 0; i < 14; i++) {
        const delay = hash(i + 3) * 700;
        if (a < delay) continue;
        const fall = (a - delay) / 1100;
        if (fall > 1) continue;
        const x = 4 + Math.floor(hash(i) * 54) + Math.round(Math.sin(a / 160 + i) * 1.5);
        const y = -2 + fall * (GROUND - 2);
        rect(x, y, 4, 2, i % 3 === 0 ? CASH.top : CASH.a);
        dot(x + 1, y, CASH.band);
      }
    }
    if (effect.kind === "zzz" && a < 2200) {
      for (let i = 0; i < 3; i++) {
        const start = i * 380;
        if (a < start) continue;
        const p = Math.min(1, (a - start) / 1500);
        const x = CX + 9 + i * 4 + Math.round(p * 3);
        const y = OY + 4 - i * 5 - Math.round(p * 6);
        ctx.globalAlpha = 1 - p * 0.8;
        const s = i === 2 ? 4 : 3;
        rect(x, y, s, 1, "#c9b8ff");
        for (let k = 1; k < s - 1; k++) dot(x + s - 1 - k, y + k, "#c9b8ff");
        rect(x, y + s - 1, s, 1, "#c9b8ff");
        ctx.globalAlpha = 1;
      }
    }
    if (effect.kind === "spark" && a < 1300) {
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2;
        const p = a / 1300;
        const x = CX + Math.cos(ang) * (8 + p * 20);
        const y = OY + 24 + Math.sin(ang) * (8 + p * 22);
        ctx.globalAlpha = 1 - p;
        rect(x, y, 2, 2, i % 2 ? "#5cc8ff" : "#ffffff");
        ctx.globalAlpha = 1;
      }
    }
    if (effect.kind === "flex" && a < 1500 && pump) {
      // Effort lines.
      dot(CX - sh - 12, by + 2, "#ffffff");
      dot(CX + sh + 11, by + 2, "#ffffff");
      dot(CX - sh - 13, by + 6, "#ffffff");
      dot(CX + sh + 12, by + 6, "#ffffff");
    }
  }
}

/** Paints everything already drawn solid white: the "evolving" flash. */
export function whiteOut(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, SPRITE_W, SPRITE_H);
  ctx.restore();
}
