import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "../supabase/admin";
import type { ShopCatalog, ShopProduct } from "../shop-types";
import { imageUrl } from "./storage";

export const CATALOG_TAG = "catalog";

export interface ProductRow {
  id: string;
  category_id: string | null;
  name: string;
  description: string;
  pieces_per_sheet: number | null;
  material: string;
  design_code: string;
  designer_id: string | null;
  images: { path: string; thumb: string }[];
  badge_best: boolean;
  badge_new: boolean;
  active: boolean;
  position: number;
  created_at: string;
  shop_product_sizes: { id: string; name: string; surcharge: number; position: number }[];
  shop_designs: {
    id: string;
    name: string;
    sku: string;
    image_path: string | null;
    thumb_path: string | null;
    active: boolean;
    position: number;
  }[];
}

const PRODUCT_SELECT =
  "id, category_id, name, description, pieces_per_sheet, material, design_code, designer_id, images, badge_best, badge_new, active, position, created_at, shop_product_sizes(id, name, surcharge, position), shop_designs(id, name, sku, image_path, thumb_path, active, position)";

const byPos = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

/** ข้อมูลร้าน (แคชไว้ แอดมินแก้สินค้าแล้วล้างแคชด้วย updateTag) */
const loadCatalog = unstable_cache(
  async () => {
    const [cats, prods, sold] = await Promise.all([
      db().from("shop_categories").select("id, name, icon_path, position").order("position"),
      db().from("shop_products").select(PRODUCT_SELECT).eq("active", true).order("position"),
      db().from("shop_product_sold").select("product_id, sold"),
    ]);
    const soldBy = new Map((sold.data ?? []).map((r) => [r.product_id as string, Number(r.sold) || 0]));
    return {
      categories: (cats.data ?? []) as { id: string; name: string; icon_path: string | null; position: number }[],
      products: ((prods.data ?? []) as unknown as ProductRow[])
        // สินค้าที่ยังไม่มีลายเปิดขายเลย ยังไม่แสดง
        .filter((p) => p.shop_designs.some((d) => d.active))
        .map((p) => ({ ...p, sold: soldBy.get(p.id) ?? 0 })),
    };
  },
  ["shop-catalog"],
  { tags: [CATALOG_TAG], revalidate: 600 },
);

async function toProduct(p: ProductRow & { sold: number }): Promise<ShopProduct> {
  const images = await Promise.all(
    (p.images ?? []).map(async (im) => ({ url: (await imageUrl(im.path))!, thumbUrl: (await imageUrl(im.thumb || im.path))! })),
  );
  const designs = await Promise.all(
    [...p.shop_designs].sort(byPos).map(async (d) => ({
      id: d.id,
      name: d.name,
      sku: d.sku,
      imageUrl: await imageUrl(d.image_path),
      thumbUrl: await imageUrl(d.thumb_path || d.image_path),
      active: d.active,
    })),
  );
  return {
    id: p.id,
    categoryId: p.category_id,
    name: p.name,
    description: p.description,
    piecesPerSheet: p.pieces_per_sheet,
    material: p.material,
    images,
    badgeBest: p.badge_best,
    badgeNew: p.badge_new,
    sold: p.sold,
    createdAt: p.created_at,
    position: p.position,
    sizes: [...p.shop_product_sizes].sort(byPos).map((s) => ({ id: s.id, name: s.name, surcharge: Number(s.surcharge) || 0 })),
    designs,
  };
}

/** ข้อมูลร้านพร้อมลิงก์รูป */
export async function getCatalog(): Promise<ShopCatalog> {
  const c = await loadCatalog();
  const [categories, products] = await Promise.all([
    Promise.all(c.categories.map(async (x) => ({ id: x.id, name: x.name, iconUrl: await imageUrl(x.icon_path) }))),
    Promise.all(c.products.map(toProduct)),
  ]);
  return { categories, products };
}
