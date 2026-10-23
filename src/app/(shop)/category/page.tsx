import Link from "next/link";
import { ProductGrid, SearchBar } from "@/components/shop/parts";
import { getSettings } from "@/lib/server/settings";
import { getCatalog } from "@/lib/server/shop";
import { SORTS, searchProducts, sortProducts, type ShopSort } from "@/lib/shop-types";

export const dynamic = "force-dynamic";

export default async function CategoryPage({ searchParams }: { searchParams: Promise<{ c?: string; sort?: string; q?: string }> }) {
  const sp = await searchParams;
  const [settings, catalog] = await Promise.all([getSettings(), getCatalog()]);
  const sort: ShopSort = SORTS.some((s) => s.key === sp.sort) ? (sp.sort as ShopSort) : "best";
  const q = (sp.q ?? "").trim();
  const cat = catalog.categories.find((c) => c.id === sp.c) ?? null;

  let list = cat ? catalog.products.filter((p) => p.categoryId === cat.id) : catalog.products;
  list = sortProducts(searchProducts(list, q), sort);

  const href = (p: { c?: string | null; sort?: string }) => {
    const u = new URLSearchParams();
    const c = p.c === undefined ? cat?.id : p.c;
    if (c) u.set("c", c);
    const s = p.sort ?? sort;
    if (s !== "best") u.set("sort", s);
    if (q) u.set("q", q);
    const qs = u.toString();
    return `/category${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <div className="sticky top-0 z-10 space-y-2 bg-[#f7f7fa]/95 px-4 pb-2 pt-3 backdrop-blur">
        <SearchBar defaultValue={q} />
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="หมวดหมู่">
          {[{ id: null as string | null, name: "ทั้งหมด" }, ...catalog.categories].map((c) => {
            const on = (cat?.id ?? null) === c.id;
            return (
              <Link
                key={c.id ?? "all"}
                href={href({ c: c.id })}
                role="tab"
                aria-selected={on}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${on ? "bg-brand-500 text-white" : "bg-white ring-1 ring-line"}`}
              >
                {c.name}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-1 text-sm">
          <span className="mr-1 text-muted">เรียง:</span>
          {SORTS.map((s) => (
            <Link
              key={s.key}
              href={href({ sort: s.key })}
              className={`rounded-lg px-2.5 py-1 ${sort === s.key ? "bg-brand-50 font-semibold text-brand-700" : "text-muted"}`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="px-4 pt-1">
        {q && (
          <p className="mb-2 text-sm text-muted">
            ผลการค้นหา &quot;{q}&quot; {list.length} รายการ ·{" "}
            <Link href={href({}).replace(/([?&])q=[^&]*/, "$1").replace(/[?&]$/, "")} className="text-brand-600 underline">
              ล้างคำค้น
            </Link>
          </p>
        )}
        <ProductGrid products={list} tiers={settings.a5Tiers} />
      </div>
    </div>
  );
}
