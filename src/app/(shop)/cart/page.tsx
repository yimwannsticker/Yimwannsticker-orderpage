import { CartView } from "@/components/shop/CartView";
import { getSettings, toPublic } from "@/lib/server/settings";
import { getCatalog } from "@/lib/server/shop";

export const dynamic = "force-dynamic";

export const metadata = { title: "ตะกร้า | Yimwann Sticker" };

export default async function CartPage() {
  const [settings, catalog] = await Promise.all([getSettings(), getCatalog()]);
  return <CartView settings={toPublic(settings)} catalog={catalog} />;
}
