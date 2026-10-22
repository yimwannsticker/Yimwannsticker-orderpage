"use client";

import { useEffect, useState } from "react";
import { renderTrimmed } from "@/lib/client/trim";
import type { Trim } from "@/lib/types";

/** พื้นตารางหมากรุก ให้เห็นส่วนที่โปร่งใส */
export const CHECKER: React.CSSProperties = {
  backgroundImage: "conic-gradient(#e5e7eb 25%, #fff 0 50%, #e5e7eb 0 75%, #fff 0)",
  backgroundSize: "20px 20px",
};

/** รูปหลังตัดพื้นหลัง (null ระหว่างประมวลผล หรือถ้าทำไม่ได้) */
export function useTrimmed(url: string | null, trim: Trim | null | undefined) {
  const key = url && trim ? `${url}|${trim.x},${trim.y},${trim.w},${trim.h},${trim.color}` : null;
  const [out, setOut] = useState<{ key: string; src: string | null } | null>(null);
  useEffect(() => {
    if (!key || !url || !trim) return;
    let alive = true;
    renderTrimmed(url, trim)
      .then((src) => alive && setOut({ key, src }))
      .catch(() => alive && setOut({ key, src: null }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return out?.key === key ? out.src : null;
}

const ZOOMS = [1, 2, 4];

/** ดูไฟล์เต็มจอ ซูมได้ และเทียบก่อน/หลังตัดพื้นหลัง */
export function ArtworkViewer({
  url,
  fileName,
  trim,
  onClose,
}: {
  url: string;
  fileName: string;
  trim?: Trim | null;
  onClose: () => void;
}) {
  const trimmed = useTrimmed(url, trim);
  const [view, setView] = useState<"after" | "before">(trim ? "after" : "before");
  const [zoom, setZoom] = useState(1);
  const [ratio, setRatio] = useState<{ src: string; r: number } | null>(null);
  const showAfter = Boolean(trim) && view === "after";
  const src = showAfter ? trimmed : url;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const fit = zoom === 1;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-white" role="dialog" aria-modal="true" aria-label={`ดูไฟล์ ${fileName}`}>
      <div className="flex items-center gap-2 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="min-w-0 flex-1 truncate text-sm">{fileName}</p>
        <button type="button" onClick={onClose} className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">
          ปิด ✕
        </button>
      </div>
      {trim && (
        <div className="mx-4 mb-2 grid grid-cols-2 gap-1 rounded-full bg-white/10 p-1 text-sm" role="tablist">
          {(
            [
              ["after", "หลังตัดพื้นหลัง"],
              ["before", "ไฟล์ต้นฉบับ"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={view === k}
              onClick={() => setView(k)}
              className={`rounded-full py-2 font-semibold ${view === k ? "bg-white text-ink" : "text-white/80"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className={`flex-1 overflow-auto p-4 ${fit ? "flex items-center justify-center" : ""}`}>
        {src ? (
          <div className="relative inline-block overflow-hidden" style={CHECKER}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={fileName}
              className="block h-auto"
              onLoad={(e) => setRatio({ src, r: e.currentTarget.naturalWidth / e.currentTarget.naturalHeight })}
              style={{
                maxWidth: "none",
                // ขยายรูปเล็กให้เต็มจอ (รูปตัวอย่างหลังตัดอาจมีขนาดเล็ก)
                width: `calc(${zoom} * min(100vw - 2rem, (100dvh - 13rem) * ${ratio?.src === src ? ratio.r : 1}))`,
              }}
            />
            {trim && !showAfter && (
              <div
                className="pointer-events-none absolute border-2 border-dashed border-brand-500 shadow-[0_0_0_9999px_rgba(224,69,123,0.25)]"
                style={{ left: `${trim.x * 100}%`, top: `${trim.y * 100}%`, width: `${trim.w * 100}%`, height: `${trim.h * 100}%` }}
              />
            )}
          </div>
        ) : (
          <p className="m-auto text-sm text-white/70">กำลังเตรียมรูป...</p>
        )}
      </div>

      <div className="space-y-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        {trim && (
          <p className="text-center text-xs text-white/70">
            {showAfter
              ? "ตารางหมากรุก = ส่วนที่ตัดออก ไม่ถูกพิมพ์ ถ้าตัดงานหายไป ให้ปิดแล้วเอาติ๊ก \"ตัดพื้นหลัง\" ออก"
              : "กรอบเส้นประ = ส่วนงานที่จะใช้ · ส่วนสีชมพูด้านนอกจะถูกตัดออก"}
          </p>
        )}
        <div className="flex justify-center gap-2">
          {ZOOMS.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZoom(z)}
              aria-pressed={zoom === z}
              className={`min-w-16 rounded-full px-4 py-2 text-sm font-semibold ${zoom === z ? "bg-white text-ink" : "bg-white/15"}`}
            >
              {z === 1 ? "พอดีจอ" : `${z}×`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
