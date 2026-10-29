import Link from "next/link";
import { redirect } from "next/navigation";
import { Banners } from "@/components/shop/Banners";
import { Logo } from "@/components/Logo";
import { HomeGreeting } from "@/components/shop/HomeGreeting";
import { ProductGrid, SearchBar } from "@/components/shop/parts";
import { getSettings } from "@/lib/server/settings";
import { getCatalog } from "@/lib/server/shop";
import { imageUrl } from "@/lib/server/storage";
import { sortProducts } from "@/lib/shop-types";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  // ลิงก์เดิมของหน้าสั่งพิมพ์ (สั่งซ้ำ/กลับจาก LINE ระหว่างกรอกที่อยู่)
  if (sp.reorder || sp.step) redirect(`/print?${new URLSearchParams(sp as Record<string, string>)}`);
  const [settings, catalog] = await Promise.all([getSettings(), getCatalog()]);
  const banners = (
    await Promise.all(settings.banners.map(async (b) => ({ url: (await imageUrl(b.path)) ?? "", link: b.link })))
  ).filter((b) => b.url);
  const products = sortProducts(catalog.products, "best");

  return (
    <div className="space-y-4 px-4 pt-3">
      <header className="flex items-center justify-between">
        <Link href="/" aria-label={settings.shopName}>
          <Logo className="h-9" />
        </Link>
        <Link href="/track" className="text-sm font-medium text-brand-600">
          เช็คสถานะ
        </Link>
      </header>
      <SearchBar />
      <HomeGreeting messages={settings.welcomeMessages} />
      <Banners items={banners} />

      {catalog.categories.length > 0 && (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {catalog.categories.map((c) => (
            <Link key={c.id} href={`/category?c=${c.id}`} className="flex w-16 shrink-0 flex-col items-center gap-1 text-center">
              <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-accent-50 text-lg font-bold text-brand-700 ring-1 ring-accent-100">
                {c.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.iconUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  c.name.slice(0, 1)
                )}
              </span>
              <span className="line-clamp-2 text-[11px] leading-tight">{c.name}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <Link href="/category" className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 p-4 text-white shadow-sm active:scale-[0.98]">
          <p className="text-2xl">🛍️</p>
          <p className="mt-1 font-bold leading-tight">สติกเกอร์สำเร็จรูป A5</p>
          <p className="mt-0.5 text-xs text-accent-100">เลือกลาย คละได้ทั้งร้าน</p>
        </Link>
        <Link href="/print" className="rounded-2xl bg-accent-400 p-4 shadow-sm active:scale-[0.98]">
          <p className="text-2xl">🖨️</p>
          <p className="mt-1 font-bold leading-tight text-brand-700">สั่งพิมพ์ไฟล์ตัวเอง A3+</p>
          <p className="mt-0.5 text-xs text-brand-700/80">อัปโหลดไฟล์ ตรวจไฟล์ให้</p>
        </Link>
      </div>

      <section>
        <h2 className="mb-2 font-bold">สติกเกอร์แนะนำ</h2>
        <ProductGrid products={products} tiers={settings.a5Tiers} />
      </section>
    </div>
  );
}
