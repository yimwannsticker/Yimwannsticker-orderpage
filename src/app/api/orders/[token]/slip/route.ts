import { NextResponse } from "next/server";
import { STORAGE_BUCKET } from "@/lib/constants";
import { notifyShop, siteUrl } from "@/lib/server/email";
import { bad, readJson } from "@/lib/server/http";
import { getOrderByToken } from "@/lib/server/orders";
import { getSettings } from "@/lib/server/settings";
import { verifySlip } from "@/lib/server/slip";
import { db } from "@/lib/supabase/admin";

/** ส่งสลิปใหม่ หลังร้านแจ้งว่าสลิปไม่ถูกต้อง */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getOrderByToken(token);
  if (!order) return bad("ไม่พบออเดอร์", 404);
  if (order.status !== "pending_slip") return bad("ออเดอร์นี้ชำระเงินแล้ว");
  const body = await readJson<{ uploadId: string }>(req);
  const { data: up } = await db().from("uploads").select("*").eq("id", body?.uploadId ?? "").maybeSingle();
  if (!up || up.kind !== "slip" || up.used) return bad("อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่");

  const settings = await getSettings();
  const update: Record<string, unknown> = {
    slip_path: up.path,
    slip_uploaded_at: new Date().toISOString(),
    slip_rejected_reason: null,
    needs_attention: true,
    attention_note: "ลูกค้าส่งสลิปใหม่",
  };
  if (settings.slipVerify.enabled) {
    const { data: blob } = await db().storage.from(STORAGE_BUCKET).download(up.path);
    const res = blob ? await verifySlip(settings, blob, Number(order.total)) : null;
    if (res) {
      update.slip_verify = res;
      if (res.ok) Object.assign(update, { status: "paid", paid_at: new Date().toISOString() });
    }
  }
  await db().from("orders").update(update).eq("id", order.id);
  await db().from("uploads").update({ used: true }).eq("id", up.id);
  if (order.slip_path) await db().storage.from(STORAGE_BUCKET).remove([order.slip_path]);
  await notifyShop(
    settings.notifyEmail,
    `สลิปใหม่ ${order.order_no}`,
    `ลูกค้าส่งสลิปใหม่สำหรับออเดอร์ ${order.order_no}\n${siteUrl()}/admin/orders/${order.id}`,
  );
  return NextResponse.json({ ok: true });
}
