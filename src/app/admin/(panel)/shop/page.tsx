import Link from "next/link";
import { requireStaff } from "@/lib/server/auth";
import { imageUrl } from "@/lib/server/storage";
import { db } from "@/lib/supabase/admin";
import { CategoryManager, DesignerManager, ProductList } from "./client";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "products", label: "สินค้า" },
  { key: "categories", label: "หมวดหมู่" },
  { key: "designers", label: "กราฟิก" },
];

export default async function ShopAdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireStaff("admin");
  const tab = (await searchParams).tab ?? "products";
  const [{ data: cats }, { data: designers }, { data: products }, { data: sold }] = await Promise.all([
    db().from("shop_categories").select("id, name, icon_path, position").order("position"),
    db().from("designers").select("id, name, active").order("created_at"),
    db()
      .from("shop_products")
      .select("id, name, category_id, designer_id, images, badge_best, badge_new, active, position, shop_designs(id, active)")
      .order("position"),
    db().from("shop_product_sold").select("product_id, sold"),
  ]);
  const soldBy = new Map((sold ?? []).map((r) => [r.product_id as string, Number(r.sold)]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">สติกเกอร์สำเร็จรูป A5</h1>
        <div className="flex gap-2">
          <Link href="/admin/reports" className="btn-secondary btn-sm">
            รายงานยอดขาย
          </Link>
          <Link href="/admin/shop/new" className="btn-primary btn-sm">
            + เพิ่มสินค้า
          </Link>
        </div>
      </div>
      <div className="flex gap-1">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/shop?tab=${t.key}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === t.key ? "bg-brand-500 text-white" : "bg-white ring-1 ring-line"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "products" && (
        <ProductList
          categories={(cats ?? []).map((c) => ({ id: c.id, name: c.name }))}
          products={await Promise.all(
            (products ?? []).map(async (p) => {
              const designs = p.shop_designs as { id: string; active: boolean }[];
              const cover = (p.images as { path: string; thumb: string }[])[0];
              return {
                id: p.id,
                name: p.name,
                categoryId: p.category_id,
                coverUrl: cover ? await imageUrl(cover.thumb || cover.path) : null,
                designs: designs.length,
                activeDesigns: designs.filter((d) => d.active).length,
                badgeBest: p.badge_best,
                badgeNew: p.badge_new,
                active: p.active,
                sold: soldBy.get(p.id) ?? 0,
              };
            }),
          )}
        />
      )}
      {tab === "categories" && (
        <CategoryManager
          initial={await Promise.all(
            (cats ?? []).map(async (c) => ({ id: c.id, name: c.name, iconPath: c.icon_path, iconUrl: await imageUrl(c.icon_path) })),
          )}
          counts={Object.fromEntries((cats ?? []).map((c) => [c.id, (products ?? []).filter((p) => p.category_id === c.id).length]))}
        />
      )}
      {tab === "designers" && (
        <DesignerManager
          initial={designers ?? []}
          counts={Object.fromEntries((designers ?? []).map((d) => [d.id, (products ?? []).filter((p) => p.designer_id === d.id).length]))}
        />
      )}
    </div>
  );
}
