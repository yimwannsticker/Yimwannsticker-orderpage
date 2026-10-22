import { NextResponse } from "next/server";
import { getLine, getMe } from "@/lib/server/me";
import { getPoints } from "@/lib/server/orders";
import { LINE_COOKIE, ME_COOKIE } from "@/lib/server/signed-cookie";

/** ลูกค้าที่เครื่องนี้จำไว้ + ยอดสะสม */
export async function GET() {
  const me = await getMe();
  if (!me) return NextResponse.json({ me: null });
  const [pts, line] = await Promise.all([getPoints(me.p), getLine()]);
  return NextResponse.json({
    me: { name: me.n, phone: me.p, points: pts.points, pending: pts.pending, picture: line?.picture ?? null },
  });
}

/** "ไม่ใช่ฉัน" → ลืมลูกค้าในเครื่องนี้ (ออกจาก LINE ด้วย) */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ME_COOKIE);
  res.cookies.delete(LINE_COOKIE);
  return res;
}
