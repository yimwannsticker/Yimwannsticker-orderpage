"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { a5NudgeText, combineTotals, computeA5Quote } from "@/lib/a5-pricing";
import { resolveCart, type ResolvedLine } from "@/lib/cart-resolve";
import { sameLine, setCart, updateDraftItems, useCart, useDraftItems } from "@/lib/client/cart";
import { productLabel, shapeLabel } from "@/lib/constants";
import { baht } from "@/lib/format";
import { computeQuote, itemProblem, nudgeText } from "@/lib/pricing";
import type { ShopCatalog } from "@/lib/shop-types";
import { itemCheck, sizeText } from "@/lib/sticker-size";
import type { PublicSettings } from "@/lib/types";
import { FileIcon } from "../ui";
import { MiniStepper } from "./MiniStepper";

export function CartView({ settings, catalog }: { settings: PublicSettings; catalog: ShopCatalog }) {
  const lines = useCart();
  const a3 = useDraftItems();
  const resolved = useMemo(() => resolveCart(lines, catalog), [lines, catalog]);
  const ok = resolved.filter((r) => !r.problem);
  const bad = resolved.filter((r) => r.problem);
  const a5 = useMemo(() => computeA5Quote(settings, ok.map((r) => ({ qty: r.line.qty, surcharge: r.size?.surcharge ?? 0 }))), [settings, ok]);
  const a3q = useMemo(() => computeQuote(settings, a3), [settings, a3]);
  const totals = combineTotals(a3q, a5);
  const unitOf = (r: ResolvedLine) => a5.tier.price + (r.size?.surcharge ?? 0);

  // จัดกลุ่ม A5 ตามสินค้า (ลำดับตามที่ใส่ตะกร้า)
  const groups = useMemo(() => {
    const m = new Map<string, ResolvedLine[]>();
    for (const r of ok) m.set(r.line.productId, [...(m.get(r.line.productId) ?? []), r]);
    return [...m.values()];
  }, [ok]);

  const setQty = (r: ResolvedLine, qty: number) => setCart(lines.map((l) => (sameLine(l, r.line) ? { ...l, qty } : l)).filter((l) => l.qty > 0));
  const removeLine = (r: ResolvedLine) => setCart(lines.filter((l) => !sameLine(l, r.line)));

  const a3Ready = a3.every((i) => !itemProblem(settings, { ...i, checkLevel: i.source?.prevApproved ? null : itemCheck(i, settings)?.level }));
  const checkout = a3.length && !a3Ready ? "/print?step=items" : "/print?step=address";
  const empty = !lines.length && !a3.length;

  if (empty)
    return (
      <div className="px-4 pt-10 text-center">
        <p className="text-5xl">🛒</p>
        <h1 className="mt-3 text-lg font-bold">ตะกร้ายังว่าง</h1>
        <p className="mt-1 text-sm text-muted">เลือกสติกเกอร์สำเร็จรูป หรือสั่งพิมพ์ไฟล์ของคุณเอง</p>
        <div className="mx-auto mt-5 grid max-w-xs gap-2">
          <Link href="/category" className="btn-primary">
            เลือกสติกเกอร์สำเร็จรูป A5
          </Link>
          <Link href="/print" className="btn-secondary">
            สั่งพิมพ์ไฟล์ตัวเอง A3+
          </Link>
        </div>
      </div>
    );

  return (
    <div className="space-y-4 px-4 pt-3">
      <h1 className="text-xl font-bold">ตะกร้า</h1>

      {bad.length > 0 && (
        <div className="card space-y-2 !border-bad/40 !p-3">
          <p className="text-sm font-semibold text-bad">มี {bad.length} รายการที่สั่งไม่ได้แล้ว</p>
          {bad.map((r, i) => (
            <p key={i} className="text-sm text-muted">
              {r.product?.name ?? "สินค้า"} {r.design ? `· ${r.design.sku}` : ""} — {r.problem}
            </p>
          ))}
          <button type="button" className="btn-secondary btn-sm" onClick={() => setCart(lines.filter((l) => !bad.some((b) => sameLine(l, b.line))))}>
            ลบรายการเหล่านี้
          </button>
        </div>
      )}

      {groups.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold">สติกเกอร์สำเร็จรูป A5</h2>
            <span className="text-sm text-muted">
              {a5.sheets} แผ่น · แผ่นละ {baht(a5.tier.price)}
            </span>
          </div>
          {groups.map((g) => {
            const p = g[0].product!;
            return (
              <div key={p.id} className="card space-y-1 !p-3">
                <Link href={`/p/${p.id}`} className="flex items-center gap-2 border-b border-line pb-2 text-sm font-semibold">
                  <span className="truncate">{p.name}</span>
                  <span className="ml-auto shrink-0 text-xs font-normal text-brand-600">เพิ่มลาย ›</span>
                </Link>
                {g.map((r) => (
                  <div key={`${r.line.designId}-${r.line.sizeId}`} className="flex items-center gap-2.5 py-1.5">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-50 ring-1 ring-line">
                      {r.design?.thumbUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.design.thumbUrl} alt="" className="h-full w-full object-contain" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="truncate font-medium">{r.design!.name}</p>
                      <p className="text-xs text-muted">
                        {r.design!.sku}
                        {r.size && ` · ${r.size.name}`} · {baht(unitOf(r))}/แผ่น
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <MiniStepper label={`จำนวน ${r.design!.name}`} value={r.line.qty} min={0} onChange={(v) => setQty(r, v)} />
                      <button type="button" className="text-xs text-muted underline" onClick={() => removeLine(r)}>
                        ลบ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
          {a5.nudge && <p className="px-1 text-sm font-medium text-brand-600">✨ {a5NudgeText(a5.nudge)}</p>}
        </section>
      )}

      {a3.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold">งานพิมพ์ไฟล์ {settings.sheetName}</h2>
            <Link href="/print?step=items" className="text-sm font-medium text-brand-600">
              แก้ไขรายละเอียด ›
            </Link>
          </div>
          {a3.map((it, idx) => (
            <div key={it.key} className="card flex gap-3 !p-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-50">
                <Thumb url={it.previewUrl} ext={it.fileType} />
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium">{it.fileName}</p>
                <p className="text-xs text-muted">
                  {it.product ? productLabel(it.product, it.finish) : "ยังไม่ได้เลือกประเภท"}
                  {it.shape && ` · ไดคัท${shapeLabel(it.shape)} ${sizeText(it)}`}
                </p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <MiniStepper
                    label={`จำนวนแผ่น ${it.fileName}`}
                    value={it.qty}
                    min={settings.minPerFile}
                    onChange={(v) => updateDraftItems((xs) => xs.map((x) => (x.key === it.key ? { ...x, qty: v } : x)))}
                  />
                  <span className="font-semibold">{baht(a3q.lines[idx]?.lineTotal ?? 0)}</span>
                </div>
              </div>
              <button
                type="button"
                className="self-start text-xs text-muted underline"
                onClick={() => updateDraftItems((xs) => xs.filter((x) => x.key !== it.key))}
              >
                ลบ
              </button>
            </div>
          ))}
          {a3q.nudge && <p className="px-1 text-sm font-medium text-brand-600">✨ {nudgeText(a3q.nudge)}</p>}
          {!a3Ready && <p className="px-1 text-sm text-warn">มีไฟล์ที่ยังเลือกขนาด/ประเภทไม่ครบ จะพาไปเลือกก่อนชำระเงิน</p>}
        </section>
      )}

      <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 rounded-2xl bg-white p-4 shadow-lg ring-1 ring-line">
        <div className="space-y-0.5 text-sm">
          {a5.sheets > 0 && <Row label={`A5 ${a5.sheets} แผ่น`} value={baht(a5.subtotal)} />}
          {a3q.totalSheets > 0 && <Row label={`${settings.sheetName} ${a3q.totalSheets} แผ่น`} value={baht(a3q.subtotal + a3q.fixFeeTotal)} />}
          <Row label="ค่าส่ง" value={totals.shipping ? baht(totals.shipping) : "ส่งฟรี"} />
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs text-muted">ยอดรวม</p>
            <p className="text-xl font-bold text-brand-600">{baht(totals.total)}</p>
          </div>
          <Link href={checkout} className={`btn-primary ${bad.length ? "pointer-events-none opacity-50" : ""}`} aria-disabled={bad.length > 0}>
            สั่งซื้อ
          </Link>
        </div>
        {a3.length > 0 && settings.promo.enabled && <p className="mt-1 text-xs text-muted">แผ่นแถมโปรสะสม (นับเฉพาะ {settings.sheetName}) คำนวณในขั้นชำระเงิน</p>}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}

/** รูปตัวอย่างไฟล์ (ลิงก์ชั่วคราวอาจหมดอายุหลังปิดเว็บ ใช้ไอคอนไฟล์แทน) */
function Thumb({ url, ext }: { url: string | null; ext: string }) {
  const [broken, setBroken] = useState(false);
  if (!url || broken) return <FileIcon ext={ext} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="h-full w-full object-contain" onError={() => setBroken(true)} />;
}
