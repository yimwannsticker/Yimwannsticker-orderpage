import { NextResponse } from "next/server";
import { fileExt } from "@/lib/constants";
import { bad, readJson } from "@/lib/server/http";
import { signedUrls, type ItemRow } from "@/lib/server/orders";
import { sign, type FileGrant } from "@/lib/server/signed-cookie";
import { resolveCustomer } from "@/lib/server/customer-lookup";
import { rememberMe } from "@/lib/server/me";

const GRANT_DAYS = 7;

/**
 * "ไฟล์ที่เคยสั่ง": ยืนยันด้วยชื่อผู้รับ + เบอร์โทร แล้วคืนรายการไฟล์ทุกไฟล์ที่ยังเก็บอยู่
 * แสดงแค่รูปตัวอย่าง ไม่ให้ดาวน์โหลดไฟล์ต้นฉบับ
 */
export async function POST(req: Request) {
  const v = await resolveCustomer(req, await readJson<{ name: string; phone: string }>(req));
  if (!v.ok) return bad(v.error, v.status);
  const { phone, orders } = v;

  // ไฟล์เดียวกันที่สั่งหลายครั้ง แสดงครั้งเดียว ใช้ข้อมูลจากครั้งล่าสุด
  const seen = new Map<string, { item: ItemRow; orderNo: string; date: string; times: number }>();
  for (const o of orders) {
    for (const it of [...o.order_items].sort((a, b) => a.position - b.position)) {
      if (!it.file_path) continue;
      const cur = seen.get(it.file_path);
      if (cur) cur.times++;
      else seen.set(it.file_path, { item: it, orderNo: o.order_no, date: o.created_at, times: 1 });
    }
  }
  const list = [...seen.values()];
  const previews = await signedUrls(list.map((f) => f.item.preview_path), 60 * 60 * 24);
  const exp = Date.now() + GRANT_DAYS * 86400_000;

  const res = NextResponse.json({
    customer: { name: v.fullName, phone },
    files: list.map(({ item, orderNo, date, times }) => ({
      grant: sign({ i: item.id, p: phone, exp } satisfies FileGrant),
      itemId: item.id,
      fileName: item.file_name,
      fileSize: item.file_size,
      fileType: fileExt(item.file_name),
      previewUrl: item.preview_path ? (previews[item.preview_path] ?? null) : null,
      check: item.check_result,
      product: item.product,
      finish: item.finish,
      qty: item.qty,
      shape: item.shape,
      widthMm: item.width_mm === null ? null : Number(item.width_mm),
      heightMm: item.height_mm === null ? null : Number(item.height_mm),
      orderNo,
      date,
      times,
      prevApproved: item.fix_service || item.accept_risk,
      prevFixed: item.fix_service,
    })),
  });
  return rememberMe(res, phone, v.fullName);
}
