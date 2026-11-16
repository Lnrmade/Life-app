"use client";

import { useEffect, useImperativeHandle, useRef } from "react";

export interface MapCountry {
  id: string;
  name: string;
  a2: string;
  n: number;
  /** Runs of dots: [row, firstCol, length, ...] */
  d: number[];
}

export interface MapData {
  cols: number;
  rows: number;
  countries: MapCountry[];
}

export interface DotMapHandle {
  showWorld: () => void;
  showCountries: (ids: string[]) => void;
}

interface Props {
  data: MapData;
  visited: Set<string>;
  selected?: string | null;
  onPick: (country: MapCountry) => void;
  ref?: React.Ref<DotMapHandle>;
}

const ROW_H = Math.sqrt(3) / 2;
const FILL_SPREAD = 1500; // ms over which a country's dots switch on
const POP = 320; // ms for one dot to pop
const MAX_ZOOM = 22; // px per dot spacing

const hash = (n: number) => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

interface Flat {
  x: Float32Array;
  y: Float32Array;
  owner: Uint16Array;
  /** Bounding box and centre per country, in dot units. */
  box: { x0: number; y0: number; x1: number; y1: number; cx: number; cy: number }[];
  /** Spatial index: dot ids per grid cell. */
  byCell: Map<number, number>;
}

function flatten(data: MapData): Flat {
  const total = data.countries.reduce((s, c) => s + c.n, 0);
  const x = new Float32Array(total), y = new Float32Array(total), owner = new Uint16Array(total);
  const box: Flat["box"] = [];
  const byCell = new Map<number, number>();
  let i = 0;
  data.countries.forEach((c, ci) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let k = 0; k < c.d.length; k += 3) {
      const row = c.d[k];
      for (let col = c.d[k + 1]; col < c.d[k + 1] + c.d[k + 2]; col++) {
        const px = col + (row % 2 ? 0.5 : 0), py = row * ROW_H;
        x[i] = px; y[i] = py; owner[i] = ci;
        byCell.set(row * data.cols + col, i);
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
        i++;
      }
    }
    // Frame the mainland: ignore the far-flung 8% on each side (French Guiana, Alaska, ...).
    const xs = Array.from(x.subarray(i - c.n, i)).sort((a, b) => a - b);
    const ys = Array.from(y.subarray(i - c.n, i)).sort((a, b) => a - b);
    const lo = Math.floor(c.n * 0.08), hi = Math.ceil(c.n * 0.92) - 1;
    if (c.n >= 12) { x0 = xs[lo]; x1 = xs[hi]; y0 = ys[lo]; y1 = ys[hi]; }
    box.push({ x0, y0, x1, y1, cx: xs[c.n >> 1], cy: ys[c.n >> 1] });
  });
  return { x, y, owner, box, byCell };
}

export function DotMap({ data, visited, selected, onPick, ref }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const flat = useRef<Flat | null>(null);
  const view = useRef({ k: 1, tx: 0, ty: 0, w: 0, h: 0, minK: 1 });
  const target = useRef<{ k: number; tx: number; ty: number } | null>(null);
  const fillStart = useRef(new Map<number, number>());
  const state = useRef({ visited, selected, onPick });
  const request = useRef<() => void>(() => {});
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    state.current = { visited, selected, onPick };
  });

  const fitBox = (x0: number, y0: number, x1: number, y1: number, pad: number) => {
    const v = view.current;
    const k = Math.max(v.minK, Math.min(MAX_ZOOM, Math.min((v.w - pad * 2) / Math.max(1, x1 - x0), (v.h - pad * 2) / Math.max(1, y1 - y0))));
    return { k, tx: v.w / 2 - ((x0 + x1) / 2) * k, ty: v.h / 2 - ((y0 + y1) / 2) * k };
  };

  const boxOf = (ids: string[]) => {
    const f = flat.current;
    if (!f) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    data.countries.forEach((c, i) => {
      if (!ids.includes(c.id)) return;
      const b = f.box[i];
      // Countries that straddle the date line would stretch the frame across the whole map.
      if (b.x1 - b.x0 > data.cols * 0.6) return;
      x0 = Math.min(x0, b.x0); y0 = Math.min(y0, b.y0); x1 = Math.max(x1, b.x1); y1 = Math.max(y1, b.y1);
    });
    return Number.isFinite(x0) ? { x0, y0, x1, y1 } : null;
  };

  useImperativeHandle(ref, () => ({
    showWorld: () => {
      target.current = fitBox(0, 0, data.cols, data.rows * ROW_H, 8);
      request.current();
    },
    showCountries: (ids) => {
      const b = boxOf(ids);
      if (!b) return;
      const fit = fitBox(b.x0, b.y0, b.x1, b.y1, 56);
      // Stay far enough out to see the neighbours.
      const k = Math.min(fit.k, 13);
      const v = view.current;
      target.current = { k, tx: v.w / 2 - ((b.x0 + b.x1) / 2) * k, ty: v.h / 2 - ((b.y0 + b.y1) / 2) * k };
      request.current();
    },
  }));

  // New countries start filling the moment they are added.
  useEffect(() => {
    const now = performance.now();
    const first = known.current === null;
    let order = 0;
    data.countries.forEach((c, i) => {
      if (!visited.has(c.id)) fillStart.current.delete(i);
      else if (!fillStart.current.has(i)) fillStart.current.set(i, now + (first ? 350 + order++ * 140 : 0));
    });
    known.current = new Set(visited);
    request.current();
  }, [visited, data]);

  useEffect(() => {
    request.current();
  }, [selected]);

  useEffect(() => {
    const el = canvas.current, box = wrap.current;
    if (!el || !box) return;
    const ctx = el.getContext("2d")!;
    const f = (flat.current = flatten(data));
    const worldW = data.cols, worldH = data.rows * ROW_H;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let first = true;

    const clamp = () => {
      const v = view.current;
      v.k = Math.max(v.minK, Math.min(MAX_ZOOM, v.k));
      const w = worldW * v.k, h = worldH * v.k;
      v.tx = w <= v.w ? (v.w - w) / 2 : Math.min(0, Math.max(v.w - w, v.tx));
      v.ty = h <= v.h ? (v.h - h) / 2 : Math.min(0, Math.max(v.h - h, v.ty));
    };

    const draw = (now: number) => {
      raf = 0;
      const v = view.current;
      let again = false;

      if (target.current) {
        const t = target.current;
        const ease = reduce ? 1 : 0.16;
        v.k += (t.k - v.k) * ease; v.tx += (t.tx - v.tx) * ease; v.ty += (t.ty - v.ty) * ease;
        if (Math.abs(t.k - v.k) < 0.002 && Math.abs(t.tx - v.tx) < 0.5 && Math.abs(t.ty - v.ty) < 0.5) {
          v.k = t.k; v.tx = t.tx; v.ty = t.ty;
          target.current = null;
        } else again = true;
        clamp();
      }

      const dpr = Math.min(2, window.devicePixelRatio || 1);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, v.w, v.h);

      const { selected: sel } = state.current;
      const r = Math.max(0.55, v.k * 0.34);
      const square = r < 1.6;
      const selIndex = sel ? data.countries.findIndex((c) => c.id === sel) : -1;
      const margin = r * 2;

      // Three passes so each colour is one path.
      const passes: { color: string; test: (o: number) => boolean }[] = [
        { color: "#2b2b31", test: (o) => o !== selIndex && !fillStart.current.has(o) },
        { color: "#6b6b76", test: (o) => o === selIndex && !fillStart.current.has(o) },
      ];
      for (const pass of passes) {
        ctx.fillStyle = pass.color;
        ctx.beginPath();
        for (let i = 0; i < f.x.length; i++) {
          if (!pass.test(f.owner[i])) continue;
          const px = f.x[i] * v.k + v.tx, py = f.y[i] * v.k + v.ty;
          if (px < -margin || py < -margin || px > v.w + margin || py > v.h + margin) continue;
          if (square) ctx.rect(px - r, py - r, r * 2, r * 2);
          else { ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, Math.PI * 2); }
        }
        ctx.fill();
      }

      // Visited dots, each on its own little delay.
      for (let i = 0; i < f.x.length; i++) {
        const start = fillStart.current.get(f.owner[i]);
        if (start === undefined) continue;
        const px = f.x[i] * v.k + v.tx, py = f.y[i] * v.k + v.ty;
        if (px < -margin || py < -margin || px > v.w + margin || py > v.h + margin) continue;
        const age = reduce ? Infinity : now - start - hash(i) * FILL_SPREAD;
        let scale = 1;
        if (age < 0) {
          again = true;
          ctx.fillStyle = "#2b2b31";
        } else if (age < POP) {
          again = true;
          const p = age / POP;
          scale = p < 0.6 ? 0.4 + (p / 0.6) * 1.1 : 1.5 - ((p - 0.6) / 0.4) * 0.5;
          ctx.fillStyle = p < 0.5 ? "#ffd9a8" : "#ff6a2b";
        } else {
          ctx.fillStyle = f.owner[i] === selIndex ? "#ff9a66" : "#ff6a2b";
        }
        const rr = r * scale;
        if (square && scale === 1) ctx.fillRect(px - rr, py - rr, rr * 2, rr * 2);
        else { ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI * 2); ctx.fill(); }
      }

      // Names of visited countries once you are close enough to read them.
      if (v.k >= 5.5) {
        ctx.font = "600 12px 'Instrument Sans Variable', system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        for (const [ci, start] of fillStart.current) {
          if (now - start < FILL_SPREAD * 0.6 && !reduce) continue;
          const b = f.box[ci];
          const px = b.cx * v.k + v.tx, py = b.cy * v.k + v.ty;
          if (px < 0 || py < 0 || px > v.w || py > v.h) continue;
          const name = data.countries[ci].name;
          ctx.lineWidth = 4;
          ctx.strokeStyle = "rgb(12 12 14 / 0.85)";
          ctx.strokeText(name, px, py);
          ctx.fillStyle = "#f3efe4";
          ctx.fillText(name, px, py);
        }
      }

      if (again) request.current();
    };

    request.current = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };

    const resize = () => {
      const v = view.current;
      const rect = box.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const centre = { x: (v.w / 2 - v.tx) / v.k, y: (v.h / 2 - v.ty) / v.k };
      v.w = rect.width; v.h = rect.height;
      el.width = Math.round(v.w * dpr); el.height = Math.round(v.h * dpr);
      v.minK = Math.min(v.w / worldW, v.h / worldH);
      if (first) {
        first = false;
        const b = boxOf([...state.current.visited]);
        Object.assign(v, b ? fitBox(b.x0, b.y0, b.x1, b.y1, 48) : fitBox(0, 0, worldW, worldH, 8));
      } else {
        v.tx = v.w / 2 - centre.x * v.k; v.ty = v.h / 2 - centre.y * v.k;
      }
      clamp();
      request.current();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(box);

    /* ---- pan, pinch, wheel, tap ---- */
    const pointers = new Map<number, { x: number; y: number }>();
    let moved = 0;
    let pinch = 0;

    const local = (e: { clientX: number; clientY: number }) => {
      const rect = el.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const zoomAt = (x: number, y: number, factor: number) => {
      const v = view.current;
      const k = Math.max(v.minK, Math.min(MAX_ZOOM, v.k * factor));
      v.tx = x - ((x - v.tx) / v.k) * k; v.ty = y - ((y - v.ty) / v.k) * k; v.k = k;
      clamp();
      request.current();
    };

    const down = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, local(e));
      target.current = null;
      if (pointers.size === 1) moved = 0;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };
    const move = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const p = local(e);
      pointers.set(e.pointerId, p);
      const v = view.current;
      if (pointers.size === 1) {
        v.tx += p.x - prev.x; v.ty += p.y - prev.y;
        moved += Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y);
        clamp();
        request.current();
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, dist / pinch);
        pinch = dist;
        moved += 10;
      }
    };
    const up = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      pointers.delete(e.pointerId);
      if (!p || pointers.size > 0 || moved > 8) return;
      // A tap: find the dot under the finger, or the nearest one within reach.
      const v = view.current;
      const wx = (p.x - v.tx) / v.k, wy = (p.y - v.ty) / v.k;
      const row0 = Math.round(wy / ROW_H);
      const reach = Math.max(1, Math.ceil(14 / v.k));
      let best = -1, bestD = Infinity;
      for (let row = row0 - reach; row <= row0 + reach; row++) {
        const col0 = Math.round(wx - (row % 2 ? 0.5 : 0));
        for (let col = col0 - reach; col <= col0 + reach; col++) {
          const i = f.byCell.get(row * data.cols + col);
          if (i === undefined) continue;
          const d = Math.hypot(f.x[i] - wx, f.y[i] - wy);
          if (d < bestD) { bestD = d; best = i; }
        }
      }
      if (best >= 0 && bestD * v.k <= 18) state.current.onPick(data.countries[f.owner[best]]);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      target.current = null;
      const p = local(e);
      zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0022));
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
      raf = 0;
      request.current = () => {};
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    };
    // The map is built once per data set; everything else is read from refs.
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const nudge = (factor: number) => {
    const v = view.current;
    const k = Math.max(v.minK, Math.min(MAX_ZOOM, v.k * factor));
    target.current = { k, tx: v.w / 2 - ((v.w / 2 - v.tx) / v.k) * k, ty: v.h / 2 - ((v.h / 2 - v.ty) / v.k) * k };
    request.current();
  };

  return (
    <div ref={wrap} className="relative h-full w-full overflow-hidden">
      <canvas
        ref={canvas}
        role="img"
        aria-label={`World map. ${visited.size} countries visited are lit up.`}
        className="block h-full w-full touch-none cursor-grab active:cursor-grabbing"
        style={{ width: "100%", height: "100%" }}
      />
      <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-xl border border-line bg-coal/90">
        <button type="button" aria-label="Zoom in" onClick={() => nudge(1.7)} className="size-10 font-pixel text-[24px] leading-none hover:bg-pit">
          +
        </button>
        <button type="button" aria-label="Zoom out" onClick={() => nudge(1 / 1.7)} className="size-10 border-t border-line font-pixel text-[24px] leading-none hover:bg-pit">
          −
        </button>
      </div>
    </div>
  );
}
