"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Spinner } from "@/components/ui";
import { ArtworkViewer } from "@/components/order/ArtworkViewer";
import { nameFromFile, uploadImages } from "@/lib/client/catalog-upload";
import { makeSku, nextSkuNumber } from "@/lib/shop-types";
import { deleteProduct, saveProduct } from "../../../shop-actions";
import { Sortable } from "../../sortable";
import { Toggle } from "../client";

interface EditorDesign {
  /** id ในฐานข้อมูล หรือ key ชั่วคราวของลายใหม่ */
  id?: string;
  key?: string;
  name: string;
  sku: string;
  imagePath: string | null;
  thumbPath: string | null;
  url: string | null;
  active: boolean;
}

export interface EditorProduct {
  id?: string;
  categoryId: string | null;
  name: string;
  description: string;
  piecesPerSheet: number | null;
  material: string;
  designCode: string;
  designerId: string | null;
  images: { path: string; thumb: string; url: string }[];
  badgeBest: boolean;
  badgeNew: boolean;
  active: boolean;
  pricing: "a5" | "fixed";
  optionLabel: string;
  unitLabel: string;
  sizes: { id?: string; key?: string; name: string; surcharge: number; price: number | null; units: number | null }[];
  designs: EditorDesign[];
}

const keyOf = (x: { id?: string; key?: string }) => x.id ?? x.key!;
const tmpKey = () => `new-${crypto.randomUUID()}`;

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function ProductEditor({
  initial,
  categories,
  designers,
}: {
  initial: EditorProduct;
  categories: { id: string; name: string }[];
  designers: { id: string; name: string; active: boolean }[];
}) {
  const [p, setP] = useState<EditorProduct>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [view, setView] = useState<EditorDesign | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = <K extends keyof EditorProduct>(k: K, v: EditorProduct[K]) => {
    setSaved(null);
    setP((x) => ({ ...x, [k]: v }));
  };
  const setDesign = (k: string, patch: Partial<EditorDesign>) =>
    set(
      "designs",
      p.designs.map((d) => (keyOf(d) === k ? { ...d, ...patch } : d)),
    );

  async function addImages(files: FileList | null) {
    if (!files?.length) return;
    setBusy("images");
    setError(null);
    try {
      const up = await uploadImages([...files]);
      setP((x) => ({ ...x, images: [...x.images, ...up.map((u) => ({ path: u.path, thumb: u.thumb, url: u.url }))] }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  /** อัปโหลดรูปลายทีละหลายรูป: สร้างลายตามชื่อไฟล์ + SKU อัตโนมัติ */
  async function addDesigns(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files].sort((a, b) => a.name.localeCompare(b.name, "th", { numeric: true }));
    setBusy("designs");
    setError(null);
    try {
      const up = await uploadImages(list, { max: 1600, thumb: 360 });
      setP((x) => {
        let n = nextSkuNumber(x.designCode, x.designs.map((d) => d.sku));
        const added = up.map((u, i) => ({
          key: tmpKey(),
          name: nameFromFile(list[i].name),
          sku: makeSku(x.designCode, n++),
          imagePath: u.path,
          thumbPath: u.thumb,
          url: u.url,
          active: true,
        }));
        return { ...x, designs: [...x.designs, ...added] };
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function replaceDesignImage(k: string, file: File | undefined) {
    if (!file) return;
    setBusy(k);
    try {
      const [u] = await uploadImages([file], { max: 1600, thumb: 360 });
      setDesign(k, { imagePath: u.path, thumbPath: u.thumb, url: u.url });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function renumberSkus() {
    if (!confirm(`ตั้งรหัส SKU ใหม่ทุกลายเป็น ${makeSku(p.designCode, 1)}, ${makeSku(p.designCode, 2)}, ... ตามลำดับปัจจุบัน?`)) return;
    set(
      "designs",
      p.designs.map((d, i) => ({ ...d, sku: makeSku(p.designCode, i + 1) })),
    );
  }

  function save() {
    setError(null);
    setSaved(null);
    start(async () => {
      const r = await saveProduct({
        id: p.id,
        categoryId: p.categoryId,
        name: p.name,
        description: p.description,
        piecesPerSheet: p.piecesPerSheet,
        material: p.material,
        designCode: p.designCode,
        designerId: p.designerId,
        images: p.images.map((i) => ({ path: i.path, thumb: i.thumb })),
        badgeBest: p.badgeBest,
        badgeNew: p.badgeNew,
        active: p.active,
        pricing: p.pricing,
        optionLabel: p.optionLabel,
        unitLabel: p.unitLabel,
        sizes: p.sizes.map((s) => ({ id: s.id, name: s.name, surcharge: s.surcharge, price: s.price, units: s.units })),
        designs: p.designs.map((d) => ({ id: d.id, name: d.name, sku: d.sku, imagePath: d.imagePath, thumbPath: d.thumbPath, active: d.active })),
      });
      if (!r.ok) return setError(r.error);
      setSaved(r.message ?? "บันทึกแล้ว");
      if (!p.id && r.id) router.replace(`/admin/shop/${r.id}`);
      else router.refresh();
    });
  }

  const activeCount = p.designs.filter((d) => d.active).length;

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between gap-2">
        <Link href="/admin/shop" className="text-sm text-muted hover:underline">
          ← สินค้าทั้งหมด
        </Link>
        {p.id && (
          <Link href={`/p/${p.id}`} target="_blank" className="text-sm text-brand-600 underline">
            ดูหน้าร้าน ↗
          </Link>
        )}
      </div>
      <h1 className="text-xl font-bold">{p.id ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}</h1>

      <section className="card space-y-4">
        <h2 className="font-bold">ข้อมูลสินค้า</h2>
        <Field label="ชื่อสินค้า (ตะกร้า)">
          <input className="input" value={p.name} onChange={(e) => set("name", e.target.value)} placeholder="เช่น สติกเกอร์ร้านกาแฟ ชุดมินิมอล" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="หมวดหมู่">
            <select className="input" value={p.categoryId ?? ""} onChange={(e) => set("categoryId", e.target.value || null)}>
              <option value="">ไม่มีหมวด</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="กราฟิก">
            <select className="input" value={p.designerId ?? ""} onChange={(e) => set("designerId", e.target.value || null)}>
              <option value="">ไม่ระบุ</option>
              {designers
                .filter((d) => d.active || d.id === p.designerId)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="ประเภทราคา" hint={p.pricing === "fixed" ? "ราคาตามตัวเลือกด้านล่าง ไม่นับเป็นแผ่น A5 ค่าส่งใช้เกณฑ์การ์ด" : "ราคาส่งขั้นบันไดตามแผ่น A5 รวมทั้งตะกร้า (ตั้งในหน้าตั้งค่า)"}>
            <select className="input" value={p.pricing} onChange={(e) => set("pricing", e.target.value as "a5" | "fixed")}>
              <option value="a5">สติกเกอร์ A5 (ราคาขั้นบันได)</option>
              <option value="fixed">ราคาคงที่ (เช่น การ์ดแพ็ค)</option>
            </select>
          </Field>
          {p.pricing === "fixed" && (
            <Field label="หน่วยที่ขาย" hint="เช่น แพ็ค / ชุด / ชิ้น">
              <input className="input" value={p.unitLabel} onChange={(e) => set("unitLabel", e.target.value)} />
            </Field>
          )}
          <Field label="จำนวนดวงต่อแผ่น">
            <input
              className="input"
              inputMode="numeric"
              value={p.piecesPerSheet ?? ""}
              onChange={(e) => set("piecesPerSheet", e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null)}
            />
          </Field>
          <Field label="เนื้อสติกเกอร์">
            <input className="input" value={p.material} onChange={(e) => set("material", e.target.value)} placeholder="เช่น PP ขาวด้าน กันน้ำ" />
          </Field>
          <Field label="รหัสลายของร้าน (design code)" hint="ใช้ขึ้นต้น SKU ของลาย เช่น 33 → 33-01, 33-02">
            <input className="input" value={p.designCode} onChange={(e) => set("designCode", e.target.value.replace(/\s/g, ""))} placeholder="เช่น 33" />
          </Field>
        </div>
        <Field label="รายละเอียด">
          <textarea className="input min-h-32 py-2" value={p.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Toggle on={p.active} onChange={(v) => set("active", v)} label="เปิดขาย" /> เปิดขาย
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <Toggle on={p.badgeBest} onChange={(v) => set("badgeBest", v)} label="ป้ายขายดี" /> ป้าย &quot;ขายดี&quot;
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <Toggle on={p.badgeNew} onChange={(v) => set("badgeNew", v)} label="ป้ายใหม่" /> ป้าย &quot;ใหม่&quot;
          </label>
        </div>
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">รูปสินค้า</h2>
          <label className="btn-secondary btn-sm cursor-pointer">
            {busy === "images" ? <Spinner /> : "+ เพิ่มรูป"}
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addImages(e.target.files)} />
          </label>
        </div>
        <p className="text-xs text-muted">รูปแรก = รูปปก ลากหรือกด ← → เพื่อเรียง ระบบย่อรูปให้อัตโนมัติ</p>
        {!p.images.length && <p className="text-sm text-muted">ยังไม่มีรูป</p>}
        <Sortable items={p.images} getKey={(i) => i.path} onChange={(xs) => set("images", xs)} grid className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {(im, i, handle) => (
            <div className="relative overflow-hidden rounded-xl border border-line bg-gray-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.url} alt="" className="aspect-square w-full object-cover" />
              {i === 0 && <span className="absolute left-1 top-1 rounded-full bg-brand-500 px-2 text-[11px] font-bold text-white">ปก</span>}
              <div className="flex items-center justify-between bg-white px-1">
                {handle}
                <button type="button" className="px-1.5 text-sm text-bad" onClick={() => set("images", p.images.filter((x) => x.path !== im.path))}>
                  ลบ
                </button>
              </div>
            </div>
          )}
        </Sortable>
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">ตัวเลือก {p.pricing === "fixed" ? "(ต้องมี พร้อมราคา)" : "(ไม่บังคับ)"}</h2>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => set("sizes", [...p.sizes, { key: tmpKey(), name: "", surcharge: 0, price: null, units: p.pricing === "fixed" ? 1 : null }])}
          >
            + เพิ่ม{p.optionLabel}
          </button>
        </div>
        <Field label="ชื่อปุ่มตัวเลือก" hint="ลูกค้าเห็นเป็นหัวข้อ เช่น ขนาด / สี / แพ็ค">
          <input className="input max-w-xs" value={p.optionLabel} onChange={(e) => set("optionLabel", e.target.value)} />
        </Field>
        <p className="text-xs text-muted">
          {p.pricing === "fixed"
            ? "ใส่ราคาต่อหน่วย และจำนวนชิ้นต่อหน่วย (เช่น แพ็ค 25 ใบ = 25) ใช้นับเกณฑ์ส่งฟรีของการ์ด"
            : "ถ้ามีมากกว่า 1 ตัวเลือก ลูกค้าต้องเลือกก่อน ส่วนต่างราคาบวกเพิ่มจากราคาขั้นบันไดต่อแผ่น"}
        </p>
        {p.sizes.map((s) => (
          <div key={keyOf(s)} className="flex items-center gap-2">
            <input
              className="input"
              placeholder={p.pricing === "fixed" ? "เช่น แพ็ค 25 ใบ" : "ชื่อขนาด เช่น ดวง 3 ซม."}
              value={s.name}
              onChange={(e) => set("sizes", p.sizes.map((x) => (keyOf(x) === keyOf(s) ? { ...x, name: e.target.value } : x)))}
            />
            {p.pricing === "fixed" ? (
              <>
                <div className="flex w-36 shrink-0 items-center gap-1">
                  <input
                    className="input"
                    inputMode="decimal"
                    aria-label="ราคา"
                    value={s.price ?? ""}
                    onChange={(e) => set("sizes", p.sizes.map((x) => (keyOf(x) === keyOf(s) ? { ...x, price: Number(e.target.value) || null } : x)))}
                  />
                  <span className="text-sm text-muted">บาท</span>
                </div>
                <div className="flex w-32 shrink-0 items-center gap-1">
                  <input
                    className="input"
                    inputMode="numeric"
                    aria-label="จำนวนชิ้นต่อหน่วย"
                    value={s.units ?? ""}
                    onChange={(e) => set("sizes", p.sizes.map((x) => (keyOf(x) === keyOf(s) ? { ...x, units: Number(e.target.value.replace(/\D/g, "")) || null } : x)))}
                  />
                  <span className="text-sm text-muted">ใบ</span>
                </div>
              </>
            ) : (
              <div className="flex w-40 shrink-0 items-center gap-1">
                <span className="text-sm text-muted">+</span>
                <input
                  className="input"
                  inputMode="decimal"
                  value={s.surcharge}
                  onChange={(e) => set("sizes", p.sizes.map((x) => (keyOf(x) === keyOf(s) ? { ...x, surcharge: Number(e.target.value) || 0 } : x)))}
                />
                <span className="text-sm text-muted">บาท</span>
              </div>
            )}
            <button type="button" className="btn-ghost btn-sm text-bad" onClick={() => set("sizes", p.sizes.filter((x) => keyOf(x) !== keyOf(s)))}>
              ลบ
            </button>
          </div>
        ))}
      </section>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">
            ลาย <span className="font-normal text-muted">({activeCount}/{p.designs.length} เปิดขาย)</span>
          </h2>
          <div className="flex gap-2">
            {p.designs.length > 1 && (
              <button type="button" className="btn-ghost btn-sm" onClick={renumberSkus}>
                เรียง SKU ใหม่
              </button>
            )}
            <label className="btn-primary btn-sm cursor-pointer">
              {busy === "designs" ? <Spinner /> : "+ อัปโหลดรูปลาย (หลายรูปได้)"}
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addDesigns(e.target.files)} />
            </label>
          </div>
        </div>
        <p className="text-xs text-muted">
          เลือกรูปลายทีละหลายรูป ระบบสร้างลายตามชื่อไฟล์ และตั้ง SKU ต่อจากลายล่าสุดให้ ({makeSku(p.designCode, nextSkuNumber(p.designCode, p.designs.map((d) => d.sku)))}) แก้ชื่อ/SKU ได้
        </p>
        <Sortable items={p.designs} getKey={keyOf} onChange={(xs) => set("designs", xs)}>
          {(d, _i, handle) => (
            <div className={`flex items-center gap-2 rounded-2xl border border-line p-2 ${d.active ? "" : "bg-gray-50"}`}>
              {handle}
              <button type="button" className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-50" onClick={() => d.url && setView(d)} aria-label="ดูรูปลาย">
                {busy === keyOf(d) ? (
                  <Spinner />
                ) : (
                  d.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.url} alt="" className={`h-full w-full object-contain ${d.active ? "" : "grayscale"}`} />
                  )
                )}
              </button>
              <div className="grid min-w-0 flex-1 gap-1 sm:grid-cols-[1fr_9rem]">
                <input className="input !min-h-10" value={d.name} aria-label="ชื่อลาย" onChange={(e) => setDesign(keyOf(d), { name: e.target.value })} />
                <input
                  className="input !min-h-10 font-mono"
                  value={d.sku}
                  aria-label="SKU"
                  onChange={(e) => setDesign(keyOf(d), { sku: e.target.value.replace(/\s/g, "") })}
                />
              </div>
              <div className="flex shrink-0 flex-col items-center gap-1">
                <Toggle on={d.active} onChange={(v) => setDesign(keyOf(d), { active: v })} label={`เปิดขาย ${d.name}`} />
                <span className="text-[10px] text-muted">{d.active ? "เปิดขาย" : "หมดชั่วคราว"}</span>
              </div>
              <details className="relative shrink-0">
                <summary className="cursor-pointer list-none rounded-lg px-2 py-1 text-muted hover:bg-gray-100">⋯</summary>
                <div className="absolute right-0 z-10 mt-1 w-40 rounded-xl border border-line bg-white p-1 text-sm shadow-lg">
                  <label className="block cursor-pointer rounded-lg px-3 py-2 hover:bg-gray-50">
                    เปลี่ยนรูป
                    <input type="file" accept="image/*" className="sr-only" onChange={(e) => replaceDesignImage(keyOf(d), e.target.files?.[0])} />
                  </label>
                  <button
                    type="button"
                    className="block w-full rounded-lg px-3 py-2 text-left text-bad hover:bg-gray-50"
                    onClick={() => confirm(`ลบลาย ${d.sku}?`) && set("designs", p.designs.filter((x) => keyOf(x) !== keyOf(d)))}
                  >
                    ลบลายนี้
                  </button>
                </div>
              </details>
            </div>
          )}
        </Sortable>
      </section>

      {view?.url && <ArtworkViewer url={view.url} fileName={`${view.sku} ${view.name}`} onClose={() => setView(null)} />}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <button type="button" className="btn-primary" onClick={save} disabled={pending || Boolean(busy)}>
            {pending ? <Spinner /> : "บันทึกสินค้า"}
          </button>
          {saved && <span className="text-sm text-ok">{saved}</span>}
          {error && (
            <div className="min-w-0 flex-1">
              <Alert tone="bad">{error}</Alert>
            </div>
          )}
          <div className="flex-1" />
          {p.id && (
            <button
              type="button"
              className="btn-ghost btn-sm text-bad"
              onClick={() =>
                confirm(`ลบสินค้า "${p.name}" และลายทั้งหมด? (ออเดอร์เก่ายังเก็บชื่อและรหัสไว้)`) &&
                start(async () => {
                  const r = await deleteProduct(p.id!);
                  if (r.ok) router.replace("/admin/shop");
                  else setError(r.error);
                })
              }
            >
              ลบสินค้า
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
