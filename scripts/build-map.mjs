// Turns Natural Earth country shapes into a grid of dots, one list per country.
// Run with `npm run build:map`. The result is committed, so builds do not need it.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { geoBounds, geoCentroid, geoContains } from "d3-geo";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
const iso = require("i18n-iso-countries");
const topo = JSON.parse(readFileSync(require.resolve("world-atlas/countries-50m.json"), "utf8"));

const COLS = 400;
const LAT_TOP = 78;
const LAT_BOTTOM = -56;
const ROW_H = Math.sqrt(3) / 2; // dots sit in a honeycomb

const cell = (2 * Math.PI) / COLS;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const latOf = (y) => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;
const yTop = mercY(LAT_TOP);
const ROWS = Math.ceil((yTop - mercY(LAT_BOTTOM)) / (cell * ROW_H));

const lonLat = (col, row) => [
  ((col + (row % 2 ? 0.5 : 0) + 0.5) / COLS) * 360 - 180,
  latOf(yTop - (row + 0.5) * cell * ROW_H),
];

// A few places Natural Earth ships without an ISO number.
const EXTRA = { Kosovo: ["983", "XK"], "N. Cyprus": ["984", ""], Somaliland: ["985", ""] };
const RENAME = { "N. Cyprus": "Northern Cyprus", "United States of America": "United States", "Dem. Rep. Congo": "DR Congo", "Bosnia and Herz.": "Bosnia and Herzegovina", "Central African Rep.": "Central African Republic", "Dominican Rep.": "Dominican Republic", "Eq. Guinea": "Equatorial Guinea", "S. Sudan": "South Sudan", "W. Sahara": "Western Sahara", "Falkland Is.": "Falkland Islands", "Solomon Is.": "Solomon Islands", "Marshall Is.": "Marshall Islands", "Cayman Is.": "Cayman Islands", "Faeroe Is.": "Faroe Islands", "Cook Is.": "Cook Islands", "Fr. Polynesia": "French Polynesia", "St. Kitts and Nevis": "Saint Kitts and Nevis", "St. Vin. and Gren.": "Saint Vincent and the Grenadines", "Antigua and Barb.": "Antigua and Barbuda", "N. Mariana Is.": "Northern Mariana Islands", "U.S. Virgin Is.": "US Virgin Islands", "British Virgin Is.": "British Virgin Islands", "Turks and Caicos Is.": "Turks and Caicos Islands", "São Tomé and Principe": "São Tomé and Príncipe", "Vatican": "Vatican City", "eSwatini": "Eswatini" };
const SKIP = new Set(["Antarctica", "Indian Ocean Ter.", "Siachen Glacier", "Ashmore and Cartier Is."]);

const countries = feature(topo, topo.objects.countries)
  .features.filter((f) => !SKIP.has(f.properties.name))
  .map((f) => {
    const name = f.properties.name;
    const id = f.id ?? EXTRA[name]?.[0];
    if (!id) throw new Error(`No id for ${name}`);
    const [[w, s], [e, n]] = geoBounds(f);
    return {
      f,
      id: String(id),
      // Natural Earth names are short and familiar; only its abbreviations get the ISO name.
      name: RENAME[name] ?? (name.includes(".") ? (iso.getName(String(id), "en", { select: "alias" }) ?? name) : name),
      a2: EXTRA[name]?.[1] ?? iso.numericToAlpha2(String(id)) ?? "",
      box: { w, s, e, n, wraps: w > e },
      dots: [],
    };
  });

const inBox = (b, lon, lat) => lat >= b.s && lat <= b.n && (b.wraps ? lon >= b.w || lon <= b.e : lon >= b.w && lon <= b.e);

const owner = new Map(); // "col,row" -> country
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    const p = lonLat(col, row);
    for (const c of countries) {
      if (inBox(c.box, p[0], p[1]) && geoContains(c.f, p)) {
        owner.set(`${col},${row}`, c);
        break;
      }
    }
  }
}

// Countries too small to catch a dot get the cell nearest their centre,
// borrowed from a neighbour that can spare one.
const count = new Map();
for (const c of owner.values()) count.set(c, (count.get(c) ?? 0) + 1);
for (const c of countries.filter((c) => !count.get(c))) {
  const [lon, lat] = geoCentroid(c.f);
  let best = null;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const holder = owner.get(`${col},${row}`);
      if (holder && (count.get(holder) ?? 0) <= 2) continue;
      const p = lonLat(col, row);
      const d = Math.hypot((p[0] - lon) * Math.cos((lat * Math.PI) / 180), p[1] - lat);
      if (!best || d < best.d) best = { d, col, row, holder };
    }
  }
  if (best.holder) count.set(best.holder, count.get(best.holder) - 1);
  owner.set(`${best.col},${best.row}`, c);
  count.set(c, 1);
}

// Store each country as runs along a row: [row, firstCol, length, ...].
const cells = new Map();
for (const [key, c] of owner) {
  const [col, row] = key.split(",").map(Number);
  if (!cells.has(c)) cells.set(c, []);
  cells.get(c).push([row, col]);
}
for (const [c, list] of cells) {
  list.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  c.n = list.length;
  for (let i = 0; i < list.length; ) {
    let j = i;
    while (j + 1 < list.length && list[j + 1][0] === list[i][0] && list[j + 1][1] === list[j][1] + 1) j++;
    c.dots.push(list[i][0], list[i][1], j - i + 1);
    i = j + 1;
  }
}

const out = {
  cols: COLS,
  rows: ROWS,
  countries: countries
    .filter((c) => c.dots.length)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ id: c.id, name: c.name, a2: c.a2, n: c.n, d: c.dots })),
};

writeFileSync(new URL("../src/data/world-dots.json", import.meta.url), JSON.stringify(out));
const total = out.countries.reduce((s, c) => s + c.n, 0);
console.log(`${out.countries.length} countries, ${total} dots, ${COLS}x${ROWS} grid`);
