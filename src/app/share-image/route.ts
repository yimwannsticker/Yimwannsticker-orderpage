import { NextResponse } from "next/server";
import { getSettings } from "@/lib/server/settings";
import { getCatalog } from "@/lib/server/shop";
import { imageUrl } from "@/lib/server/storage";

/**
 * รูปที่ขึ้นตอนแชร์ลิงก์ใน LINE / Facebook (ลิงก์คงที่ ส่งต่อไปรูปจริงใน R2)
 * ?p=<id สินค้า> รูปปกสินค้า · ไม่ระบุ = แบนเนอร์แรก หรือรูปสินค้าขายดี
 */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("p");
  const catalog = await getCatalog();
  let url: string | null = null;
  if (id) {
    const p = catalog.products.find((x) => x.id === id);
    url = p ? (p.images[0]?.url ?? p.designs.find((d) => d.imageUrl)?.imageUrl ?? null) : null;
  } else {
    const banner = (await getSettings()).banners[0];
    url = banner ? await imageUrl(banner.path) : null;
    url ??= [...catalog.products].sort((a, b) => b.sold - a.sold).find((p) => p.images[0])?.images[0].url ?? null;
  }
  if (!url) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "public, max-age=3600" } });
}
