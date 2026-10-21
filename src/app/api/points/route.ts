import { NextResponse } from "next/server";
import { isValidPhone, normalizePhone } from "@/lib/format";
import { getPoints } from "@/lib/server/orders";

/** ยอดสะสมสำหรับคำนวณโปร (นับรวมออเดอร์ที่รอตรวจสลิปด้วย กันแถมซ้ำ) */
export async function GET(req: Request) {
  const phone = normalizePhone(new URL(req.url).searchParams.get("phone") ?? "");
  if (!isValidPhone(phone)) return NextResponse.json({ points: 0, pending: 0 });
  return NextResponse.json(await getPoints(phone));
}
