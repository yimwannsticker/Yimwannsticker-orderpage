import { NextResponse } from "next/server";
import { resolveCustomer } from "@/lib/server/customer-lookup";
import { bad, readJson } from "@/lib/server/http";
import { linkLineIfLoggedIn, rememberMe } from "@/lib/server/me";
import { db } from "@/lib/supabase/admin";

/**
 * ออเดอร์ของฉัน: เครื่องที่จำลูกค้าไว้แล้วดูได้เลย
 * ไม่งั้นต้องยืนยันชื่อผู้รับ + เบอร์โทร (กันคนอื่นใส่เบอร์แล้วเห็นออเดอร์)
 */
export async function POST(req: Request) {
  const v = await resolveCustomer(req, await readJson<{ name?: string; phone?: string }>(req));
  if (!v.ok) return bad(v.error, v.status);
  if (!v.fromCookie) await linkLineIfLoggedIn(v.phone);
  const { data } = await db()
    .from("orders")
    .select("token, order_no, status, total, total_sheets, free_sheets, a5_sheets, created_at, tracking_no, order_items(count)")
    .eq("customer_phone", v.phone)
    .order("created_at", { ascending: false })
    .limit(50);
  const orders = (data ?? []).map((o) => ({
    token: o.token,
    orderNo: o.order_no,
    status: o.status,
    total: Number(o.total),
    a3Sheets: o.total_sheets,
    freeSheets: o.free_sheets,
    a5Sheets: o.a5_sheets ?? 0,
    files: (o.order_items as unknown as { count: number }[])[0]?.count ?? 0,
    createdAt: o.created_at,
    trackingNo: o.tracking_no,
  }));
  return rememberMe(NextResponse.json({ name: v.fullName, phone: v.phone, orders }), v.phone, v.fullName);
}
