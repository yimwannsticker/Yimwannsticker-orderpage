import { NextResponse } from "next/server";
import { notifyShop, siteUrl } from "@/lib/server/email";
import { bad, readJson } from "@/lib/server/http";
import { getOrderByToken, removeIfUnreferenced } from "@/lib/server/orders";
import { getSettings } from "@/lib/server/settings";
import { db } from "@/lib/supabase/admin";

/** ลูกค้าส่งไฟล์ใหม่แทนไฟล์ที่ร้านขอให้แก้ */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await getOrderByToken(token);
  if (!order) return bad("ไม่พบออเดอร์", 404);
  if (order.status === "shipped" || order.status === "cancelled") return bad("ออเดอร์นี้แก้ไขไฟล์ไม่ได้แล้ว");

  const body = await readJson<{ itemId: string; uploadId: string; previewUploadId?: string | null }>(req);
  if (!body?.itemId || !body.uploadId) return bad("ข้อมูลไม่ครบ");
  const { data: item } = await db()
    .from("order_items")
    .select("id, position, file_path, preview_path, reupload_requested")
    .eq("id", body.itemId)
    .eq("order_id", order.id)
    .maybeSingle();
  if (!item) return bad("ไม่พบรายการ", 404);
  if (!item.reupload_requested) return bad("รายการนี้ไม่ได้ขอไฟล์ใหม่");

  const { data: ups } = await db()
    .from("uploads")
    .select("*")
    .in("id", [body.uploadId, body.previewUploadId].filter(Boolean) as string[]);
  const up = ups?.find((u) => u.id === body.uploadId);
  const pv = ups?.find((u) => u.id === body.previewUploadId && u.kind === "preview");
  if (!up || up.kind !== "artwork" || up.used) return bad("อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่");

  const { error } = await db()
    .from("order_items")
    .update({
      file_path: up.path,
      file_name: up.file_name,
      file_size: up.size,
      preview_path: pv?.path ?? null,
      check_result: up.check_result,
      reupload_requested: false,
      reuploaded_at: new Date().toISOString(),
    })
    .eq("id", item.id);
  if (error) return bad("บันทึกไม่สำเร็จ", 500);
  await db().from("uploads").update({ used: true }).in("id", [up.id, pv?.id].filter(Boolean) as string[]);
  // ลบไฟล์เก่าทิ้ง (ถ้าไม่มีออเดอร์อื่นใช้อยู่)
  await removeIfUnreferenced([item.file_path, item.preview_path]);

  await db()
    .from("orders")
    .update({ needs_attention: true, attention_note: `ลูกค้าส่งไฟล์ใหม่ (รายการที่ ${item.position})` })
    .eq("id", order.id);
  const settings = await getSettings();
  await notifyShop(
    settings.notifyEmail,
    `ไฟล์ใหม่ ${order.order_no}`,
    `ลูกค้าส่งไฟล์ใหม่สำหรับออเดอร์ ${order.order_no} รายการที่ ${item.position}: ${up.file_name}\n${siteUrl()}/admin/orders/${order.id}`,
  );
  return NextResponse.json({ ok: true });
}
