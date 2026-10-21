import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/format";
import { bad, readJson } from "@/lib/server/http";
import { db } from "@/lib/supabase/admin";

/** ค้นออเดอร์ด้วยเลขออเดอร์ + เบอร์โทร */
export async function POST(req: Request) {
  const body = await readJson<{ orderNo: string; phone: string }>(req);
  const orderNo = (body?.orderNo || "").trim().toUpperCase().replace(/\s/g, "");
  const phone = normalizePhone(body?.phone || "");
  if (!orderNo || !phone) return bad("กรุณากรอกเลขออเดอร์และเบอร์โทร");
  const { data } = await db()
    .from("orders")
    .select("token")
    .eq("order_no", orderNo.startsWith("YW") ? orderNo : `YW${orderNo}`)
    .eq("customer_phone", phone)
    .maybeSingle();
  if (!data) return bad("ไม่พบออเดอร์ กรุณาตรวจสอบเลขออเดอร์และเบอร์โทรอีกครั้ง", 404);
  return NextResponse.json({ token: data.token });
}
