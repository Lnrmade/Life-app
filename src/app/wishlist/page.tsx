"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PixelIcon } from "@/components/PixelIcon";
import { Sheet } from "@/components/Sheet";
import { Bar, Label, PrimaryButton, TextInput } from "@/components/ui";
import { todayKey } from "@/lib/dates";
import { money, moneyIn, parseAmount } from "@/lib/format";
import { moneyFrom } from "@/lib/game";
import { authHeaders } from "@/lib/supabase";
import { useLife } from "@/lib/store";
import type { WishItem } from "@/lib/types";

/** Finds the first link in whatever was pasted or shared. */
const findUrl = (text: string): string | null => {
  const hit = text.match(/https?:\/\/[^\s<>"']+/i)?.[0] ?? (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(text.trim()) ? `https://${text.trim()}` : null);
  if (!hit) return null;
  try {
    return new URL(hit.replace(/[),.]+$/, "")).toString();
  } catch {
    return null;
  }
};

export default function WishlistPage() {
  const wishlist = useLife((s) => s.wishlist);
  const logs = useLife((s) => s.logs);
  const settings = useLife((s) => s.settings);
  const addWish = useLife((s) => s.addWish);
  const updateWish = useLife((s) => s.updateWish);
  const removeWish = useLife((s) => s.removeWish);
  const addLog = useLife((s) => s.addLog);
  const fire = useLife((s) => s.fire);
  const setSettings = useLife((s) => s.setSettings);

  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<WishItem | null>(null);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");

  const wallet = useMemo(() => moneyFrom(logs, settings, todayKey()), [logs, settings]);
  const budget = Math.max(0, settings.wishIncludesSavings ? wallet.total : wallet.cash);

  const load = useCallback(
    async (id: string, url: string) => {
      updateWish(id, { status: "loading" });
      try {
        const res = await fetch(`/api/preview?url=${encodeURIComponent(url)}`, { headers: await authHeaders() });
        if (!res.ok) throw new Error();
        const p = (await res.json()) as { title?: string; image?: string; price?: number; currency?: string; site?: string };
        const current = useLife.getState().wishlist.find((w) => w.id === id);
        updateWish(id, {
          status: "ready",
          title: p.title || current?.title || url,
          image: p.image ?? current?.image,
          // A price you typed yourself is only replaced when the shop gives us one.
          price: p.price ?? current?.price,
          currency: p.currency || current?.currency || "EUR",
          site: p.site || current?.site || "",
        });
      } catch {
        updateWish(id, { status: "failed" });
      }
    },
    [updateWish],
  );

  const add = useCallback(
    (raw: string) => {
      const url = findUrl(raw);
      if (!url) {
        setError("That is not a link. Copy the product page address and try again.");
        return false;
      }
      if (useLife.getState().wishlist.some((w) => w.url === url)) {
        setError("That link is already on your wishlist.");
        return false;
      }
      setError("");
      void load(addWish(url), url);
      return true;
    },
    [addWish, load],
  );

  // Links shared to the app arrive as /wishlist?url=...; previews cut short by a reload are retried.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = [params.get("url"), params.get("text"), params.get("title")].filter(Boolean).join(" ");
    const stuck = useLife.getState().wishlist.filter((w) => w.status === "loading");
    const timer = setTimeout(() => {
      if (shared) {
        add(shared);
        window.history.replaceState(null, "", "/wishlist");
      }
      for (const w of stuck) void load(w.id, w.url);
    }, 0);
    return () => clearTimeout(timer);
  }, [add, load]);

  // Paste anywhere on the page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      const pasted = e.clipboardData?.getData("text") ?? "";
      if (pasted) add(pasted);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [add]);

  const pasteFromClipboard = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (!clip.trim()) setError("Your clipboard is empty. Copy a product link first.");
      else add(clip);
    } catch {
      setError("Your browser blocked clipboard access. Paste the link into the field instead.");
    }
  };

  const openEdit = (w: WishItem) => {
    setEditing(w);
    setTitle(w.title);
    setPrice(w.price ? String(w.price).replace(".", ",") : "");
  };
  const saveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const p = parseAmount(price);
    updateWish(editing.id, { title: title.trim() || editing.title, price: Number.isFinite(p) && p > 0 ? p : undefined, status: "ready" });
    setEditing(null);
  };
  const bought = (w: WishItem) => {
    if (!w.price) return removeWish(w.id);
    if (!confirm(`Log ${moneyIn(w.price, w.currency)} as an expense and take "${w.title}" off your wishlist?`)) return;
    addLog("finance", { date: todayKey(), type: "expense", amount: w.price, category: "Wishlist", note: w.title });
    fire({ effect: "spark", xp: 5, label: "Bought it" });
    removeWish(w.id);
  };

  return (
    <main className="mx-auto max-w-[640px]">
      <header className="mb-4">
        <h1 className="font-pixel text-[34px] leading-none">Wishlist</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-ash">
          <span>
            You have <span className="font-pixel text-[21px] text-cash">{money(budget)}</span> {settings.wishIncludesSavings ? "in cash and savings." : "in cash."}
          </span>
          <button type="button" onClick={() => setSettings({ wishIncludesSavings: !settings.wishIncludesSavings })} className="underline underline-offset-4 hover:text-bone">
            {settings.wishIncludesSavings ? "Leave savings out" : "Count savings too"}
          </button>
        </div>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (add(text)) setText("");
        }}
        className="mb-2 flex gap-2"
      >
        <button type="button" onClick={pasteFromClipboard} className="px-corners flex h-13 shrink-0 items-center gap-2 bg-cash px-4 font-pixel text-[22px] text-ink active:scale-95">
          <PixelIcon name="paste" size={15} />
          Paste link
        </button>
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError("");
          }}
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="or type a link"
          aria-label="Product link"
          enterKeyHint="go"
          className="h-13 min-w-0 flex-1 rounded-2xl border border-line bg-coal px-4 placeholder:text-dim focus:border-cash focus:outline-none"
        />
      </form>
      <p role="alert" className="mb-3 min-h-5 text-[13px] text-bad">
        {error}
      </p>

      {wishlist.length === 0 ? (
        <p className="rounded-[20px] bg-coal p-5 text-ash">
          Copy the link of something you want and tap Paste link. The app looks up its name, picture and price, and shows how many
          times your money covers it.
        </p>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {wishlist.map((w) => (
              <motion.li
                key={w.id}
                layout
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 480, damping: 40 }}
                className="overflow-hidden rounded-[20px] bg-coal"
              >
                <Card w={w} budget={budget} onEdit={() => openEdit(w)} onRefresh={() => load(w.id, w.url)} onRemove={() => removeWish(w.id)} onBought={() => bought(w)} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Edit item">
        <form onSubmit={saveEdit} className="space-y-4">
          <div>
            <Label htmlFor="w-title">Name</Label>
            <TextInput id="w-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="w-price">Price in euros</Label>
            <TextInput id="w-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="129,95" />
          </div>
          <PrimaryButton type="submit">Save</PrimaryButton>
        </form>
      </Sheet>
    </main>
  );
}

function Card({ w, budget, onEdit, onRefresh, onRemove, onBought }: { w: WishItem; budget: number; onEdit: () => void; onRefresh: () => void; onRemove: () => void; onBought: () => void }) {
  const [broken, setBroken] = useState(false);
  const loading = w.status === "loading";
  // Prices in another currency are compared one to one; good enough to rank, not exact.
  const times = w.price ? budget / w.price : null;
  const whole = times === null ? 0 : Math.floor(times);

  return (
    <article>
      <div className="flex gap-3 p-3">
        <a href={w.url} target="_blank" rel="noopener noreferrer" className="relative block size-[92px] shrink-0 overflow-hidden rounded-xl bg-pit" aria-label={`Open ${w.title}`}>
          {w.image && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element -- shop images come from any domain
            <img src={w.image} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setBroken(true)} className="size-full object-cover" />
          ) : (
            <span className={`grid size-full place-items-center text-dim ${loading ? "animate-pulse" : ""}`}>
              <PixelIcon name="link" size={26} />
            </span>
          )}
        </a>

        <div className="min-w-0 flex-1">
          <a href={w.url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 font-medium leading-snug hover:underline">
            {loading && w.title === w.site ? "Looking it up" : w.title}
          </a>
          <div className="mt-0.5 truncate text-[13px] text-ash">{w.site}</div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {w.price ? (
              <>
                <span className="font-pixel text-[29px] leading-none">{moneyIn(w.price, w.currency)}</span>
                {whole >= 1 ? (
                  <span className="px-corners bg-cash px-2.5 py-1 font-pixel text-[21px] leading-none text-ink" title={`Your money covers this ${whole} times`}>
                    {whole.toLocaleString("nl-NL")}× <span className="sr-only">affordable</span>
                  </span>
                ) : (
                  <span className="text-[13px] text-ash">{money(w.price - budget)} short</span>
                )}
              </>
            ) : loading ? (
              <span className="text-[14px] text-ash">Fetching the price</span>
            ) : (
              <button type="button" onClick={onEdit} className="h-9 rounded-full bg-pit px-3 text-[14px] text-cash hover:bg-line">
                {w.status === "failed" ? "The shop blocked the lookup. Add the price" : "No price found. Add it"}
              </button>
            )}
          </div>
        </div>
      </div>

      {w.price && times !== null && times < 1 && (
        <div className="px-3 pb-1">
          <Bar value={times} color="var(--color-cash)" height={6} />
          <div className="mt-1 text-[12px] text-ash">{Math.floor(times * 100)}% of the way there</div>
        </div>
      )}

      <div className="flex items-center border-t border-line/70 px-1 text-[13px] text-ash">
        <button type="button" onClick={onBought} className="h-11 px-3 hover:text-bone">
          Bought it
        </button>
        <button type="button" onClick={onEdit} className="h-11 px-3 hover:text-bone">
          Edit
        </button>
        <button type="button" onClick={onRefresh} disabled={loading} className="h-11 px-3 hover:text-bone disabled:opacity-40">
          {loading ? "Checking" : "Check price"}
        </button>
        <button type="button" onClick={onRemove} aria-label={`Remove ${w.title}`} className="ml-auto grid size-11 place-items-center hover:text-bad">
          <PixelIcon name="trash" size={13} />
        </button>
      </div>
    </article>
  );
}
