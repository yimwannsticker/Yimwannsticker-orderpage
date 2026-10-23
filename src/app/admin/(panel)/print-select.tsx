"use client";

import { useEffect, useState } from "react";

/** แถบพิมพ์ใบรายการสินค้าของออเดอร์ที่ติ๊กเลือก (checkbox อยู่ในรายการ ผูกกับฟอร์มนี้ด้วย form="print-orders") */
export function PrintSelected() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const count = () => setN(document.querySelectorAll('input[form="print-orders"]:checked').length);
    document.addEventListener("change", count);
    return () => document.removeEventListener("change", count);
  }, []);
  const toggleAll = (on: boolean) => {
    document.querySelectorAll<HTMLInputElement>('input[form="print-orders"]').forEach((el) => (el.checked = on));
    setN(on ? document.querySelectorAll('input[form="print-orders"]').length : 0);
  };
  return (
    <form id="print-orders" action="/admin/print" target="_blank" className="flex flex-wrap items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-line">
      <label className="flex items-center gap-2">
        <input type="checkbox" className="h-4 w-4 accent-brand-500" onChange={(e) => toggleAll(e.target.checked)} aria-label="เลือกทุกออเดอร์ในหน้านี้" />
        เลือกทั้งหมด
      </label>
      <span className="text-muted">เลือกแล้ว {n} ออเดอร์</span>
      <button className="btn-secondary btn-sm ml-auto" disabled={!n}>
        🖨️ พิมพ์ใบรายการสินค้า ({n})
      </button>
    </form>
  );
}
