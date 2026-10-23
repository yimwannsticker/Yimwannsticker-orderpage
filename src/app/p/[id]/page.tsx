import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductView } from "@/components/shop/ProductView";
import { getSettings, toPublic } from "@/lib/server/settings";
import { getCatalog } from "@/lib/server/shop";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = (await getCatalog()).products.find((x) => x.id === id);
  return { title: p ? `${p.name} | Yimwann Sticker` : "ไม่พบสินค้า" };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [settings, catalog] = await Promise.all([getSettings(), getCatalog()]);
  const product = catalog.products.find((x) => x.id === id);
  if (!product) notFound();
  const category = catalog.categories.find((c) => c.id === product.categoryId) ?? null;
  return <ProductView product={product} category={category} settings={toPublic(settings)} />;
}
