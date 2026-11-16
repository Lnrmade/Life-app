"use client";

import type { ReactNode } from "react";

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-[13px] font-medium text-ash">
      {children}
    </label>
  );
}

export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  format,
  label,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  format?: (v: T) => string;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const on = opt === value;
        return (
          <button
            key={String(opt)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(opt)}
            className={`h-10 rounded-full px-4 text-[15px] font-medium transition-colors ${
              on ? "bg-(--tc) text-ink" : "bg-pit text-bone hover:bg-line"
            }`}
          >
            {format ? format(opt) : opt}
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  format,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  format?: (v: number) => string;
  label: string;
}) {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, Math.round(v * 100) / 100)));
  return (
    <div className="flex items-center gap-3" role="group" aria-label={label}>
      <button type="button" aria-label={`Less ${label}`} onClick={() => set(value - step)} className="size-11 rounded-full bg-pit font-pixel text-[27px] leading-none hover:bg-line">
        −
      </button>
      <output className="min-w-[92px] text-center font-pixel text-[37px] leading-none tabular-nums">{format ? format(value) : value}</output>
      <button type="button" aria-label={`More ${label}`} onClick={() => set(value + step)} className="size-11 rounded-full bg-pit font-pixel text-[27px] leading-none hover:bg-line">
        +
      </button>
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-12 w-full rounded-xl border border-line bg-ink px-4 text-bone placeholder:text-dim focus:border-(--tc) focus:outline-none ${props.className ?? ""}`}
    />
  );
}

export function PrimaryButton({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`px-corners h-13 w-full bg-(--tc) font-pixel text-[24px] text-ink transition-transform active:scale-[0.98] disabled:opacity-40 ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function Tile({ value, label, tone }: { value: ReactNode; label: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-pit px-3 py-2.5">
      <div className="font-pixel text-[24px] leading-tight" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      <div className="mt-0.5 text-[12px] text-ash">{label}</div>
    </div>
  );
}

export function Bar({ value, color = "var(--tc)", height = 8 }: { value: number; color?: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="w-full overflow-hidden bg-pit" style={{ height }} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full transition-[width] duration-700 ease-out" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
