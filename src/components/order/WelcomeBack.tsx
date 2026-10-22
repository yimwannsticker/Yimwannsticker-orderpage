"use client";

import { useState } from "react";
import { pickMessage } from "@/lib/greeting";
import { toNextFree } from "@/lib/pricing";
import type { PublicSettings } from "@/lib/types";
import { FileIcon } from "../ui";
import type { PastFile } from "./PastFilesPicker";

export interface Me {
  name: string;
  phone: string;
  points: number;
  pending: number;
  /** รูปโปรไฟล์ LINE (ถ้าเข้าด้วย LINE) */
  picture?: string | null;
}

const maskPhone = (p: string) => (p.length === 10 ? `${p.slice(0, 3)}-xxx-${p.slice(6)}` : p);

const SHOW_FILES = 4;

export function WelcomeBack({
  me,
  promo,
  messages,
  files,
  inCart,
  onAdd,
  onShowAll,
  onLogout,
}: {
  me: Me;
  promo: PublicSettings["promo"];
  /** ข้อความทักทายแบบสุ่มจากหลังบ้าน */
  messages: string[];
  /** null = กำลังโหลด */
  files: PastFile[] | null;
  inCart: Set<string>;
  onAdd: (f: PastFile) => void;
  onShowAll: () => void;
  onLogout: () => void;
}) {
  const [greeting] = useState(() => pickMessage(messages, me.name));
  const total = me.points + me.pending;
  const need = toNextFree(promo, total);

  return (
    <div className="card space-y-3 border-brand-200 bg-gradient-to-br from-brand-50 to-white">
      <div className="flex items-start gap-3">
        {me.picture && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={me.picture} alt="" className="h-12 w-12 shrink-0 rounded-full ring-2 ring-white" />
        )}
        <div className="min-w-0">
          {greeting && <p className="text-lg font-bold">{greeting}</p>}
          <p className="mt-1 text-sm">
            ยอดสะสม <b>{me.points}</b> แผ่น
            {me.pending > 0 && <span className="text-muted"> (+{me.pending} รอตรวจสลิป)</span>}
            {promo.enabled && need > 0 && (
              <>
                {" "}
                · อีก <b className="text-brand-600">{need}</b> แผ่น รับแถม {promo.free} แผ่น 🎁
              </>
            )}
          </p>
        </div>
      </div>

      {files === null ? (
        <p className="text-sm text-muted">กำลังโหลดไฟล์ที่เคยสั่ง...</p>
      ) : files.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-semibold">สั่งซ้ำไฟล์เดิม แตะเพื่อใส่ในออเดอร์</p>
          <div className="grid grid-cols-4 gap-2">
            {files.slice(0, SHOW_FILES).map((f) => {
              const added = inCart.has(f.itemId);
              return (
                <button
                  key={f.itemId}
                  type="button"
                  disabled={added}
                  onClick={() => onAdd(f)}
                  aria-label={added ? `${f.fileName} อยู่ในออเดอร์แล้ว` : `ใส่ ${f.fileName} ในออเดอร์`}
                  className={`relative overflow-hidden rounded-xl border-2 bg-white ${added ? "border-brand-500" : "border-line"}`}
                >
                  <span className="block aspect-square w-full bg-gray-50">
                    {f.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.previewUrl} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <FileIcon ext={f.fileType} />
                    )}
                  </span>
                  <span
                    className={`absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      added ? "bg-brand-500 text-white" : "bg-white/90 text-brand-600 ring-1 ring-line"
                    }`}
                    aria-hidden
                  >
                    {added ? "✓" : "+"}
                  </span>
                  <span className="block truncate px-1 py-1 text-[11px]">{f.fileName}</span>
                </button>
              );
            })}
          </div>
          {files.length > SHOW_FILES && (
            <button type="button" className="mt-2 text-sm font-medium text-brand-600 underline" onClick={onShowAll}>
              ดูไฟล์ที่เคยสั่งทั้งหมด ({files.length})
            </button>
          )}
        </div>
      ) : null}

      <p className="text-xs text-muted">
        {maskPhone(me.phone)} ·{" "}
        <button type="button" className="underline" onClick={onLogout}>
          ไม่ใช่คุณ? ออกจากระบบ
        </button>
      </p>
    </div>
  );
}
