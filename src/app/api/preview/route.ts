import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { extractPreview, isPrivateAddress } from "@/lib/preview";

export const runtime = "nodejs";
export const maxDuration = 15;

const MAX_BYTES = 1_500_000;
const MAX_HOPS = 4;

const fail = (status: number, error: string) => Response.json({ error }, { status });

/** Only public http(s) addresses. Stops the route being used to reach internal hosts. */
async function assertPublic(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http and https links work.");
  if (url.username || url.password) throw new Error("Links with a login in them are not supported.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("That address is not public.");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) throw new Error("That address is not public.");
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url")?.trim();
  if (!raw || raw.length > 2000) return fail(400, "Send a link in the url parameter.");

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return fail(400, "That does not look like a link.");
  }

  const abort = AbortSignal.timeout(9000);
  try {
    let res: Response | null = null;
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      await assertPublic(url);
      res = await fetch(url, {
        redirect: "manual",
        signal: abort,
        headers: {
          "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "accept-language": "nl-NL,nl;q=0.9,en;q=0.8",
        },
      });
      const next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
      if (!next) break;
      url = new URL(next, url);
      res = null;
    }
    if (!res) return fail(502, "Too many redirects.");
    if (!res.ok) return fail(502, `The shop answered with ${res.status}.`);
    if (!/html|xml/i.test(res.headers.get("content-type") ?? "html")) return fail(415, "That link is not a web page.");

    // Read at most MAX_BYTES; the tags we need are near the top.
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader && size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
    void reader?.cancel().catch(() => {});
    const html = new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));

    const preview = extractPreview(html, url.toString());
    return Response.json(
      { ...preview, site: preview.site ?? url.hostname.replace(/^www\./, ""), url: url.toString() },
      { headers: { "cache-control": "private, max-age=600" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/not public|Only http|login/.test(message)) return fail(400, message);
    return fail(502, abort.aborted ? "The shop took too long to answer." : "Could not reach that page.");
  }
}
