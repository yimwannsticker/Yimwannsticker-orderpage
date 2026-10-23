import { OrderPage } from "@/components/order/OrderPage";
import { getCatalog } from "@/lib/server/shop";
import { getSettings, toPublic } from "@/lib/server/settings";

export const dynamic = "force-dynamic";

/** สั่งพิมพ์ไฟล์ตัวเอง A3+ และขั้นตอนชำระเงินของตะกร้ารวม */
export default async function PrintPage() {
  const [settings, catalog] = await Promise.all([getSettings(), getCatalog()]);
  return <OrderPage settings={toPublic(settings)} catalog={catalog} />;
}
