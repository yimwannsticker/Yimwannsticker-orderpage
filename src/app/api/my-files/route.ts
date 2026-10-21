import { NextResponse } from "next/server";
import { fileExt } from "@/lib/constants";
import { isValidPhone, normalizePhone } from "@/lib/format";
import { nameMatches } from "@/lib/name-match";
import { bad, readJson } from "@/lib/server/http";
import { signedUrls, type ItemRow } from "@/lib/server/orders";
import { sign, type FileGrant } from "@/lib/server/signed-cookie";
import { db } from "@/lib/supabase/admin";

const WINDOW_MS = 15 * 60_000;
const MAX_FAIL_PER_PHONE = 5;
const MAX_FAIL_PER_IP = 20;
const GRANT_DAYS = 7;

async function failures(key: string) {
  const { count } = await db()
    .from("lookup_attempts")
    .select("id", { count: "exact", head: true })
    .eq("key", key)
    .eq("ok", false)
    .gte("created_at", new Date(Date.now() - WINDOW_MS).toISOString());
  return count ?? 0;
}

/**
 * "ไฟล์ที่เคยสั่ง": ยืนยันด้วยชื่อผู้รับ + เบอร์โทร แล้วคืนรายการไฟล์ทุกไฟล์ที่ยังเก็บอยู่
 * แสดงแค่รูปตัวอย่าง ไม่ให้ดาวน์โหลดไฟล์ต้นฉบับ และไม่ส่งที่อยู่กลับไป
 */
export async function POST(req: Request) {
  const body = await readJson<{ name: string; phone: string }>(req);
  const phone = normalizePhone(body?.phone ?? "");
  const name = (body?.name ?? "").trim();
  if (!name || !isValidPhone(phone)) return bad("กรุณากรอกชื่อผู้รับและเบอร์โทรให้ถูกต้อง");

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const [byPhone, byIp] = await Promise.all([failures(`phone:${phone}`), failures(`ip:${ip}`)]);
  if (byPhone >= MAX_FAIL_PER_PHONE || byIp >= MAX_FAIL_PER_IP)
    return bad("ลองหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่", 429);

  const { data: orders } = await db()
    .from("orders")
    .select("id, order_no, customer_name, created_at, status, order_items(*)")
    .eq("customer_phone", phone)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(100);
  const ok = (orders ?? []).some((o) => nameMatches(name, o.customer_name));

  await db()
    .from("lookup_attempts")
    .insert([
      { key: `phone:${phone}`, ok },
      { key: `ip:${ip}`, ok },
    ]);
  if (!ok) return bad("ไม่พบไฟล์ที่ตรงกับชื่อและเบอร์โทรนี้ กรุณาตรวจสอบชื่อผู้รับที่ใช้ตอนสั่ง", 404);

  // ไฟล์เดียวกันที่สั่งหลายครั้ง แสดงครั้งเดียว ใช้ข้อมูลจากครั้งล่าสุด
  const seen = new Map<string, { item: ItemRow; orderNo: string; date: string; times: number }>();
  for (const o of orders ?? []) {
    for (const it of (o.order_items as ItemRow[]).sort((a, b) => a.position - b.position)) {
      if (!it.file_path) continue;
      const cur = seen.get(it.file_path);
      if (cur) cur.times++;
      else seen.set(it.file_path, { item: it, orderNo: o.order_no, date: o.created_at, times: 1 });
    }
  }
  const list = [...seen.values()];
  const previews = await signedUrls(list.map((f) => f.item.preview_path), 60 * 60 * 24);
  const exp = Date.now() + GRANT_DAYS * 86400_000;

  return NextResponse.json({
    customer: { name: orders![0].customer_name, phone },
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
      orderNo,
      date,
      times,
      prevApproved: item.fix_service || item.accept_risk,
      prevFixed: item.fix_service,
    })),
  });
}
