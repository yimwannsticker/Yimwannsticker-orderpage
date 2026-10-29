import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/server/shop";

/**
 * รูปที่ขึ้นตอนแชร์ลิงก์ใน LINE / Facebook (ลิงก์คงที่ ส่งต่อไปรูปจริงใน R2)
 * ?p=<id สินค้า> รูปปกสินค้า · ไม่ระบุ = รูปโลโก้ร้าน
 */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("p");
  const catalog = await getCatalog();
  let url: string | null = null;
  if (id) {
    const p = catalog.products.find((x) => x.id === id);
    url = p ? (p.images[0]?.url ?? p.designs.find((d) => d.imageUrl)?.imageUrl ?? null) : null;
  }
  // ไม่ระบุสินค้า หรือสินค้าไม่มีรูป: ใช้รูปโลโก้ร้าน
  if (!url) return NextResponse.redirect(new URL("/brand/og.png", req.url), { status: 302, headers: { "Cache-Control": "public, max-age=3600" } });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "public, max-age=3600" } });
}
