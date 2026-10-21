import { OrderPage } from "@/components/order/OrderPage";
import { getSettings, toPublic } from "@/lib/server/settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const settings = toPublic(await getSettings());
  return <OrderPage settings={settings} />;
}
