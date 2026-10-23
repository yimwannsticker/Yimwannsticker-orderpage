import Link from "next/link";
import { sortedA5Tiers } from "@/lib/a5-pricing";
import { requireStaff } from "@/lib/server/auth";
import { getSettings } from "@/lib/server/settings";
import { db } from "@/lib/supabase/admin";
import { ShopeeImporter } from "./importer";

export const dynamic = "force-dynamic";

export default async function ShopeeImportPage() {
  await requireStaff("admin");
  const [{ data: cats }, settings] = await Promise.all([
    db().from("shop_categories").select("id, name").order("position"),
    getSettings(),
  ]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">นำเข้าสินค้าจาก Shopee</h1>
        <Link href="/admin/shop" className="btn-secondary btn-sm">
          กลับไปหน้าสินค้า
        </Link>
      </div>
      <ShopeeImporter categories={cats ?? []} a5BasePrice={sortedA5Tiers(settings.a5Tiers)[0]?.price ?? 15} />
    </div>
  );
}
