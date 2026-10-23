"use client";

import { useState } from "react";

/** ปุ่ม -/+ ขนาดเล็กสำหรับแถวลาย */
export function MiniStepper({
  value,
  onChange,
  label,
  min = 0,
  max = 9999,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const [text, setText] = useState<string | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.floor(v) || 0));
  return (
    <div className={`flex shrink-0 items-center overflow-hidden rounded-xl ring-1 ring-line ${disabled ? "opacity-40" : ""}`}>
      <button
        type="button"
        aria-label={`ลด ${label}`}
        className="h-9 w-9 text-xl text-muted active:bg-gray-100 disabled:opacity-30"
        disabled={disabled || value <= min}
        onClick={() => onChange(clamp(value - 1))}
      >
        −
      </button>
      <input
        aria-label={label}
        inputMode="numeric"
        disabled={disabled}
        className={`h-9 w-11 border-x border-line text-center text-sm font-semibold outline-none ${value > 0 ? "text-brand-600" : ""}`}
        value={text ?? String(value)}
        onFocus={(e) => {
          setText(String(value));
          e.target.select();
        }}
        onChange={(e) => {
          const t = e.target.value.replace(/\D/g, "").slice(0, 4);
          setText(t);
          onChange(clamp(Number(t || 0)));
        }}
        onBlur={() => setText(null)}
      />
      <button
        type="button"
        aria-label={`เพิ่ม ${label}`}
        className="h-9 w-9 text-xl text-brand-600 active:bg-brand-50 disabled:opacity-30"
        disabled={disabled || value >= max}
        onClick={() => onChange(clamp(value + 1))}
      >
        +
      </button>
    </div>
  );
}
