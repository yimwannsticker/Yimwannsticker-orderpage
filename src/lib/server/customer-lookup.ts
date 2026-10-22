import "server-only";
import { isValidPhone, normalizePhone } from "@/lib/format";
import { nameMatches } from "@/lib/name-match";
import { db } from "@/lib/supabase/admin";
import type { ItemRow } from "./orders";
import type { Address } from "@/lib/types";

const WINDOW_MS = 15 * 60_000;
const MAX_FAIL_PER_PHONE = 5;
const MAX_FAIL_PER_IP = 20;

export interface PastOrder {
  id: string;
  order_no: string;
  customer_name: string;
  address: Address;
  created_at: string;
  status: string;
  order_items: ItemRow[];
}

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
 * ยืนยันลูกค้าเก่าด้วยชื่อผู้รับ + เบอร์โทร (จำกัดจำนวนครั้งที่ผิด)
 * ผ่านเมื่อมีออเดอร์ของเบอร์นี้อย่างน้อย 1 ออเดอร์ที่ชื่อผู้รับตรง แล้วคืนทุกออเดอร์ของเบอร์นี้ เรียงล่าสุดก่อน
 */
export async function verifyCustomer(
  req: Request,
  input: { name?: string; phone?: string } | null,
): Promise<{ ok: true; phone: string; name: string; orders: PastOrder[] } | { ok: false; error: string; status: number }> {
  const phone = normalizePhone(input?.phone ?? "");
  const name = (input?.name ?? "").trim();
  if (!name || !isValidPhone(phone)) return { ok: false, error: "กรุณากรอกชื่อผู้รับและเบอร์โทรให้ถูกต้อง", status: 400 };

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const [byPhone, byIp] = await Promise.all([failures(`phone:${phone}`), failures(`ip:${ip}`)]);
  if (byPhone >= MAX_FAIL_PER_PHONE || byIp >= MAX_FAIL_PER_IP)
    return { ok: false, error: "ลองหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่", status: 429 };

  const { data } = await db()
    .from("orders")
    .select("id, order_no, customer_name, address, created_at, status, order_items(*)")
    .eq("customer_phone", phone)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(100);
  const orders = (data ?? []) as PastOrder[];
  const ok = orders.some((o) => nameMatches(name, o.customer_name));

  // เบอร์ที่ไม่เคยสั่งเลย = ลูกค้าใหม่ ไม่นับเป็นการเดาผิด
  if (orders.length > 0) {
    await db()
      .from("lookup_attempts")
      .insert([
        { key: `phone:${phone}`, ok },
        { key: `ip:${ip}`, ok },
      ]);
  }
  if (!ok) return { ok: false, error: "ไม่พบข้อมูลที่ตรงกับชื่อและเบอร์โทรนี้ กรุณาตรวจสอบชื่อผู้รับที่ใช้ตอนสั่ง", status: 404 };
  return { ok: true, phone, name, orders };
}
