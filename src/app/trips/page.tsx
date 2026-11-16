"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DotMap } from "@/components/DotMap";
import type { DotMapHandle, MapCountry, MapData } from "@/components/DotMap";
import { PixelIcon } from "@/components/PixelIcon";
import { Sheet } from "@/components/Sheet";
import { Label, PrimaryButton, TextInput } from "@/components/ui";
import { prettyDate, todayKey } from "@/lib/dates";
import { useLife } from "@/lib/store";
import type { Trip } from "@/lib/types";

const flag = (a2: string) =>
  a2.length === 2 ? String.fromCodePoint(...[...a2.toUpperCase()].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)) : "";

const tripDates = (t: Trip) => {
  const long: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  if (t.from && t.to && t.from !== t.to) return `${prettyDate(t.from)} to ${prettyDate(t.to, long)}`;
  if (t.from || t.to) return prettyDate((t.from || t.to)!, long);
  return "No dates";
};

interface Draft {
  id?: string;
  country: string;
  from: string;
  to: string;
  note: string;
  cities: string[];
}

export default function TripsPage() {
  const trips = useLife((s) => s.trips);
  const saveTrip = useLife((s) => s.saveTrip);
  const removeTrip = useLife((s) => s.removeTrip);

  const [data, setData] = useState<MapData | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const map = useRef<DotMapHandle>(null);

  useEffect(() => {
    void import("@/data/world-dots.json").then((m) => setData(m.default as MapData));
  }, []);

  const byId = useMemo(() => new Map((data?.countries ?? []).map((c) => [c.id, c])), [data]);
  const visited = useMemo(() => new Set(trips.map((t) => t.country)), [trips]);
  const sorted = useMemo(
    () => [...trips].sort((a, b) => ((b.from ?? b.to ?? "") > (a.from ?? a.to ?? "") ? 1 : -1)),
    [trips],
  );
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = data?.countries ?? [];
    return q ? list.filter((c) => c.name.toLowerCase().includes(q)) : list;
  }, [data, query]);

  const startFor = (c: MapCountry) => {
    setPicking(false);
    setQuery("");
    setCity("");
    setDraft({ country: c.id, from: "", to: "", note: "", cities: [] });
  };
  const edit = (t: Trip) => {
    setCity("");
    setDraft({ id: t.id, country: t.country, from: t.from ?? "", to: t.to ?? "", note: t.note ?? "", cities: t.cities });
  };
  const addCity = () => {
    const name = city.trim();
    if (!name || !draft) return;
    if (!draft.cities.some((c) => c.toLowerCase() === name.toLowerCase())) setDraft({ ...draft, cities: [...draft.cities, name] });
    setCity("");
  };
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const pending = city.trim();
    const cities = pending && !draft.cities.includes(pending) ? [...draft.cities, pending] : draft.cities;
    const from = draft.from || draft.to;
    const to = draft.to || draft.from;
    saveTrip({
      id: draft.id,
      country: draft.country,
      from: from ? (from <= to ? from : to) : undefined,
      to: to ? (from <= to ? to : from) : undefined,
      note: draft.note.trim() || undefined,
      cities,
    });
    const isNew = !visited.has(draft.country);
    setDraft(null);
    // Frame the new country so you can watch it fill in.
    if (isNew) setTimeout(() => map.current?.showCountries([draft.country]), 250);
  };

  const draftCountry = draft ? byId.get(draft.country) : null;
  const total = data?.countries.length ?? 0;

  return (
    <main style={{ "--tc": "var(--color-trip)" } as React.CSSProperties}>
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-pixel text-[34px] leading-none">Trips</h1>
          <p className="mt-1.5 text-[14px] text-ash">
            {visited.size === 0 ? "Tap a country on the map, or log your first trip." : `${visited.size} of ${total} countries and territories`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="px-corners flex h-11 shrink-0 items-center gap-2 bg-trip px-4 font-pixel text-[22px] text-ink active:scale-95"
        >
          <PixelIcon name="plus" size={12} />
          Log trip
        </button>
      </header>

      <section className="relative overflow-hidden rounded-[20px] bg-coal" aria-label="Map of countries you have visited">
        <div className="h-[min(58dvh,520px)] min-h-[320px]">
          {data ? (
            <DotMap ref={map} data={data} visited={visited} selected={draft?.country ?? null} onPick={startFor} />
          ) : (
            <div className="grid h-full place-items-center text-ash">Drawing the world</div>
          )}
        </div>
        <div className="absolute left-3 top-3 flex gap-2">
          <div className="rounded-full border border-line bg-coal/90 px-3 py-1.5 font-pixel text-[21px]">
            <span className="text-trip">{visited.size}</span>
            <span className="text-ash"> / {total}</span>
          </div>
        </div>
        <div className="absolute bottom-3 left-3 flex overflow-hidden rounded-xl border border-line bg-coal/90 text-[13px]">
          <button type="button" onClick={() => map.current?.showWorld()} className="h-10 px-3 hover:bg-pit">
            Whole world
          </button>
          {visited.size > 0 && (
            <button type="button" onClick={() => map.current?.showCountries([...visited])} className="h-10 border-l border-line px-3 hover:bg-pit">
              My trips
            </button>
          )}
        </div>
      </section>

      <section className="mt-4" aria-label="Your trips">
        {sorted.length === 0 ? (
          <p className="rounded-[20px] bg-coal p-4 text-[14px] text-ash">
            Every country you log lights up dot by dot. Start with the places you have already been. Dates are optional.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {sorted.map((t) => {
              const c = byId.get(t.country);
              return (
                <li key={t.id}>
                  <button type="button" onClick={() => edit(t)} className="flex w-full items-center gap-3 rounded-[16px] bg-coal p-3 text-left hover:bg-pit">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-pit text-[22px]" aria-hidden="true">
                      {c ? flag(c.a2) || "•" : "•"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-pixel text-[23px] leading-tight">{c?.name ?? "Unknown place"}</span>
                      <span className="block truncate text-[13px] text-ash">
                        {tripDates(t)}
                        {t.cities.length ? `, ${t.cities.join(", ")}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Pick a country */}
      <Sheet open={picking} onClose={() => setPicking(false)} title="Where did you go?" color="var(--color-trip)">
        <TextInput autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search countries" aria-label="Search countries" />
        <ul className="mt-3 h-[46dvh] overflow-y-auto">
          {matches.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => startFor(c)} className="flex h-12 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-pit">
                <span className="w-7 text-center text-[20px]" aria-hidden="true">{flag(c.a2)}</span>
                <span className="flex-1 truncate">{c.name}</span>
                {visited.has(c.id) && <span className="text-[13px] text-trip">Visited</span>}
              </button>
            </li>
          ))}
          {matches.length === 0 && <li className="px-2 py-3 text-ash">No country matches &ldquo;{query}&rdquo;.</li>}
        </ul>
      </Sheet>

      {/* Log or edit a trip */}
      <Sheet
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draftCountry ? `${flag(draftCountry.a2)} ${draftCountry.name}`.trim() : "Trip"}
        color="var(--color-trip)"
      >
        {draft && (
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="from">From</Label>
                <TextInput id="from" type="date" max={todayKey()} value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="to">Until</Label>
                <TextInput id="to" type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="note">Note</Label>
              <TextInput id="note" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="Visited family" />
            </div>
            <div>
              <Label htmlFor="city">Cities visited</Label>
              {draft.cities.length > 0 && (
                <ul className="mb-2 flex flex-wrap gap-2">
                  {draft.cities.map((c) => (
                    <li key={c}>
                      <button
                        type="button"
                        onClick={() => setDraft({ ...draft, cities: draft.cities.filter((x) => x !== c) })}
                        aria-label={`Remove ${c}`}
                        className="flex h-9 items-center gap-2 rounded-full border border-trip px-3 text-[14px] text-trip"
                      >
                        {c}
                        <PixelIcon name="close" size={8} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <TextInput
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCity();
                    }
                  }}
                  placeholder="Berlin"
                />
                <button type="button" onClick={addCity} className="h-12 shrink-0 rounded-xl bg-pit px-4 font-medium hover:bg-line">
                  Add
                </button>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              {draft.id && (
                <button
                  type="button"
                  onClick={() => {
                    removeTrip(draft.id!);
                    setDraft(null);
                  }}
                  className="flex h-13 shrink-0 items-center gap-2 rounded-xl bg-pit px-4 text-bad hover:bg-line"
                >
                  <PixelIcon name="trash" size={13} />
                  Delete
                </button>
              )}
              <PrimaryButton type="submit">{draft.id ? "Save trip" : "Log trip"}</PrimaryButton>
            </div>
          </form>
        )}
      </Sheet>
    </main>
  );
}
