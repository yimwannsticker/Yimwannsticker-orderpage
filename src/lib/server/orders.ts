import "server-only";
import { db } from "../supabase/admin";
import * as storage from "./storage";
import type { Address, CheckResult, Finish, LineEvent, OrderStatus, ProductKey, Shape, Trim } from "../types";
import { getQuota, pushStatus, pushTracking, messagingEnabled } from "./line";
import { siteUrl } from "./email";
import { getSettings } from "./settings";

export interface OrderRow {
  id: string;
  order_no: string;
  token: string;
  status: OrderStatus;
  customer_phone: string;
  customer_name: string;
  address: Address;
  line_user_id: string | null;
  total_sheets: number;
  /** สติกเกอร์สำเร็จรูป A5 (0 = ไม่มี) */
  a5_sheets?: number;
  a5_subtotal?: number;
  free_sheets: number;
  subtotal: number;
  fix_fee_total: number;
  shipping_fee: number;
  total: number;
  pricing_snapshot: Record<string, unknown>;
  slip_path: string | null;
  slip_uploaded_at: string | null;
  slip_rejected_reason: string | null;
  slip_verify: Record<string, unknown> | null;
  paid_at: string | null;
  producing_at: string | null;
  shipped_at: string | null;
  cancelled_at: string | null;
  carrier: string | null;
  tracking_no: string | null;
  line_notified_at: string | null;
  line_events: Partial<Record<string, string>> | null;
  needs_attention: boolean;
  attention_note: string | null;
  files_deleted_at: string | null;
  customer_note: string | null;
  admin_note: string | null;
  created_at: string;
}

export interface ItemRow {
  id: string;
  order_id: string;
  position: number;
  file_path: string | null;
  file_name: string;
  file_size: number;
  preview_path: string | null;
  check_result: CheckResult | null;
  accept_risk: boolean;
  fix_service: boolean;
  fix_fee: number;
  product: ProductKey;
  finish: Finish;
  qty: number;
  free_qty: number;
  unit_price: number;
  line_total: number;
  reupload_requested: boolean;
  reupload_reason: string | null;
  reuploaded_at: string | null;
  reorder_of: string | null;
  shape: Shape | null;
  width_mm: number | null;
  trim: Trim | null;
  height_mm: number | null;
  per_sheet: number | null;
}

export async function getPoints(phone: string) {
  const { data } = await db()
    .from("customer_points")
    .select("points, pending_sheets")
    .eq("phone", phone)
    .maybeSingle();
  return { points: data?.points ?? 0, pending: data?.pending_sheets ?? 0 };
}

export async function getOrderByToken(token: string) {
  if (!token || token.length < 10) return null;
  const { data } = await db().from("orders").select("*").eq("token", token).maybeSingle();
  return (data as OrderRow) ?? null;
}

export interface A5ItemRow {
  id: string;
  order_id: string;
  position: number;
  product_id: string | null;
  design_id: string | null;
  size_id: string | null;
  product_name: string;
  design_name: string;
  size_name: string | null;
  sku: string;
  designer_id: string | null;
  designer_name: string | null;
  thumb_path: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
  picked_at: string | null;
  /** fixed = สินค้าราคาคงที่ (การ์ด) ไม่นับเป็นแผ่น A5 */
  pricing?: "a5" | "fixed";
  units?: number | null;
  unit_label?: string | null;
}

/** รายการ A5 ของออเดอร์ เรียงตาม SKU (หยิบของง่าย) */
export async function getA5Items(orderId: string) {
  const { data } = await db().from("order_a5_items").select("*").eq("order_id", orderId);
  return ((data as A5ItemRow[]) ?? []).sort((a, b) => a.sku.localeCompare(b.sku, "th", { numeric: true }));
}

export async function getItems(orderId: string) {
  const { data } = await db().from("order_items").select("*").eq("order_id", orderId).order("position");
  return (data as ItemRow[]) ?? [];
}

export async function signedUrls(paths: (string | null)[], expires = 60 * 30, downloadNames?: Record<string, string>) {
  const list = [...new Set(paths.filter(Boolean) as string[])];
  const out: Record<string, string> = {};
  await Promise.all(list.map(async (p) => (out[p] = await storage.readUrl(p, expires, downloadNames?.[p]))));
  return out;
}

export function statusUrl(token: string) {
  return `${siteUrl()}/o/${token}`;
}

/** บันทึกเลขแทร็ค เปลี่ยนเป็นจัดส่งแล้ว และ push LINE (ครั้งเดียวต่อออเดอร์) */
export async function markShipped(orderId: string, carrier: string, trackingNo: string) {
  const { data: order, error } = await db()
    .from("orders")
    .update({
      carrier,
      tracking_no: trackingNo,
      status: "shipped",
      shipped_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .neq("status", "cancelled")
    .select("*")
    .single();
  if (error || !order) throw new Error("บันทึกเลขแทร็คไม่สำเร็จ");
  const o = order as OrderRow;
  let line: "sent" | "skipped" | "failed" = "skipped";
  if (o.line_user_id && !o.line_notified_at && messagingEnabled()) {
    // จองสิทธิ์ส่งก่อน กันส่งซ้ำ
    const { data: claimed } = await db()
      .from("orders")
      .update({ line_notified_at: new Date().toISOString() })
      .eq("id", o.id)
      .is("line_notified_at", null)
      .select("id");
    if (claimed?.length) {
      try {
        const s = await getSettings();
        await pushTracking(
          o.line_user_id,
          { orderNo: o.order_no, trackingNo, carrier, statusUrl: statusUrl(o.token) },
          s.lineTrackingMessage,
        );
        line = "sent";
      } catch (e) {
        console.error(e);
        await db().from("orders").update({ line_notified_at: null }).eq("id", o.id);
        line = "failed";
      }
    }
  }
  return { order: o, line };
}

// ---------- แจ้งสถานะทาง LINE ----------

/** ข้อความแต่ละสถานะ · repeat = ส่งซ้ำได้ทุกครั้ง (เรื่องที่ลูกค้าต้องทำอะไรต่อ) */
const LINE_EVENTS: Record<LineEvent, { title: string; text: (detail: string) => string; button?: string; repeat?: boolean; essential?: boolean }> = {
  paid: { title: "ได้รับชำระเงินแล้ว ✅", text: () => "ร้านตรวจสลิปเรียบร้อย ออเดอร์เข้าคิวผลิตแล้วค่ะ" },
  producing: { title: "เริ่มผลิตแล้ว 🖨️", text: () => "กำลังพิมพ์และเตรียมแพ็กสติกเกอร์ของคุณค่ะ ส่งของแล้วจะแจ้งเลขพัสดุอีกครั้ง" },
  slipRejected: {
    title: "สลิปยังไม่ผ่าน กรุณาส่งใหม่",
    text: (d) => `เหตุผล: ${d}\nกดปุ่มด้านล่างเพื่อแนบสลิปใหม่ค่ะ`,
    button: "ส่งสลิปใหม่",
    repeat: true,
    essential: true,
  },
  reupload: {
    title: "ร้านขอไฟล์ใหม่ 1 รายการ",
    text: (d) => `เหตุผล: ${d}\nกดปุ่มด้านล่างเพื่ออัปโหลดไฟล์ใหม่ ร้านจะผลิตต่อทันทีที่ได้ไฟล์ค่ะ`,
    button: "อัปโหลดไฟล์ใหม่",
    repeat: true,
    essential: true,
  },
  cancelled: { title: "ยกเลิกออเดอร์แล้ว", text: () => "ออเดอร์นี้ถูกยกเลิก หากมีข้อสงสัยทักแชตร้านได้เลยค่ะ" },
};

/**
 * แจ้งลูกค้าทาง LINE เมื่อสถานะเปลี่ยน (เฉพาะออเดอร์ที่ผูก LINE และเปิดแจ้งเรื่องนั้นในตั้งค่า)
 * ไม่ throw: ส่งไม่สำเร็จก็ไม่ทำให้การเปลี่ยนสถานะล้ม
 */
export async function notifyLine(orderId: string, event: LineEvent, detail = ""): Promise<"sent" | "skipped" | "failed"> {
  try {
    if (!messagingEnabled()) return "skipped";
    const s = await getSettings();
    if (!s.lineNotify[event]) return "skipped";
    const { data } = await db().from("orders").select("id, order_no, token, line_user_id, line_events").eq("id", orderId).maybeSingle();
    const o = data as Pick<OrderRow, "id" | "order_no" | "token" | "line_user_id" | "line_events"> | null;
    if (!o?.line_user_id) return "skipped";
    const def = LINE_EVENTS[event];
    const sent = o.line_events ?? {};
    if (!def.repeat && sent[event]) return "skipped";
    // โควตาใกล้หมด: เก็บไว้แจ้งเรื่องสำคัญ
    if (!def.essential && s.lineNotify.quotaGuard) {
      const q = await getQuota();
      if (q?.limit && q.used >= q.limit * 0.9) return "skipped";
    }
    if (!def.repeat) {
      // จองสิทธิ์ก่อน กันกดซ้ำแล้วส่งสองครั้ง
      const { data: claimed } = await db()
        .from("orders")
        .update({ line_events: { ...sent, [event]: new Date().toISOString() } })
        .eq("id", o.id)
        .eq("line_events", JSON.stringify(sent))
        .select("id");
      if (!claimed?.length) return "skipped";
    }
    try {
      await pushStatus(o.line_user_id, { title: def.title, text: def.text(detail), orderNo: o.order_no, statusUrl: statusUrl(o.token), button: def.button });
      return "sent";
    } catch (e) {
      console.error(e);
      if (!def.repeat) await db().from("orders").update({ line_events: sent }).eq("id", o.id);
      return "failed";
    }
  } catch (e) {
    console.error(e);
    return "failed";
  }
}

export async function getOrCreateCustomer(phone: string, name: string, lineUserId: string | null) {
  const { data } = await db().from("customers").select("phone, line_user_id").eq("phone", phone).maybeSingle();
  if (!data) {
    const { error } = await db().from("customers").insert({ phone, name, line_user_id: lineUserId });
    if (error) throw error;
  } else {
    await db()
      .from("customers")
      .update({ name, ...(lineUserId ? { line_user_id: lineUserId } : {}) })
      .eq("phone", phone);
  }
}

/**
 * ลบไฟล์ออกจาก Storage เฉพาะไฟล์ที่ไม่มีรายการไหนใช้อยู่แล้ว
 * (ไฟล์เดียวกันอาจถูกใช้ในหลายออเดอร์เมื่อลูกค้าสั่งซ้ำ) เรียกหลังจากล้าง path ของรายการเดิมแล้ว
 */
export async function removeIfUnreferenced(paths: (string | null | undefined)[]) {
  const list = [...new Set(paths.filter(Boolean) as string[])];
  if (!list.length) return 0;
  const [{ data: byFile }, { data: byPreview }] = await Promise.all([
    db().from("order_items").select("file_path").in("file_path", list),
    db().from("order_items").select("preview_path").in("preview_path", list),
  ]);
  const used = new Set([...(byFile ?? []).map((r) => r.file_path), ...(byPreview ?? []).map((r) => r.preview_path)]);
  const remove = list.filter((p) => !used.has(p));
  if (remove.length) await storage.remove(remove);
  return remove.length;
}
