import Link from "next/link";
import { a5PriceRange } from "@/lib/a5-pricing";
import { fixedPriceRange, type ShopProduct } from "@/lib/shop-types";
import type { A5Tier } from "@/lib/types";

export const baht0 = (n: number) => `฿${n.toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;

export function Badges({ p, className = "" }: { p: Pick<ShopProduct, "badgeBest" | "badgeNew">; className?: string }) {
  if (!p.badgeBest && !p.badgeNew) return null;
  return (
    <span className={`flex gap-1 ${className}`}>
      {p.badgeBest && <span className="rounded-md bg-accent-400 px-1.5 py-0.5 text-[10px] font-bold leading-none text-brand-700">ขายดี</span>}
      {p.badgeNew && <span className="rounded-md bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">ใหม่</span>}
    </span>
  );
}

/** การ์ดสินค้าในกริด 2 คอลัมน์ */
export function ProductCard({ p, tiers }: { p: ShopProduct; tiers: A5Tier[] }) {
  const range = p.pricing === "fixed" ? fixedPriceRange(p) : a5PriceRange(tiers, p.sizes.map((s) => s.surcharge));
  const cover = p.images[0]?.thumbUrl ?? p.designs.find((d) => d.thumbUrl)?.thumbUrl ?? null;
  return (
    <Link href={`/p/${p.id}`} className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-line transition active:scale-[0.98]">
      <span className="relative block aspect-square bg-gray-50">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />
        )}
        <Badges p={p} className="absolute left-1.5 top-1.5" />
      </span>
      <span className="flex flex-1 flex-col p-2.5">
        <span className="line-clamp-2 text-sm leading-snug">{p.name}</span>
        <span className="mt-auto flex items-end justify-between gap-1 pt-1.5">
          <span className="text-base font-bold text-brand-600">
            <span className="text-xs font-normal text-muted">เริ่ม </span>
            {baht0(range.min)}
          </span>
          {p.sold > 0 && <span className="text-[11px] text-muted">ขายแล้ว {p.sold.toLocaleString("th-TH")}</span>}
        </span>
      </span>
    </Link>
  );
}

export function ProductGrid({ products, tiers }: { products: ShopProduct[]; tiers: A5Tier[] }) {
  if (!products.length) return <p className="py-10 text-center text-sm text-muted">ยังไม่มีสินค้า</p>;
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {products.map((p) => (
        <ProductCard key={p.id} p={p} tiers={tiers} />
      ))}
    </div>
  );
}

/** ช่องค้นหาด้านบน (ส่งไปหน้าหมวดหมู่) */
export function SearchBar({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form action="/category" className="relative">
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-4-4" strokeLinecap="round" />
      </svg>
      <input
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="ค้นหาสติกเกอร์ ชื่อลาย หรือรหัส"
        aria-label="ค้นหาสินค้า"
        className="input !rounded-full !pl-10"
      />
    </form>
  );
}

/** ตารางราคาส่ง A5 */
export function A5PriceTable({ tiers, surcharge = 0, current }: { tiers: A5Tier[]; surcharge?: number; current?: number }) {
  const list = [...tiers].sort((a, b) => a.min - b.min);
  return (
    <div className="grid grid-cols-2 gap-1.5 text-sm sm:grid-cols-4">
      {list.map((t, i) => {
        const next = list[i + 1]?.min;
        const on = current !== undefined && current >= t.min && (!next || current < next);
        return (
          <div key={t.min} className={`rounded-xl px-2 py-1.5 text-center ring-1 ${on ? "bg-brand-50 ring-brand-500" : "ring-line"}`}>
            <p className="text-xs text-muted">{next ? `${t.min}–${next - 1} แผ่น` : `${t.min}+ แผ่น`}</p>
            <p className={`font-bold ${on ? "text-brand-600" : ""}`}>{baht0(t.price + surcharge)}</p>
          </div>
        );
      })}
    </div>
  );
}
