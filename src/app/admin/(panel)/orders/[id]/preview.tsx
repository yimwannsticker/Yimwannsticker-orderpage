"use client";

import { useState } from "react";
import { ArtworkViewer } from "@/components/order/ArtworkViewer";
import type { Trim } from "@/lib/types";

/** รูปตัวอย่างในหลังบ้าน: แตะเพื่อดูเต็มจอ ถ้าลูกค้าเลือกตัดพื้นหลัง แสดงกรอบส่วนงานไว้ */
export function AdminPreview({ url, fileName, trim }: { url: string | null; fileName: string; trim: Trim | null }) {
  const [open, setOpen] = useState(false);
  if (!url)
    return (
      <span className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-xs text-muted">ไม่มีตัวอย่าง</span>
    );
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`ดู ${fileName} แบบเต็มจอ`}
        className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-50"
      >
        <span className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="block max-h-28 max-w-28" />
          {trim && (
            <span
              className="absolute border-2 border-dashed border-brand-500"
              style={{ left: `${trim.x * 100}%`, top: `${trim.y * 100}%`, width: `${trim.w * 100}%`, height: `${trim.h * 100}%` }}
            />
          )}
        </span>
      </button>
      {open && <ArtworkViewer url={url} fileName={fileName} trim={trim} onClose={() => setOpen(false)} />}
    </>
  );
}
