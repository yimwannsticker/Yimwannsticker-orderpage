import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductView } from "@/components/shop/ProductView";
import { getSettings, toPublic } from "@/lib/server/settings";
import { getCatalog } from "@/lib/server/shop";
import { a5PriceRange } from "@/lib/a5-pricing";
import { fixedPriceRange } from "@/lib/shop-types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const [p, settings] = await Promise.all([getCatalog().then((c) => c.products.find((x) => x.id === id)), getSettings()]);
  if (!p) return { title: "ไม่พบสินค้า" };
  const title = `${p.name} | Yimwann Sticker`;
  // ข้อความตอนแชร์ลิงก์: ราคาเริ่มต้น จำนวนลาย และสเปก
  const from =
    p.pricing === "fixed"
      ? `เริ่ม ${fixedPriceRange(p).min} บาท/${p.unitLabel}`
      : `เริ่ม ${a5PriceRange(settings.a5Tiers, p.sizes.map((s) => s.surcharge)).min} บาท/แผ่น A5`;
  const description = [
    from,
    `${p.designs.filter((d) => d.active).length} ลาย`,
    p.piecesPerSheet ? `${p.piecesPerSheet} ดวง/แผ่น` : null,
    p.material || null,
    p.pricing === "a5" ? "คละลายได้ทั้งร้าน" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    title,
    description,
    openGraph: { title: p.name, description, siteName: "Yimwann Sticker", locale: "th_TH", type: "website", url: `/p/${p.id}`, images: [`/share-image?p=${p.id}`] },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [settings, catalog] = await Promise.all([getSettings(), getCatalog()]);
  const product = catalog.products.find((x) => x.id === id);
  if (!product) notFound();
  const category = catalog.categories.find((c) => c.id === product.categoryId) ?? null;
  return <ProductView product={product} category={category} settings={toPublic(settings)} />;
}
