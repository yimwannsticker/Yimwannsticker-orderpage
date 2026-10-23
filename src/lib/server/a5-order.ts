import "server-only";
import { db } from "../supabase/admin";

export interface A5OrderLine {
  productId: string;
  designId: string;
  sizeId: string | null;
  qty: number;
  surcharge: number;
  productName: string;
  designName: string;
  sizeName: string | null;
  sku: string;
  designerId: string | null;
  designerName: string | null;
  thumbPath: string | null;
}

const isUuid = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);

/**
 * ตรวจรายการ A5 จาก browser กับข้อมูลร้านล่าสุด (ราคา/ชื่อ/สถานะเปิดขายเชื่อจากฐานข้อมูลเท่านั้น)
 * ลาย+ขนาดเดียวกันรวมจำนวนให้
 */
export async function loadA5Lines(raw: unknown): Promise<{ ok: true; lines: A5OrderLine[] } | { ok: false; error: string }> {
  if (raw == null) return { ok: true, lines: [] };
  if (!Array.isArray(raw) || raw.length > 300) return { ok: false, error: "รายการสติกเกอร์ A5 ไม่ถูกต้อง" };
  const merged = new Map<string, { designId: string; sizeId: string | null; qty: number }>();
  for (const r of raw as { designId?: unknown; sizeId?: unknown; qty?: unknown }[]) {
    const qty = Math.floor(Number(r?.qty));
    if (!isUuid(r?.designId) || !(qty > 0) || qty > 100000) return { ok: false, error: "รายการสติกเกอร์ A5 ไม่ถูกต้อง" };
    const sizeId = isUuid(r.sizeId) ? r.sizeId : null;
    const key = `${r.designId}|${sizeId}`;
    const cur = merged.get(key);
    merged.set(key, { designId: r.designId, sizeId, qty: (cur?.qty ?? 0) + qty });
  }
  const want = [...merged.values()];
  if (!want.length) return { ok: true, lines: [] };

  const { data, error } = await db()
    .from("shop_designs")
    .select(
      "id, name, sku, thumb_path, image_path, active, shop_products(id, name, active, designer_id, designers(name), shop_product_sizes(id, name, surcharge))",
    )
    .in("id", [...new Set(want.map((w) => w.designId))]);
  if (error) return { ok: false, error: "ตรวจรายการสติกเกอร์ A5 ไม่สำเร็จ กรุณาลองใหม่" };

  type Row = {
    id: string;
    name: string;
    sku: string;
    thumb_path: string | null;
    image_path: string | null;
    active: boolean;
    shop_products: {
      id: string;
      name: string;
      active: boolean;
      designer_id: string | null;
      designers: { name: string } | null;
      shop_product_sizes: { id: string; name: string; surcharge: number }[];
    } | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  const lines: A5OrderLine[] = [];
  for (const w of want) {
    const d = rows.find((x) => x.id === w.designId);
    const p = d?.shop_products;
    if (!d || !p || !p.active) return { ok: false, error: "มีสติกเกอร์ A5 ในตะกร้าที่ปิดขายแล้ว กรุณาลบออกในตะกร้า" };
    if (!d.active) return { ok: false, error: `ลาย ${d.sku} หมดชั่วคราว กรุณาลบออกในตะกร้า` };
    const sizes = p.shop_product_sizes ?? [];
    const size = sizes.find((s) => s.id === w.sizeId) ?? null;
    if (sizes.length && !size) return { ok: false, error: `ขนาดของลาย ${d.sku} ไม่มีแล้ว กรุณาเลือกใหม่` };
    lines.push({
      productId: p.id,
      designId: d.id,
      sizeId: size?.id ?? null,
      qty: w.qty,
      surcharge: Number(size?.surcharge) || 0,
      productName: p.name,
      designName: d.name,
      sizeName: size?.name ?? null,
      sku: d.sku,
      designerId: p.designer_id,
      designerName: p.designers?.name ?? null,
      thumbPath: d.thumb_path || d.image_path,
    });
  }
  // เรียงตาม SKU ให้หยิบของง่าย
  lines.sort((a, b) => a.sku.localeCompare(b.sku, "th", { numeric: true }));
  return { ok: true, lines };
}
