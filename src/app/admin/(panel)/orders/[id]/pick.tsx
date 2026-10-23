"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui";
import { setAllPicked, setPicked } from "../../../shop-actions";

export interface PickItem {
  id: string;
  sku: string;
  productName: string;
  designName: string;
  sizeName: string | null;
  qty: number;
  thumbUrl: string | null;
  picked: boolean;
}

/** รายการ A5 เรียงตาม SKU + ติ๊กหยิบของตอนแพ็ก */
export function PickList({ orderId, items: initial }: { orderId: string; items: PickItem[] }) {
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const done = items.filter((i) => i.picked).length;
  const all = done === items.length;
  const sheets = items.reduce((a, i) => a + i.qty, 0);

  const toggle = (id: string, picked: boolean) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, picked } : x)));
    start(async () => {
      const r = await setPicked(id, picked);
      if (!r.ok) {
        setError(r.error);
        setItems((xs) => xs.map((x) => (x.id === id ? { ...x, picked: !picked } : x)));
      }
    });
  };

  return (
    <div className="space-y-2">
      <div className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold ${all ? "bg-ok-bg text-ok" : "bg-warn-bg text-warn"}`}>
        <span>{all ? "✅ หยิบครบแล้ว" : `หยิบแล้ว ${done}/${items.length} รายการ`}</span>
        <button
          type="button"
          className="text-xs font-medium underline"
          onClick={() => {
            const v = !all;
            setItems((xs) => xs.map((x) => ({ ...x, picked: v })));
            start(async () => {
              const r = await setAllPicked(orderId, v);
              if (!r.ok) setError(r.error);
            });
          }}
        >
          {all ? "ล้างติ๊กทั้งหมด" : "ติ๊กครบทั้งหมด"}
        </button>
      </div>
      {error && <Alert tone="bad">{error}</Alert>}
      <div className="divide-y divide-line">
        {items.map((i) => (
          <label key={i.id} className={`flex cursor-pointer items-center gap-3 py-2 ${i.picked ? "opacity-50" : ""}`}>
            <input type="checkbox" className="h-6 w-6 shrink-0 accent-ok" checked={i.picked} onChange={(e) => toggle(i.id, e.target.checked)} />
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-50 ring-1 ring-line">
              {i.thumbUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.thumbUrl} alt="" className="h-full w-full object-contain" />
              )}
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p className={`font-mono font-bold ${i.picked ? "line-through" : ""}`}>{i.sku}</p>
              <p className="truncate text-muted">
                {i.productName} · {i.designName}
                {i.sizeName && ` · ${i.sizeName}`}
              </p>
            </div>
            <span className="shrink-0 text-xl font-bold">×{i.qty}</span>
          </label>
        ))}
      </div>
      <p className="text-right text-sm text-muted">รวม A5 {sheets} แผ่น</p>
    </div>
  );
}
