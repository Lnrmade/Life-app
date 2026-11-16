/** Pulls a title, picture and price out of a product page's HTML. No DOM needed. */

export interface Preview {
  title?: string;
  image?: string;
  price?: number;
  currency?: string;
  site?: string;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", euro: "€" };

export const decodeEntities = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);

/** "1.299,00", "1,299.00", "12,5", "€ 49.95" -> number */
export function parsePrice(raw: unknown): number | undefined {
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? raw : undefined;
  if (typeof raw !== "string") return undefined;
  let s = raw.replace(/[^\d.,]/g, "");
  if (!s) return undefined;
  const comma = s.lastIndexOf(","), dot = s.lastIndexOf(".");
  if (comma > -1 && dot > -1) {
    s = comma > dot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (comma > -1) {
    // "1,299" is a thousands separator, "12,99" a decimal comma.
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function metaTags(html: string) {
  const map = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attr = (name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
    const key = attr("property") ?? attr("name") ?? attr("itemprop");
    const content = attr("content");
    if (!key || !content) continue;
    const k = (key[1] ?? key[2] ?? key[3]).toLowerCase();
    if (!map.has(k)) map.set(k, decodeEntities(content[1] ?? content[2] ?? content[3] ?? "").trim());
  }
  return map;
}

type Json = Record<string, unknown>;

/** Walks JSON-LD looking for the first thing that carries an offer. */
function findProduct(node: unknown, depth = 0): Json | undefined {
  if (!node || typeof node !== "object" || depth > 6) return undefined;
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findProduct(item, depth + 1);
      if (hit) return hit;
    }
    return undefined;
  }
  const obj = node as Json;
  const type = ([] as unknown[]).concat(obj["@type"] ?? []).map(String);
  if (type.some((t) => /product/i.test(t)) || obj.offers) return obj;
  return findProduct(obj["@graph"], depth + 1) ?? findProduct(obj.mainEntity, depth + 1);
}

function offerPrice(offers: unknown): { price?: number; currency?: string } {
  const list = Array.isArray(offers) ? offers : [offers];
  for (const o of list) {
    if (!o || typeof o !== "object") continue;
    const offer = o as Json;
    const spec = (Array.isArray(offer.priceSpecification) ? offer.priceSpecification[0] : offer.priceSpecification) as Json | undefined;
    const price = parsePrice(offer.price) ?? parsePrice(offer.lowPrice) ?? parsePrice(spec?.price);
    if (price) return { price, currency: String(offer.priceCurrency ?? spec?.priceCurrency ?? "") || undefined };
  }
  return {};
}

function imageOf(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return imageOf(value[0]);
  if (value && typeof value === "object") return imageOf((value as Json).url ?? (value as Json).contentUrl);
  return undefined;
}

export function extractPreview(html: string, pageUrl: string): Preview {
  const meta = metaTags(html);
  const out: Preview = {};

  // Structured product data is the most reliable source.
  for (const block of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const product = findProduct(JSON.parse(block[1].trim()));
      if (!product) continue;
      const { price, currency } = offerPrice(product.offers);
      if (typeof product.name === "string" && !out.title) out.title = decodeEntities(product.name).trim();
      out.image ??= imageOf(product.image);
      if (price && !out.price) {
        out.price = price;
        out.currency = currency;
      }
    } catch {
      /* malformed JSON-LD is common; ignore it */
    }
  }

  const pageTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  out.title = meta.get("og:title") || out.title || meta.get("twitter:title") || (pageTitle ? decodeEntities(pageTitle).replace(/\s+/g, " ").trim() : undefined);
  out.image = meta.get("og:image:secure_url") || meta.get("og:image") || out.image || meta.get("twitter:image") || meta.get("twitter:image:src");
  out.site = meta.get("og:site_name");

  if (!out.price) {
    out.price = parsePrice(meta.get("product:price:amount")) ?? parsePrice(meta.get("og:price:amount")) ?? parsePrice(meta.get("product:sale_price:amount")) ?? parsePrice(meta.get("price"));
    out.currency = meta.get("product:price:currency") ?? meta.get("og:price:currency") ?? meta.get("pricecurrency");
  }
  if (!out.price) {
    // Microdata on an element other than <meta>.
    const micro = html.match(/itemprop\s*=\s*["']price["'][^>]*\bcontent\s*=\s*["']([^"']+)["']/i) ?? html.match(/\bcontent\s*=\s*["']([^"']+)["'][^>]*itemprop\s*=\s*["']price["']/i);
    out.price = parsePrice(micro?.[1]);
    out.currency ??= html.match(/itemprop\s*=\s*["']priceCurrency["'][^>]*\bcontent\s*=\s*["']([A-Za-z]{3})["']/i)?.[1];
  }

  if (out.image) {
    try {
      out.image = new URL(decodeEntities(out.image), pageUrl).toString();
    } catch {
      out.image = undefined;
    }
  }
  if (out.currency) out.currency = out.currency.toUpperCase().slice(0, 3);
  if (out.title && out.title.length > 160) out.title = `${out.title.slice(0, 157)}...`;
  return out;
}

/** True for hosts a public link preview should never be pointed at. */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.match(/^(?:::ffff:)?(\d+)\.(\d+)\.(\d+)\.(\d+)$/i);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb") || v6.startsWith("ff");
}
