import { NextResponse } from "next/server";
import { getMe } from "@/lib/server/me";
import { getPoints } from "@/lib/server/orders";
import { ME_COOKIE } from "@/lib/server/signed-cookie";

/** ลูกค้าที่เครื่องนี้จำไว้ + ยอดสะสม */
export async function GET() {
  const me = await getMe();
  if (!me) return NextResponse.json({ me: null });
  const pts = await getPoints(me.p);
  return NextResponse.json({ me: { name: me.n, phone: me.p, points: pts.points, pending: pts.pending } });
}

/** "ไม่ใช่ฉัน" → ลืมลูกค้าในเครื่องนี้ */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ME_COOKIE);
  return res;
}
