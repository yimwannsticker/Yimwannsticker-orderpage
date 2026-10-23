"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { a5NudgeText, a5PriceRange, computeA5Quote } from "@/lib/a5-pricing";
import { addToCart, useCart } from "@/lib/client/cart";
import { fixedPriceRange, quoteLineFor, type ShopCategory, type ShopDesign, type ShopProduct } from "@/lib/shop-types";
import type { PublicSettings } from "@/lib/types";
import { ArtworkViewer } from "../order/ArtworkViewer";
import { MiniStepper } from "./MiniStepper";
import { A5PriceTable, Badges, baht0 } from "./parts";

export function ProductView({ product: p, category, settings }: { product: ShopProduct; category: ShopCategory | null; settings: PublicSettings }) {
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [zoom, setZoom] = useState<{ url: string; name: string } | null>(null);
  const fixed = p.pricing === "fixed";
  const range = fixed ? fixedPriceRange(p) : a5PriceRange(settings.a5Tiers, p.sizes.map((s) => s.surcharge));
  const unitLabel = fixed ? p.unitLabel : "แผ่น";
  const slides = p.images.length ? p.images : p.designs.filter((d) => d.imageUrl).slice(0, 8).map((d) => ({ url: d.imageUrl!, thumbUrl: d.thumbUrl! }));
  const activeDesigns = p.designs.filter((d) => d.active).length;
  const router = useRouter();

  return (
    <div className="mx-auto max-w-xl pb-24">
      <div className="relative">
        <Slider images={slides} onZoom={(url) => setZoom({ url, name: p.name })} />
        <button
          type="button"
          onClick={() => (history.length > 1 ? router.back() : router.push("/"))}
          className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-lg text-white"
          aria-label="ย้อนกลับ"
        >
          ‹
        </button>
      </div>

      <div className="space-y-3 px-4 pt-3">
        <div>
          <p className="text-2xl font-bold text-brand-600">
            {range.min === range.max ? baht0(range.min) : `${baht0(range.min)} – ${baht0(range.max)}`}
            <span className="text-sm font-normal text-muted"> / {unitLabel}</span>
          </p>
          <h1 className="mt-1 text-lg font-semibold leading-snug">
            <Badges p={p} className="mr-1.5 inline-flex align-middle" />
            {p.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {p.sold > 0 && (
              <>
                ขายแล้ว {p.sold.toLocaleString("th-TH")} {unitLabel} ·{" "}
              </>
            )}
            {activeDesigns} ลาย
            {category && (
              <>
                {" · "}
                <Link href={`/category?c=${category.id}`} className="text-brand-600">
                  {category.name}
                </Link>
              </>
            )}
          </p>
        </div>

        {fixed ? (
          <div className="card space-y-2 !p-3 text-sm">
            <p className="font-semibold">ราคา</p>
            <div className="grid grid-cols-3 gap-1.5">
              {p.sizes.map((s) => (
                <div key={s.id} className="rounded-xl px-2 py-1.5 text-center ring-1 ring-line">
                  <p className="text-xs text-muted">{s.name}</p>
                  <p className="font-bold">{baht0(s.price ?? 0)}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted">
              สั่งการ์ดอย่างเดียว ค่าส่ง {settings.fixedShippingFee} บาท · ครบ {settings.fixedFreeShippingUnits} ใบส่งฟรี · สั่งรวมกับสติกเกอร์ที่ถึงยอดส่งฟรีแล้ว ส่งฟรีทั้งกล่อง
            </p>
          </div>
        ) : (
          <div className="card space-y-2 !p-3 text-sm">
            <p className="font-semibold">ราคาส่ง (คละลาย คละสินค้าได้ทั้งร้าน นับรวมทุกแผ่น A5 ในตะกร้า)</p>
            <A5PriceTable tiers={settings.a5Tiers} surcharge={p.sizes.length ? Math.min(...p.sizes.map((s) => s.surcharge)) : 0} />
            <p className="text-xs text-muted">
              ค่าส่ง {settings.a5ShippingFee} บาท · A5 รวม {settings.a5FreeShippingMin} แผ่นขึ้นไปส่งฟรี
            </p>
          </div>
        )}

        <dl className="card grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 !p-3 text-sm">
          {!fixed && (
            <>
              <dt className="text-muted">ขนาดแผ่น</dt>
              <dd>A5</dd>
            </>
          )}
          {p.piecesPerSheet && (
            <>
              <dt className="text-muted">จำนวนดวง</dt>
              <dd>{p.piecesPerSheet} ดวง / แผ่น</dd>
            </>
          )}
          {p.material && (
            <>
              <dt className="text-muted">เนื้อสติกเกอร์</dt>
              <dd>{p.material}</dd>
            </>
          )}
          {p.sizes.length > 0 && (
            <>
              <dt className="text-muted">{p.optionLabel}</dt>
              <dd>{p.sizes.map((s) => s.name).join(" / ")}</dd>
            </>
          )}
        </dl>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">ลายทั้งหมด</h2>
            <button type="button" className="text-sm font-medium text-brand-600" onClick={() => setSheet(true)}>
              เลือกลาย ›
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {p.designs.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => d.imageUrl && setZoom({ url: d.imageUrl, name: `${d.sku} ${d.name}` })}
                className="relative overflow-hidden rounded-xl bg-white ring-1 ring-line"
              >
                {d.thumbUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.thumbUrl} alt={d.name} loading="lazy" className={`aspect-square w-full object-contain ${d.active ? "" : "opacity-40 grayscale"}`} />
                )}
                <span className="block truncate px-1 pb-1 text-[10px] text-muted">{d.sku}</span>
                {!d.active && <span className="absolute inset-x-0 top-1/3 bg-black/50 py-0.5 text-[10px] text-white">หมดชั่วคราว</span>}
              </button>
            ))}
          </div>
        </div>

        {p.description && (
          <div>
            <h2 className="mb-1 font-bold">รายละเอียด</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink/90">{p.description}</p>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed inset-x-4 bottom-24 z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-lg" role="status">
          <span>✓ {toast}</span>
          <Link href="/cart" className="shrink-0 font-semibold text-brand-200 underline">
            ดูตะกร้า
          </Link>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white">
        <div className="mx-auto flex max-w-xl gap-2 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <Link href="/cart" className="btn-secondary !px-4" aria-label="ตะกร้า">
            🛒
          </Link>
          <button type="button" className="btn-primary flex-1" onClick={() => setSheet(true)} disabled={!activeDesigns}>
            {activeDesigns ? "เพิ่มลงตะกร้า" : "หมดชั่วคราว"}
          </button>
        </div>
      </div>

      {sheet && (
        <OptionSheet
          product={p}
          settings={settings}
          onZoom={(d) => d.imageUrl && setZoom({ url: d.imageUrl, name: `${d.sku} ${d.name}` })}
          onClose={() => setSheet(false)}
          onAdded={(n) => {
            setSheet(false);
            setToast(`เพิ่มลงตะกร้าแล้ว ${n} ${unitLabel}`);
            setTimeout(() => setToast(null), 3500);
          }}
        />
      )}
      {zoom && <ArtworkViewer url={zoom.url} fileName={zoom.name} onClose={() => setZoom(null)} />}
    </div>
  );
}

function Slider({ images, onZoom }: { images: { url: string; thumbUrl: string }[]; onZoom: (url: string) => void }) {
  const [i, setI] = useState(0);
  if (!images.length) return <div className="aspect-square w-full bg-gray-100" />;
  return (
    <div className="relative bg-white">
      <div
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
      >
        {images.map((im, idx) => (
          <button key={idx} type="button" className="w-full shrink-0 snap-center" onClick={() => onZoom(im.url)} aria-label={`ดูรูปที่ ${idx + 1} เต็มจอ`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={im.url} alt="" className="aspect-square w-full object-cover" loading={idx ? "lazy" : "eager"} />
          </button>
        ))}
      </div>
      {images.length > 1 && (
        <span className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2.5 py-0.5 text-xs text-white">
          {i + 1}/{images.length}
        </span>
      )}
    </div>
  );
}

/** เลือกขนาด + จำนวนแผ่นของแต่ละลาย แล้วเพิ่มลงตะกร้าทีเดียว */
function OptionSheet({
  product: p,
  settings,
  onZoom,
  onClose,
  onAdded,
}: {
  product: ShopProduct;
  settings: PublicSettings;
  onZoom: (d: ShopDesign) => void;
  onClose: () => void;
  onAdded: (sheets: number) => void;
}) {
  const [sizeId, setSizeId] = useState<string | null>(p.sizes.length === 1 ? p.sizes[0].id : null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const cart = useCart();
  const panel = useRef<HTMLDivElement>(null);
  const needSize = p.sizes.length > 1 && !sizeId;
  const size = p.sizes.find((s) => s.id === sizeId) ?? null;
  const picked = Object.values(qty).reduce((a, b) => a + b, 0);
  const fixed = p.pricing === "fixed";
  const unitLabel = fixed ? p.unitLabel : "แผ่น";
  // ราคาขั้นบันไดคิดจากแผ่น A5 รวมทั้งตะกร้า (ไม่นับสินค้าราคาคงที่) + ที่กำลังเลือก
  const inCart = cart.reduce((a, l) => a + (l.fixed ? 0 : l.qty), 0);
  const quote = useMemo(
    () => computeA5Quote(settings, [{ qty: inCart, surcharge: 0 }, quoteLineFor(p, size, picked)]),
    [settings, inCart, picked, size, p],
  );
  const unit = quote.lines[1]?.unitPrice ?? 0;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  function add() {
    const lines = Object.entries(qty)
      .filter(([, n]) => n > 0)
      .map(([designId, n]) => ({ productId: p.id, designId, sizeId: p.sizes.length ? sizeId : null, qty: n, ...(fixed ? { fixed: true } : {}) }));
    if (!lines.length) return;
    addToCart(lines);
    onAdded(picked);
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={`เลือกลาย ${p.name}`}>
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="ปิด" />
      <div ref={panel} tabIndex={-1} className="relative mx-auto flex max-h-[88dvh] w-full max-w-xl flex-col rounded-t-3xl bg-white outline-none">
        <div className="flex items-start gap-3 border-b border-line p-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-50">
            {(p.images[0]?.thumbUrl ?? p.designs[0]?.thumbUrl) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.images[0]?.thumbUrl ?? p.designs[0]?.thumbUrl ?? ""} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-brand-600">
              {baht0(unit)} <span className="text-sm font-normal text-muted">/ {unitLabel}</span>
            </p>
            <p className="line-clamp-2 text-sm">{p.name}</p>
          </div>
          <button type="button" onClick={onClose} className="-mr-1 -mt-1 rounded-full px-2.5 py-1 text-xl text-muted" aria-label="ปิด">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {p.sizes.length > 1 && (
            <div>
              <p className="mb-2 text-sm font-semibold">{p.optionLabel}</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={p.optionLabel}>
                {p.sizes.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={sizeId === s.id}
                    onClick={() => setSizeId(s.id)}
                    className={`rounded-xl px-3.5 py-2 text-sm ring-1 ${sizeId === s.id ? "bg-brand-50 font-semibold text-brand-700 ring-brand-500" : "ring-line"}`}
                  >
                    {s.name}
                    {fixed ? (
                      <span className="text-xs text-muted"> {baht0(s.price ?? 0)}</span>
                    ) : (
                      s.surcharge > 0 && <span className="text-xs text-muted"> +{baht0(s.surcharge)}</span>
                    )}
                  </button>
                ))}
              </div>
              {needSize && <p className="mt-1.5 text-xs font-medium text-brand-600">เลือก{p.optionLabel}ก่อน แล้วใส่จำนวนแต่ละลาย</p>}
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-semibold">
              ลาย <span className="font-normal text-muted">(ใส่จำนวน{unitLabel}ได้หลายลายพร้อมกัน แตะรูปเพื่อขยาย)</span>
            </p>
            <div className="divide-y divide-line">
              {p.designs.map((d) => (
                <div key={d.id} className={`flex items-center gap-3 py-2 ${d.active ? "" : "opacity-50"}`}>
                  <button type="button" className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-50 ring-1 ring-line" onClick={() => onZoom(d)} aria-label={`ขยายลาย ${d.name}`}>
                    {d.thumbUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.thumbUrl} alt="" className={`h-full w-full object-contain ${d.active ? "" : "grayscale"}`} />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted">{d.sku}</p>
                  </div>
                  {d.active ? (
                    <MiniStepper
                      label={`จำนวน${unitLabel} ลาย ${d.name}`}
                      value={qty[d.id] ?? 0}
                      disabled={needSize}
                      onChange={(v) => setQty((q) => ({ ...q, [d.id]: v }))}
                    />
                  ) : (
                    <span className="shrink-0 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs text-muted">หมดชั่วคราว</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm text-muted">
              เลือก {picked} {unitLabel}
              {!fixed && inCart > 0 && ` (ในตะกร้า A5 อีก ${inCart} แผ่น)`}
            </span>
            <span className="text-xl font-bold">{baht0(unit * picked)}</span>
          </div>
          {!fixed && quote.nudge && picked > 0 && <p className="mb-2 text-sm font-medium text-brand-600">✨ {a5NudgeText(quote.nudge)}</p>}
          <button type="button" className="btn-primary w-full" disabled={!picked || needSize} onClick={add}>
            {needSize ? `เลือก${p.optionLabel}ก่อน` : picked ? `เพิ่มลงตะกร้า ${picked} ${unitLabel}` : "ใส่จำนวนอย่างน้อย 1 ลาย"}
          </button>
        </div>
      </div>
    </div>
  );
}
