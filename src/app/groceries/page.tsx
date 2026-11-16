"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PixelIcon } from "@/components/PixelIcon";
import { Sheet } from "@/components/Sheet";
import { Chips, PrimaryButton } from "@/components/ui";
import { parseGroceryText } from "@/lib/groceries";
import { useLife } from "@/lib/store";

const spring = { type: "spring", stiffness: 520, damping: 42, mass: 0.9 } as const;

export default function GroceriesPage() {
  const groceries = useLife((s) => s.groceries);
  const addGroceries = useLife((s) => s.addGroceries);
  const toggle = useLife((s) => s.toggleGrocery);
  const remove = useLife((s) => s.removeGrocery);
  const setAll = useLife((s) => s.setAllGroceries);

  const [text, setText] = useState("");
  const [arrived, setArrived] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [importing, setImporting] = useState(false);
  const [paste, setPaste] = useState("");
  const [mode, setMode] = useState<"buy" | "have">("buy");
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);

  // To buy: the one you unticked last is on top. At home: alphabetical, so things are easy to find.
  const { toBuy, atHome } = useMemo(() => {
    const need = groceries.filter((g) => g.needed).sort((a, b) => b.movedAt - a.movedAt);
    const have = groceries.filter((g) => !g.needed).sort((a, b) => a.name.localeCompare(b.name, "nl"));
    return { toBuy: need, atHome: have };
  }, [groceries]);

  const q = text.trim().toLowerCase();
  const homeShown = q ? atHome.filter((g) => g.name.toLowerCase().includes(q)) : atHome;
  const exact = q ? groceries.find((g) => g.name.toLowerCase() === q) : undefined;

  const flip = (id: string, becomesNeeded: boolean) => {
    toggle(id);
    if (becomesNeeded) {
      setArrived(id);
      setTimeout(() => setArrived((cur) => (cur === id ? null : cur)), 1000);
    }
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q) return;
    if (exact) {
      if (!exact.needed) flip(exact.id, true);
    } else {
      const [item] = parseGroceryText(text, true);
      if (item) addGroceries([{ ...item, needed: true }]);
    }
    setText("");
    input.current?.focus();
  };

  const runImport = () => {
    const items = parseGroceryText(paste, mode === "buy");
    if (!items.length) return;
    const { added, updated } = addGroceries(items);
    setNotice(`${added} added${updated ? `, ${updated} already on your list` : ""}.`);
    setPaste("");
    setImporting(false);
  };

  const parsedCount = useMemo(() => parseGroceryText(paste, true).length, [paste]);

  return (
    <main className="mx-auto max-w-[640px]">
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-pixel text-[34px] leading-none">Groceries</h1>
          <p className="mt-1.5 text-[14px] text-ash" role="status">
            {notice || (groceries.length === 0 ? "Your list is empty." : toBuy.length === 0 ? "Nothing to buy. Untick what you run out of." : `${toBuy.length} to buy`)}
          </p>
        </div>
        <button type="button" onClick={() => setMenu(true)} aria-label="List options" className="grid size-10 place-items-center rounded-full bg-coal text-ash hover:text-bone">
          <PixelIcon name="menu" size={16} />
        </button>
      </header>

      <form onSubmit={add} className="sticky top-[calc(8px+env(safe-area-inset-top))] z-20 mb-4 flex gap-2">
        <input
          ref={input}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setNotice("");
          }}
          placeholder="Add or find an item"
          aria-label="Add or find an item"
          autoComplete="off"
          enterKeyHint="done"
          className="h-13 min-w-0 flex-1 rounded-2xl border border-line bg-coal px-4 shadow-[0_8px_24px_rgb(0_0_0/0.5)] placeholder:text-dim focus:border-cash focus:outline-none"
        />
        <button type="submit" disabled={!q} aria-label="Add to list" className="grid size-13 shrink-0 place-items-center rounded-2xl bg-cash text-ink disabled:opacity-40">
          <PixelIcon name="plus" size={16} />
        </button>
      </form>

      {groceries.length === 0 ? (
        <div className="rounded-[20px] bg-coal p-5">
          <p className="mb-4 text-ash">
            Bring in the list you already have, or type your first item above. Items you still need stay on top. Tick one off in
            the shop and it drops out of the way.
          </p>
          <PrimaryButton onClick={() => setImporting(true)}>Import my list</PrimaryButton>
        </div>
      ) : (
        <>
          {/* One list, so an item can fly from the bottom group to the top. */}
          <ul className="space-y-1.5" aria-label="Groceries">
            <AnimatePresence initial={false}>
              {toBuy.map((g) => (
                <motion.li
                  key={g.id}
                  layout
                  transition={spring}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  className={`relative z-10 flex items-center rounded-2xl bg-coal ${arrived === g.id ? "arrive" : ""}`}
                >
                  <Row name={g.name} qty={g.qty} checked={false} onToggle={() => flip(g.id, false)} />
                  {editing && <Delete name={g.name} onClick={() => remove(g.id)} />}
                </motion.li>
              ))}
              {atHome.length > 0 && (
                <motion.li
                  key="divider"
                  layout
                  transition={spring}
                  className="flex items-baseline justify-between px-1 pb-0.5 pt-4 text-[13px] text-ash"
                >
                  <span>{q ? `At home, matching "${text.trim()}"` : "At home. Untick what you have run out of."}</span>
                  <span className="tabular-nums">{homeShown.length}</span>
                </motion.li>
              )}
              {homeShown.map((g) => (
                <motion.li
                  key={g.id}
                  layout
                  transition={spring}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  className="flex items-center rounded-2xl bg-coal/60"
                >
                  <Row
                    name={g.name}
                    qty={g.qty}
                    checked
                    onToggle={() => {
                      flip(g.id, true);
                      if (q) setText("");
                    }}
                  />
                  {editing && <Delete name={g.name} onClick={() => remove(g.id)} />}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {q && !exact && (
            <p className="mt-3 px-1 text-[13px] text-ash">Press the plus to add &ldquo;{text.trim()}&rdquo; as a new item.</p>
          )}
        </>
      )}

      <Sheet open={menu} onClose={() => setMenu(false)} title="List options">
        <div className="space-y-2">
          <MenuButton
            onClick={() => {
              setMenu(false);
              setImporting(true);
            }}
          >
            Import a list
          </MenuButton>
          <MenuButton
            onClick={() => {
              setEditing((v) => !v);
              setMenu(false);
            }}
          >
            {editing ? "Done removing items" : "Remove items"}
          </MenuButton>
          <MenuButton
            onClick={() => {
              setAll(false);
              setMenu(false);
            }}
          >
            Tick everything off
          </MenuButton>
        </div>
      </Sheet>

      <Sheet open={importing} onClose={() => setImporting(false)} title="Import a list">
        <div className="space-y-4">
          <p className="text-[14px] text-ash">
            Paste your list, one item per line. Bullets, checkboxes and amounts like &ldquo;2x melk&rdquo; are understood.
          </p>
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={8}
            aria-label="Your list"
            placeholder={"Melk\n2x brood\nKipfilet 1 kg\nEieren"}
            className="w-full rounded-xl border border-line bg-ink p-3 placeholder:text-dim focus:border-cash focus:outline-none"
          />
          <div>
            <p className="mb-2 text-[13px] text-ash">These items are</p>
            <Chips label="Import as" options={["buy", "have"] as const} value={mode} onChange={setMode} format={(m) => (m === "buy" ? "Things I need to buy" : "Things I have at home")} />
          </div>
          <PrimaryButton onClick={runImport} disabled={parsedCount === 0}>
            {parsedCount === 0 ? "Import" : `Import ${parsedCount} ${parsedCount === 1 ? "item" : "items"}`}
          </PrimaryButton>
        </div>
      </Sheet>
    </main>
  );
}

function Row({ name, qty, checked, onToggle }: { name: string; qty?: string; checked: boolean; onToggle: () => void }) {
  return (
    <label className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 px-3.5 py-2">
      <input type="checkbox" checked={checked} onChange={onToggle} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={`grid size-7 shrink-0 place-items-center rounded-lg border-2 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cash ${
          checked ? "border-cash bg-cash text-ink" : "border-dim text-transparent"
        }`}
      >
        <PixelIcon name="check" size={13} />
      </span>
      <span className={`min-w-0 flex-1 truncate text-[17px] ${checked ? "text-ash" : "text-bone"}`}>{name}</span>
      {qty && <span className={`shrink-0 rounded-md px-2 py-0.5 font-pixel text-[18px] ${checked ? "text-dim" : "bg-pit text-cash"}`}>{qty}</span>}
    </label>
  );
}

function Delete({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={`Remove ${name}`} className="mr-2 grid size-10 shrink-0 place-items-center rounded-full text-bad hover:bg-pit">
      <PixelIcon name="trash" size={13} />
    </button>
  );
}

function MenuButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="h-13 w-full rounded-xl bg-pit px-4 text-left font-medium hover:bg-line">
      {children}
    </button>
  );
}
