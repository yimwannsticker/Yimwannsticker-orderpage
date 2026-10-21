"use client";

import { useState } from "react";
import { productLabel, shapeLabel } from "@/lib/constants";
import { sizeText } from "@/lib/sticker-size";
import { thaiDate } from "@/lib/format";
import type { DraftItem } from "@/lib/types";
import { Alert, FileIcon, Spinner } from "../ui";

export interface PastFile {
  grant: string;
  itemId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  previewUrl: string | null;
  check: DraftItem["check"];
  product: NonNullable<DraftItem["product"]>;
  finish: DraftItem["finish"];
  qty: number;
  shape: DraftItem["shape"];
  widthMm: number | null;
  heightMm: number | null;
  orderNo: string;
  date: string;
  times: number;
  prevApproved: boolean;
  prevFixed: boolean;
}

/** เลือกไฟล์จากที่เคยสั่ง: ยืนยันชื่อผู้รับ + เบอร์โทร แล้วติ๊กเลือกจากรูปตัวอย่าง */
export function PastFilesPicker({
  initialName,
  initialPhone,
  inCart,
  onAdd,
  onClose,
}: {
  initialName: string;
  initialPhone: string;
  /** itemId ที่อยู่ในตะกร้าแล้ว */
  inCart: Set<string>;
  onAdd: (files: PastFile[], customer: { name: string; phone: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ customer: { name: string; phone: string }; files: PastFile[] } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/my-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const json = await res.json();
      if (!res.ok) return setError(json.error);
      setData(json);
    } catch {
      setError("อินเทอร์เน็ตขัดข้อง กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const q = query.trim().toLowerCase();
  const files = (data?.files ?? []).filter((f) => !q || f.fileName.toLowerCase().includes(q) || f.orderNo.toLowerCase().includes(q));

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[#f7f7fa]" role="dialog" aria-modal="true" aria-label="เลือกจากไฟล์ที่เคยสั่ง">
      <div className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <h2 className="text-lg font-bold">เลือกจากไฟล์ที่เคยสั่ง</h2>
          <button type="button" className="btn-ghost btn-sm" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl space-y-3 px-4 py-4">
          {!data ? (
            <form onSubmit={lookup} className="card space-y-4">
              <p className="text-sm text-muted">กรอกชื่อผู้รับและเบอร์โทรที่ใช้ตอนสั่งครั้งก่อน ระบบจะแสดงไฟล์ทั้งหมดที่เคยสั่งไว้ให้เลือก</p>
              <div>
                <label className="label" htmlFor="pf-name">
                  ชื่อผู้รับ
                </label>
                <input id="pf-name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                <p className="mt-1 text-xs text-muted">ใส่ชื่อเต็มหรือแค่ชื่อหน้าก็ได้</p>
              </div>
              <div>
                <label className="label" htmlFor="pf-phone">
                  เบอร์โทร
                </label>
                <input id="pf-phone" className="input" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              {error && <Alert tone="bad">{error}</Alert>}
              <button className="btn-primary w-full" disabled={busy || !name.trim() || !phone.trim()}>
                {busy ? <Spinner /> : "ดูไฟล์ที่เคยสั่ง"}
              </button>
            </form>
          ) : (
            <>
              <p className="text-sm text-muted">
                สวัสดีคุณ{data.customer.name} มีไฟล์ที่เคยสั่ง {data.files.length} ไฟล์ แตะรูปเพื่อเลือก (เลือกได้หลายไฟล์)
              </p>
              {data.files.length > 6 && (
                <input
                  className="input"
                  placeholder="ค้นชื่อไฟล์ หรือเลขออเดอร์"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="ค้นไฟล์"
                />
              )}
              {!data.files.length && (
                <p className="card text-center text-sm text-muted">ไม่มีไฟล์ที่ยังเก็บอยู่ในระบบ (ไฟล์จะถูกลบหลังส่งของตามระยะเวลาที่ร้านตั้งไว้)</p>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {files.map((f) => {
                  const already = inCart.has(f.itemId);
                  const on = selected.has(f.itemId);
                  return (
                    <button
                      key={f.itemId}
                      type="button"
                      disabled={already}
                      aria-pressed={on}
                      onClick={() => toggle(f.itemId)}
                      className={`relative flex flex-col overflow-hidden rounded-2xl border-2 bg-white text-left transition ${
                        on ? "border-brand-500 ring-4 ring-brand-100" : "border-line"
                      } ${already ? "opacity-50" : ""}`}
                    >
                      <span className="aspect-square w-full bg-gray-50">
                        {f.previewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={f.previewUrl} alt="" className="h-full w-full object-contain" />
                        ) : (
                          <FileIcon ext={f.fileType} />
                        )}
                      </span>
                      <span
                        className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                          on ? "bg-brand-500 text-white" : "bg-white/90 text-transparent ring-1 ring-line"
                        }`}
                        aria-hidden
                      >
                        ✓
                      </span>
                      <span className="space-y-0.5 p-2.5 text-xs">
                        <span className="block truncate text-sm font-semibold" title={f.fileName}>
                          {f.fileName}
                        </span>
                        <span className="block text-muted">
                          {productLabel(f.product, f.finish)} · {f.qty} แผ่น
                        </span>
                        <span className="block text-muted">
                          {shapeLabel(f.shape)} {sizeText(f)}
                        </span>
                        <span className="block text-muted">
                          ล่าสุด {f.orderNo} · {thaiDate(f.date).split(" ").slice(0, 3).join(" ")}
                        </span>
                        {f.times > 1 && <span className="block text-muted">สั่งแล้ว {f.times} ครั้ง</span>}
                        {f.prevFixed && <span className="block font-semibold text-blue-700">ร้านเคยแก้ไฟล์ให้</span>}
                        {already && <span className="block font-semibold text-brand-600">อยู่ในออเดอร์แล้ว</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {data && (
        <div className="border-t border-line bg-white">
          <div className="mx-auto flex max-w-xl gap-2 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            <button type="button" className="btn-secondary" onClick={onClose}>
              ยกเลิก
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={!selected.size}
              onClick={() => onAdd(data.files.filter((f) => selected.has(f.itemId)), data.customer)}
            >
              ใส่ไฟล์ที่เลือก ({selected.size})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
