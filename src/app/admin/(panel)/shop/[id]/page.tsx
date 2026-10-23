import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/server/auth";
import type { ProductRow } from "@/lib/server/shop";
import { imageUrl } from "@/lib/server/storage";
import { db } from "@/lib/supabase/admin";
import { ProductEditor, type EditorProduct } from "./editor";

export const dynamic = "force-dynamic";

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("admin");
  const { id } = await params;
  const [{ data: cats }, { data: designers }] = await Promise.all([
    db().from("shop_categories").select("id, name").order("position"),
    db().from("designers").select("id, name, active").order("created_at"),
  ]);

  let product: EditorProduct = {
    categoryId: null,
    name: "",
    description: "",
    piecesPerSheet: null,
    material: "",
    designCode: "",
    designerId: null,
    images: [],
    badgeBest: false,
    badgeNew: true,
    active: true,
    sizes: [],
    designs: [],
  };
  if (id !== "new") {
    const { data } = await db()
      .from("shop_products")
      .select(
        "*, shop_product_sizes(id, name, surcharge, position), shop_designs(id, name, sku, image_path, thumb_path, active, position)",
      )
      .eq("id", id)
      .maybeSingle();
    if (!data) notFound();
    const p = data as unknown as ProductRow;
    product = {
      id: p.id,
      categoryId: p.category_id,
      name: p.name,
      description: p.description,
      piecesPerSheet: p.pieces_per_sheet,
      material: p.material,
      designCode: p.design_code,
      designerId: p.designer_id,
      images: await Promise.all(
        (p.images ?? []).map(async (im) => ({ path: im.path, thumb: im.thumb, url: (await imageUrl(im.thumb || im.path)) ?? "" })),
      ),
      badgeBest: p.badge_best,
      badgeNew: p.badge_new,
      active: p.active,
      sizes: [...p.shop_product_sizes].sort((a, b) => a.position - b.position).map((s) => ({ id: s.id, name: s.name, surcharge: Number(s.surcharge) })),
      designs: await Promise.all(
        [...p.shop_designs]
          .sort((a, b) => a.position - b.position)
          .map(async (d) => ({
            id: d.id,
            name: d.name,
            sku: d.sku,
            imagePath: d.image_path,
            thumbPath: d.thumb_path,
            url: await imageUrl(d.thumb_path || d.image_path),
            active: d.active,
          })),
      ),
    };
  }
  return <ProductEditor initial={product} categories={cats ?? []} designers={designers ?? []} />;
}
