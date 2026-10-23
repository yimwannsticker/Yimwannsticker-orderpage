"use client";

import { useState } from "react";

/**
 * รายการที่ลากเรียงลำดับได้ (คอมพิวเตอร์) + ปุ่ม ↑↓ (มือถือ/แท็บเล็ต ลากด้วยนิ้วไม่ได้)
 * onChange ได้รายการเรียงใหม่ทั้งหมด
 */
export function Sortable<T>({
  items,
  getKey,
  onChange,
  children,
  className = "space-y-2",
  grid = false,
}: {
  items: T[];
  getKey: (item: T) => string;
  onChange: (items: T[]) => void;
  children: (item: T, index: number, handle: React.ReactNode) => React.ReactNode;
  className?: string;
  /** แสดงเป็นตาราง (รูป) ปุ่มเลื่อนเป็น ← → */
  grid?: boolean;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const xs = [...items];
    const [x] = xs.splice(from, 1);
    xs.splice(to, 0, x);
    onChange(xs);
  };
  return (
    <div className={className}>
      {items.map((item, i) => {
        const handle = (
          <span className="flex shrink-0 items-center gap-0.5 text-muted">
            <span className="hidden cursor-grab px-1 text-lg md:inline" title="ลากเพื่อเรียง" aria-hidden>
              ⋮⋮
            </span>
            <button type="button" className="rounded-lg px-1.5 py-1 hover:bg-gray-100 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="เลื่อนขึ้น">
              {grid ? "←" : "↑"}
            </button>
            <button
              type="button"
              className="rounded-lg px-1.5 py-1 hover:bg-gray-100 disabled:opacity-30"
              disabled={i === items.length - 1}
              onClick={() => move(i, i + 1)}
              aria-label="เลื่อนลง"
            >
              {grid ? "→" : "↓"}
            </button>
          </span>
        );
        return (
          <div
            key={getKey(item)}
            draggable
            onDragStart={(e) => {
              setDrag(i);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(i);
            }}
            onDragLeave={() => setOver((o) => (o === i ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              if (drag !== null) move(drag, i);
              setDrag(null);
              setOver(null);
            }}
            onDragEnd={() => {
              setDrag(null);
              setOver(null);
            }}
            className={`${drag === i ? "opacity-40" : ""} ${over === i && drag !== i ? "ring-2 ring-brand-200 rounded-2xl" : ""}`}
          >
            {children(item, i, handle)}
          </div>
        );
      })}
    </div>
  );
}
