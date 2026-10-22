import "server-only";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { db } from "../supabase/admin";
import { LINE_COOKIE, ME_COOKIE, ME_DAYS, sign, verify, type LineSession, type MeSession } from "./signed-cookie";

export async function getMe(): Promise<MeSession | null> {
  const store = await cookies();
  const s = verify<MeSession>(store.get(ME_COOKIE)?.value);
  return s && s.exp > Date.now() ? s : null;
}

/** จำลูกค้าไว้ในเครื่องนี้ (ต่ออายุทุกครั้งที่ใช้) */
export function rememberMe(res: NextResponse, phone: string, name: string) {
  const exp = Date.now() + ME_DAYS * 86400_000;
  res.cookies.set(ME_COOKIE, sign({ p: phone, n: name, exp } satisfies MeSession), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: ME_DAYS * 86400,
    path: "/",
  });
  return res;
}

export async function getLine(): Promise<LineSession | null> {
  const store = await cookies();
  return verify<LineSession>(store.get(LINE_COOKIE)?.value);
}

/** ลูกค้าที่เคยผูก LINE นี้ไว้ (ถ้าผูกหลายเบอร์ เอาเบอร์ที่สั่งล่าสุด) */
export async function customerByLine(userId: string): Promise<{ phone: string; name: string } | null> {
  const { data: custs } = await db().from("customers").select("phone, name").eq("line_user_id", userId);
  if (!custs?.length) return null;
  const { data: last } = await db()
    .from("orders")
    .select("customer_phone, customer_name")
    .in(
      "customer_phone",
      custs.map((c) => c.phone),
    )
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last) return { phone: last.customer_phone, name: last.customer_name };
  return { phone: custs[0].phone, name: custs[0].name ?? "" };
}

/** ผูก LINE กับเบอร์ที่ยืนยันแล้ว (ไม่ทับถ้าเบอร์นี้ผูก LINE อื่นไว้แล้ว) */
export async function linkLine(phone: string, userId: string) {
  await db().from("customers").update({ line_user_id: userId }).eq("phone", phone).is("line_user_id", null);
}

/** ยืนยันชื่อ + เบอร์สำเร็จ และเครื่องนี้ล็อกอิน LINE อยู่ → ผูกให้ ครั้งหน้าเข้าด้วย LINE จากเครื่องไหนก็จำได้ */
export async function linkLineIfLoggedIn(phone: string) {
  const line = await getLine();
  if (line) await linkLine(phone, line.userId);
}
