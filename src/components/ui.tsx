"use client";

import { useState, type ReactNode } from "react";
import type { CheckResult } from "@/lib/types";

export function CheckBadge({ level, title }: { level: CheckResult["level"]; title: string }) {
  const styles = {
    green: "bg-ok-bg text-ok",
    yellow: "bg-warn-bg text-warn",
    red: "bg-bad-bg text-bad",
  }[level];
  const dot = { green: "bg-ok", yellow: "bg-yellow-500", red: "bg-bad" }[level];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${styles}`}>
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {title}
    </span>
  );
}

export function CheckDetails({ check, defaultOpen = true }: { check: CheckResult; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!check.issues.length) {
    return <p className="mt-2 text-sm text-muted">ไฟล์ผ่านการตรวจ ความละเอียดและรายละเอียดพร้อมพิมพ์</p>;
  }
  return (
    <div className="mt-2">
      {!defaultOpen && (
        <button type="button" onClick={() => setOpen(!open)} className="text-sm font-medium text-brand-600 underline">
          {open ? "ซ่อนรายละเอียด" : `ดูรายละเอียด (${check.issues.length})`}
        </button>
      )}
      {open && (
        <ul className="mt-1 space-y-1.5">
          {check.issues.map((i, idx) => (
            <li key={idx} className="flex gap-2 text-sm leading-relaxed">
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  i.level === "red" ? "bg-bad" : i.level === "yellow" ? "bg-yellow-500" : "bg-ok"
                }`}
              />
              <span>{i.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-start gap-1" aria-label="ขั้นตอนการสั่ง">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex flex-1 flex-col items-center gap-1.5 text-center">
            <div className="flex w-full items-center">
              <div className={`h-1 flex-1 rounded-full ${i === 0 ? "opacity-0" : done || active ? "bg-brand-500" : "bg-line"}`} />
              <span
                aria-current={active ? "step" : undefined}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  done ? "bg-brand-500 text-white" : active ? "bg-brand-500 text-white ring-4 ring-brand-100" : "bg-white text-muted ring-1 ring-line"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <div className={`h-1 flex-1 rounded-full ${i === steps.length - 1 ? "opacity-0" : done ? "bg-brand-500" : "bg-line"}`} />
            </div>
            <span className={`text-xs leading-tight ${active ? "font-semibold text-ink" : "text-muted"}`}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 100000,
  step = 1,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.floor(v)));
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`ลด${label}`}
        className="btn-secondary h-12 w-12 shrink-0 !px-0 text-2xl"
        onClick={() => onChange(clamp(value - step))}
        disabled={value <= min}
      >
        −
      </button>
      <input
        aria-label={label}
        inputMode="numeric"
        className="input w-20 text-center text-lg font-semibold"
        value={text ?? String(value)}
        onFocus={(e) => {
          setText(String(value));
          e.target.select();
        }}
        onChange={(e) => {
          const t = e.target.value.replace(/\D/g, "");
          setText(t);
          if (t) onChange(Math.min(max, Number(t)));
        }}
        onBlur={() => {
          const n = Number(text || 0);
          onChange(clamp(Number.isFinite(n) ? n : min));
          setText(null);
        }}
      />
      <button
        type="button"
        aria-label={`เพิ่ม${label}`}
        className="btn-secondary h-12 w-12 shrink-0 !px-0 text-2xl"
        onClick={() => onChange(clamp(value + step))}
        disabled={value >= max}
      >
        +
      </button>
    </div>
  );
}

export function CopyButton({ text, label = "คัดลอก", className = "" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`btn-secondary btn-sm ${className}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? "คัดลอกแล้ว ✓" : label}
    </button>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "warn" | "bad" | "ok"; children: ReactNode }) {
  const s = {
    info: "bg-brand-50 text-brand-700",
    warn: "bg-warn-bg text-warn",
    bad: "bg-bad-bg text-bad",
    ok: "bg-ok-bg text-ok",
  }[tone];
  return <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${s}`}>{children}</div>;
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function FileIcon({ ext }: { ext: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gray-100 text-sm font-bold uppercase text-muted">
      .{ext}
    </div>
  );
}
