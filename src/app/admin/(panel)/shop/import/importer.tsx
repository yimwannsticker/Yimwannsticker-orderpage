"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Spinner } from "@/components/ui";
import { makeSku, monthDayLabel, nextSkuNumber } from "@/lib/shop-types";
import { buildShopeePlans, shopeeFileKind, type ShopeeExcluded, type ShopeePlan } from "@/lib/shopee-import";
import { readXlsxRows } from "@/lib/xlsx-read";
import { importShopeeImages, saveProduct, shopeeImportState, type ProductInput } from "../../../shop-actions";

type Row = ShopeePlan & { checked: boolean; categoryId: string; done?: "ok" | "error"; error?: string; imported?: boolean };
type Files = { media?: string[][]; sales?: string[][] };

const IMAGE_BATCH = 12;

export function ShopeeImporter({ categories, a5BasePrice }: { categories: { id: string; name: string }[]; a5BasePrice: number }) {
  const [files, setFiles] = useState<Files>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<Row[] | null>(null);
  const [excluded, setExcluded] = useState<ShopeeExcluded[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [bulkCat, setBulkCat] = useState("");

  async function addFiles(list: FileList | null) {
    setError(null);
    const next = { ...files };
    const nextNames = { ...names };
    for (const f of [...(list ?? [])]) {
      try {
        const data = await readXlsxRows(await f.arrayBuffer());
        const kind = shopeeFileKind(data);
        if (!kind) {
          setError(`ไฟล์ ${f.name} ไม่ใช่ไฟล์ export จาก Shopee (media_info / sales_info)`);
          continue;
        }
        next[kind] = data;
        nextNames[kind] = f.name;
      } catch {
        setError(`เปิดไฟล์ ${f.name} ไม่ได้ กรุณาใช้ไฟล์ .xlsx ที่ดาวน์โหลดจาก Shopee`);
      }
    }
    setFiles(next);
    setNames(nextNames);
    if (next.media && next.sales) {
      const { plans, excluded } = buildShopeePlans({ media: next.media, sales: next.sales }, { a5BasePrice });
      const { imported } = await shopeeImportState();
      const had = new Set(imported);
      setExcluded(excluded);
      setRows(plans.map((p) => ({ ...p, checked: !had.has(p.itemId), categoryId: "", imported: had.has(p.itemId) })));
    }
  }

  const update = (itemId: string, patch: Partial<Row>) => setRows((rs) => rs?.map((r) => (r.itemId === itemId ? { ...r, ...patch } : r)) ?? null);
  const selectable = (rows ?? []).filter((r) => !r.imported && r.done !== "ok");
  const selected = selectable.filter((r) => r.checked);

  async function importOne(r: Row, taken: Set<string>) {
    const urls = [...new Set([...r.images, ...r.designs.map((d) => d.image).filter((u): u is string => Boolean(u))])];
    const got: Record<string, { path: string; thumb: string }> = {};
    for (let i = 0; i < urls.length; i += IMAGE_BATCH) {
      setProgress(`${r.name}: รูป ${Math.min(i + IMAGE_BATCH, urls.length)}/${urls.length}`);
      const res = await importShopeeImages(urls.slice(i, i + IMAGE_BATCH));
      if (!res.ok) throw new Error(res.error);
      Object.assign(got, res.images);
    }
    let n = nextSkuNumber(r.designCode, [...taken]);
    const designs = r.designs.map((d) => {
      while (taken.has(makeSku(r.designCode, n).toLowerCase())) n++;
      const sku = makeSku(r.designCode, n++);
      taken.add(sku.toLowerCase());
      const img = d.image ? got[d.image] : undefined;
      return { name: d.name, sku, imagePath: img?.path ?? null, thumbPath: img?.thumb ?? null, active: d.active };
    });
    const input: ProductInput = {
      categoryId: r.categoryId || null,
      name: r.name,
      description: r.description,
      piecesPerSheet: r.piecesPerSheet,
      material: r.material,
      designCode: r.designCode,
      designerId: null,
      images: r.images.map((u) => got[u]).filter(Boolean),
      badgeBest: false,
      badgeNew: false,
      active: designs.some((d) => d.active),
      pricing: r.pricing,
      optionLabel: r.optionLabel,
      unitLabel: r.unitLabel,
      shopeeItemId: r.itemId,
      seasonStart: r.season?.start ?? null,
      seasonEnd: r.season?.end ?? null,
      sizes: r.sizes,
      designs,
    };
    const saved = await saveProduct(input);
    if (!saved.ok) throw new Error(saved.error);
  }

  async function run() {
    if (!selected.length) return;
    setBusy(true);
    setError(null);
    try {
      const { imported, skus } = await shopeeImportState();
      const had = new Set(imported);
      const taken = new Set(skus.map((s) => s.toLowerCase()));
      for (const [i, r] of selected.entries()) {
        setProgress(`${i + 1}/${selected.length} ${r.name}`);
        if (had.has(r.itemId)) {
          update(r.itemId, { imported: true, checked: false });
          continue;
        }
        try {
          await importOne(r, taken);
          update(r.itemId, { done: "ok", checked: false });
        } catch (e) {
          update(r.itemId, { done: "error", error: e instanceof Error ? e.message : "นำเข้าไม่สำเร็จ" });
        }
      }
    } catch {
      setError("นำเข้าไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const designCount = selected.reduce((a, r) => a + r.designs.length, 0);
  const doneCount = (rows ?? []).filter((r) => r.done === "ok").length;
  const failCount = (rows ?? []).filter((r) => r.done === "error").length;

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <p className="text-sm">
          ใน Shopee Seller Centre ไปที่ <b>สินค้าของฉัน → อัปเดตสินค้าทีละหลายรายการ</b> แล้วดาวน์โหลดไฟล์ <b>ข้อมูลสื่อ (media_info)</b> และ{" "}
          <b>ข้อมูลการขาย (sales_info)</b> · ไม่นำคำอธิบายสินค้ามา ใช้ขนาดและจำนวนดวงต่อแผ่นแทน
        </p>
        <label className="block">
          <span className="label">เลือกไฟล์ .xlsx (เลือกพร้อมกันหลายไฟล์ได้)</span>
          <input
            type="file"
            accept=".xlsx"
            multiple
            disabled={busy}
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = "";
            }}
            className="input"
          />
        </label>
        <ul className="space-y-0.5 text-sm">
          {(
            [
              ["media", "ข้อมูลสื่อ (รูป)"],
              ["sales", "ข้อมูลการขาย (ราคา/คลัง)"],
            ] as const
          ).map(([k, label]) => (
            <li key={k} className={files[k] ? "text-ok" : "text-muted"}>
              {files[k] ? "✓" : "○"} {label}
              {names[k] ? ` · ${names[k]}` : ""}
            </li>
          ))}
        </ul>
        {error && <Alert tone="bad">{error}</Alert>}
        <p className="text-xs text-muted">
          ไม่นำเข้า: ตัวเลือกที่มีคำว่า &ldquo;ตำหนิ&rdquo; สินค้าลดล้างสต็อค งานศพ งานเคลือบ · การ์ดใช้ราคาเดียวกับ Shopee · สติกเกอร์ใช้ราคาขั้นบันได A5
          (ส่วนต่างขนาดคิดจากสัดส่วนราคาใน Shopee) · ลายที่คลังเป็น 0 จะปิดไว้ก่อน · ยอดขายเริ่มนับจากออเดอร์ในเว็บ
        </p>
      </section>

      {rows && (
        <>
          <section className="card space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <p className="mr-auto text-sm">
                พบ {rows.length} สินค้า · เลือก <b>{selected.length}</b> สินค้า {designCount} ลาย
                {rows.some((r) => r.imported) && ` · นำเข้าแล้วก่อนหน้า ${rows.filter((r) => r.imported).length}`}
              </p>
              <label className="block">
                <span className="label">ใส่หมวดหมู่ให้สินค้าที่เลือก</span>
                <select className="input" value={bulkCat} onChange={(e) => setBulkCat(e.target.value)}>
                  <option value="">— เลือกหมวด —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn-secondary"
                disabled={!bulkCat || busy}
                onClick={() => setRows((rs) => rs?.map((r) => (r.checked && !r.imported ? { ...r, categoryId: bulkCat } : r)) ?? null)}
              >
                ใส่หมวด
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => {
                  const all = selected.length < selectable.length;
                  setRows((rs) => rs?.map((r) => (r.imported || r.done === "ok" ? r : { ...r, checked: all })) ?? null);
                }}
              >
                {selected.length < selectable.length ? "เลือกทั้งหมด" : "ไม่เลือกเลย"}
              </button>
            </div>
            {!categories.length && (
              <p className="text-xs text-muted">
                ยังไม่มีหมวดหมู่ · <Link href="/admin/shop?tab=categories" className="underline">สร้างหมวดหมู่</Link> ก่อนก็ได้ หรือนำเข้าแล้วค่อยใส่ทีหลัง
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn-primary" disabled={busy || !selected.length} onClick={run}>
                {busy ? <Spinner /> : null} นำเข้า {selected.length} สินค้า
              </button>
              {progress && <p className="text-sm text-muted">กำลังนำเข้า {progress}</p>}
              {!busy && doneCount > 0 && (
                <p className="text-sm text-ok">
                  นำเข้าแล้ว {doneCount} สินค้า · <Link href="/admin/shop" className="underline">ดูรายการสินค้า</Link>
                </p>
              )}
              {!busy && failCount > 0 && <p className="text-sm text-bad">ไม่สำเร็จ {failCount} สินค้า (ดูเหตุผลในรายการ กดนำเข้าซ้ำได้)</p>}
            </div>
          </section>

          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.itemId} className={`card !p-3 ${r.imported || r.done === "ok" ? "opacity-60" : ""}`}>
                <div className="flex gap-3">
                  <input
                    type="checkbox"
                    aria-label={`เลือก ${r.name}`}
                    className="mt-1 h-5 w-5 shrink-0"
                    checked={r.checked}
                    disabled={busy || r.imported || r.done === "ok"}
                    onChange={(e) => update(r.itemId, { checked: e.target.checked })}
                  />
                  {r.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.images[0]} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-line" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="h-16 w-16 shrink-0 rounded-lg bg-gray-100" />
                  )}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <input
                      className="input !py-1.5 text-sm font-medium"
                      aria-label="ชื่อสินค้า"
                      value={r.name}
                      disabled={busy || r.imported || r.done === "ok"}
                      onChange={(e) => update(r.itemId, { name: e.target.value })}
                    />
                    <p className="truncate text-xs text-muted" title={r.title}>
                      Shopee: {r.title}
                    </p>
                    <p className="text-xs">
                      {r.pricing === "fixed" ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">ราคาคงที่</span>
                      ) : (
                        <span className="rounded bg-brand-50 px-1.5 py-0.5 text-brand-700">ขั้นบันได A5</span>
                      )}{" "}
                      รหัส {r.designCode} · {r.designs.length} ลาย
                      {r.designs.some((d) => !d.active) && ` (หมด ${r.designs.filter((d) => !d.active).length})`}
                      {r.skippedFlawed > 0 && ` · ตัดตำหนิ ${r.skippedFlawed}`}
                      {r.sizes.length > 0 &&
                        ` · ${r.optionLabel}: ${r.sizes
                          .map((s) => (r.pricing === "fixed" ? `${s.name} ฿${s.price}` : s.surcharge ? `${s.name} +฿${s.surcharge}` : s.name))
                          .join(", ")}`}
                    </p>
                    {r.description && <p className="text-xs text-muted">{r.description}</p>}
                    {r.season && (
                      <p className="flex items-center gap-2 text-xs">
                        <span className="rounded bg-ok-bg px-1.5 py-0.5 text-ok">
                          ขายช่วงเทศกาล {monthDayLabel(r.season.start)} – {monthDayLabel(r.season.end)}
                        </span>
                        {!(busy || r.imported || r.done === "ok") && (
                          <button type="button" className="text-muted underline" onClick={() => update(r.itemId, { season: null })}>
                            ขายตลอดปี
                          </button>
                        )}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        className="input !w-auto !py-1 text-sm"
                        aria-label="หมวดหมู่"
                        value={r.categoryId}
                        disabled={busy || r.imported || r.done === "ok"}
                        onChange={(e) => update(r.itemId, { categoryId: e.target.value })}
                      >
                        <option value="">ไม่มีหมวด</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      {r.pricing === "a5" && (
                        <label className="flex items-center gap-1.5 text-sm">
                          <input
                            type="number"
                            min={1}
                            inputMode="numeric"
                            aria-label={`จำนวนดวงต่อแผ่น ${r.name}`}
                            className={`input !w-20 !py-1 text-sm ${
                              !r.piecesPerSheet && !r.description && !r.sizes.some((s) => /ดวง/.test(s.name)) ? "ring-2 ring-warn" : ""
                            }`}
                            value={r.piecesPerSheet ?? ""}
                            disabled={busy || r.imported || r.done === "ok"}
                            onChange={(e) => update(r.itemId, { piecesPerSheet: Math.floor(Number(e.target.value)) || null })}
                          />
                          ดวง/แผ่น
                        </label>
                      )}
                      {r.imported && <span className="text-xs text-muted">นำเข้าแล้ว</span>}
                      {r.done === "ok" && <span className="text-xs text-ok">✓ นำเข้าแล้ว</span>}
                      {r.done === "error" && <span className="text-xs text-bad">{r.error}</span>}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {excluded.length > 0 && (
        <section className="card">
          <h2 className="font-bold">ไม่นำเข้า {excluded.length} สินค้า</h2>
          <ul className="mt-1 space-y-0.5 text-sm text-muted">
            {excluded.map((x) => (
              <li key={x.itemId} className="truncate">
                {x.reason} · {x.title}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
