"use client";

import { useEffect, useRef } from "react";
import type { Look } from "@/lib/game";
import { SPRITE_H, SPRITE_W, drawCharacter, whiteOut } from "@/lib/sprite";
import type { EffectKind } from "@/lib/sprite";

interface Props {
  look: Look;
  /** A one-off reaction; `at` is Date.now() of when it was triggered. */
  effect?: { kind: EffectKind; at: number } | null;
  /** Rendered width in CSS pixels. Height follows the sprite ratio. */
  width?: number;
  still?: boolean;
  className?: string;
  label?: string;
}

const FRAME_MS = 1000 / 12; // choppy on purpose: it is pixel art
const EVOLVE_MS = 1300;

export function Character({ look, effect, width = 256, still = false, className, label }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ look, effect });
  const previous = useRef<Look>(look);
  const evolveFrom = useRef<{ look: Look; at: number } | null>(null);

  // When his body or outfit changes, flicker between the old and new look.
  useEffect(() => {
    const prev = previous.current;
    if (prev.stage !== look.stage || prev.tier !== look.tier) {
      evolveFrom.current = { look: prev, at: performance.now() };
    }
    previous.current = look;
    latest.current = { look, effect };
  }, [look, effect]);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const reduce = still || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const started = performance.now();
    let raf = 0;
    let lastPaint = -Infinity;

    const paint = (now: number) => {
      const { look: current, effect: fx } = latest.current;
      const age = fx ? Date.now() - fx.at : Infinity;
      const evolving = evolveFrom.current && now - evolveFrom.current.at < EVOLVE_MS ? evolveFrom.current : null;

      if (evolving && !reduce) {
        const step = Math.floor((now - evolving.at) / 110);
        drawCharacter(ctx, step % 2 === 0 ? evolving.look : current, { t: now - started });
        if (step % 4 < 2) whiteOut(ctx);
        return;
      }
      drawCharacter(ctx, current, {
        t: now - started,
        still: reduce,
        effect: fx && age < 2400 ? { kind: fx.kind, age } : null,
      });
    };

    if (reduce) {
      paint(performance.now());
      return;
    }
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - lastPaint < FRAME_MS) return;
      lastPaint = now;
      paint(now);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // Still previews repaint when the look changes; the animated loop reads refs.
  }, [still, still ? look : null]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvas}
      width={SPRITE_W}
      height={SPRITE_H}
      role="img"
      aria-label={label ?? "Your character"}
      className={`pixelated ${className ?? ""}`}
      style={{ width, height: (width * SPRITE_H) / SPRITE_W }}
    />
  );
}
