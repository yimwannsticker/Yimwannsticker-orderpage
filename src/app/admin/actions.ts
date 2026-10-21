"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CARRIERS, resolveCarrier } from "@/lib/constants";
import * as storage from "@/lib/server/storage";
import { normalizePhone } from "@/lib/format";
import { requireStaff, type Role } from "@/lib/server/auth";
import { mergeSettings, saveSettings } from "@/lib/server/settings";
import { markShipped, removeIfUnreferenced } from "@/lib/server/orders";
import { db } from "@/lib/supabase/admin";
import { authClient } from "@/lib/supabase/server";
import type { OrderStatus, Settings } from "@/lib/types";

type Result = { ok: true; message?: string } | { ok: false; error: string };

function refresh(orderId?: string) {
  revalidatePath("/admin");
  if (orderId) revalidatePath(`/admin/orders/${orderId}`);
}

export async function logout() {
  const supa = await authClient();
  await supa.auth.signOut();
  redirect("/admin/login");
}

export async function markSeen(orderId: string) {
  await requireStaff();
  await db().from("orders").update({ needs_attention: false }).eq("id", orderId);
  revalidatePath("/admin", "layout");
}

export async function confirmPayment(orderId: string): Promise<Result> {
  await requireStaff("admin");
  const { error } = await db()
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString(), slip_rejected_reason: null })
    .eq("id", orderId)
    .eq("status", "pending_slip");
  if (error) return { ok: false, error: error.message };
  refresh(orderId);
  return { ok: true };
}

export async function rejectSlip(orderId: string, reason: string): Promise<Result> {
  await requireStaff("admin");
  if (!reason.trim()) return { ok: false, error: "กรุณาระบุเหตุผล" };
  const { error } = await db()
    .from("orders")
    .update({ slip_rejected_reason: reason.trim(), status: "pending_slip", paid_at: null })
    .eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  refresh(orderId);
  return { ok: true };
}

const ALLOWED: Record<Role, OrderStatus[]> = {
  admin: ["pending_slip", "paid", "producing", "shipped", "cancelled"],
  graphic: ["paid", "producing"],
};

export async function setStatus(orderId: string, status: OrderStatus): Promise<Result> {
  const staff = await requireStaff();
  if (!ALLOWED[staff.role].includes(status)) return { ok: false, error: "ไม่มีสิทธิ์เปลี่ยนเป็นสถานะนี้" };
  const { data: cur } = await db().from("orders").select("status").eq("id", orderId).single();
  if (!cur) return { ok: false, error: "ไม่พบออเดอร์" };
  if (staff.role === "graphic" && !["paid", "producing"].includes(cur.status))
    return { ok: false, error: "เปลี่ยนสถานะได้เฉพาะออเดอร์ที่ชำระแล้ว" };
  const stamp: Record<string, string | null> = {};
  const now = new Date().toISOString();
  if (status === "paid") stamp.paid_at = now;
  if (status === "producing") stamp.producing_at = now;
  if (status === "cancelled") stamp.cancelled_at = now;
  const { error } = await db().from("orders").update({ status, ...stamp }).eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  refresh(orderId);
  return { ok: true };
}

export async function requestReupload(itemId: string, reason: string): Promise<Result> {
  await requireStaff();
  if (!reason.trim()) return { ok: false, error: "กรุณาระบุเหตุผล" };
  const { data, error } = await db()
    .from("order_items")
    .update({ reupload_requested: true, reupload_reason: reason.trim() })
    .eq("id", itemId)
    .select("order_id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "ไม่พบรายการ" };
  refresh(data.order_id);
  return { ok: true, message: "บันทึกแล้ว ลูกค้าจะเห็นคำขอที่หน้าเช็คสถานะ (ส่งลิงก์ให้ลูกค้าได้)" };
}

export async function cancelReupload(itemId: string): Promise<Result> {
  await requireStaff();
  const { data } = await db()
    .from("order_items")
    .update({ reupload_requested: false })
    .eq("id", itemId)
    .select("order_id")
    .single();
  refresh(data?.order_id);
  return { ok: true };
}

export async function saveTracking(orderId: string, carrier: string, trackingNo: string): Promise<Result> {
  await requireStaff();
  const t = trackingNo.trim().toUpperCase().replace(/\s/g, "");
  if (!t) return { ok: false, error: "กรุณากรอกเลขแทร็ค" };
  if (!CARRIERS.some((c) => c.key === carrier)) return { ok: false, error: "กรุณาเลือกขนส่ง" };
  try {
    const { line } = await markShipped(orderId, carrier, t);
    refresh(orderId);
    return {
      ok: true,
      message:
        line === "sent" ? "บันทึกแล้ว และแจ้งลูกค้าทาง LINE แล้ว" : line === "failed" ? "บันทึกแล้ว แต่ส่ง LINE ไม่สำเร็จ" : "บันทึกแล้ว",
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function saveAdminNote(orderId: string, note: string): Promise<Result> {
  await requireStaff();
  await db().from("orders").update({ admin_note: note.slice(0, 1000) || null }).eq("id", orderId);
  refresh(orderId);
  return { ok: true };
}

export async function fileDownloadUrl(path: string): Promise<string | null> {
  const staff = await requireStaff();
  if (path.startsWith("slip/") && staff.role !== "admin") return null;
  // ตั้งชื่อไฟล์ตอนดาวน์โหลดเป็น เลขออเดอร์-ลำดับ-ชื่อไฟล์เดิม ให้กราฟิกหาง่าย
  const { data } = await db()
    .from("order_items")
    .select("position, file_name, orders(order_no)")
    .eq("file_path", path)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const orderNo = (data?.orders as unknown as { order_no: string } | null)?.order_no;
  const name = data ? `${orderNo ?? "file"}-${data.position}-${data.file_name}` : (path.split("/").pop() ?? "file");
  return storage.readUrl(path, 60 * 10, name);
}

// ---------- นำเข้าเลขแทร็คหลายออเดอร์ ----------

export interface TrackingRow {
  ref: string;
  trackingNo: string;
  carrier: string;
}

export interface TrackingMatch extends TrackingRow {
  orderId: string | null;
  orderNo: string | null;
  customerName: string | null;
  status: string | null;
  problem: string | null;
}

export async function matchTracking(rows: TrackingRow[]): Promise<TrackingMatch[]> {
  await requireStaff();
  const refs = rows.slice(0, 1000);
  const orderNos = refs.map((r) => r.ref.trim().toUpperCase()).filter((r) => /^YW\d+$/.test(r));
  const phones = refs.map((r) => normalizePhone(r.ref)).filter((p) => /^0\d{8,9}$/.test(p));
  const [{ data: byNo }, { data: byPhone }] = await Promise.all([
    db().from("orders").select("id, order_no, customer_name, customer_phone, status, created_at").in("order_no", orderNos.length ? orderNos : ["-"]),
    db()
      .from("orders")
      .select("id, order_no, customer_name, customer_phone, status, created_at")
      .in("customer_phone", phones.length ? phones : ["-"])
      .in("status", ["paid", "producing"])
      .order("created_at", { ascending: false }),
  ]);
  return refs.map((r) => {
    const ref = r.ref.trim().toUpperCase();
    const carrier = resolveCarrier(r.carrier);
    let o = byNo?.find((x) => x.order_no === ref);
    let problem: string | null = null;
    if (!o) {
      const list = (byPhone ?? []).filter((x) => x.customer_phone === normalizePhone(r.ref));
      if (list.length > 1) problem = `เบอร์นี้มี ${list.length} ออเดอร์ที่รอส่ง ใช้เลขออเดอร์แทน`;
      else o = list[0];
    }
    if (!o && !problem) problem = "ไม่พบออเดอร์";
    if (o && o.status === "cancelled") problem = "ออเดอร์ถูกยกเลิก";
    if (!r.trackingNo.trim()) problem = "ไม่มีเลขแทร็ค";
    if (!carrier) problem = problem ?? "ไม่รู้จักขนส่ง";
    return {
      ...r,
      carrier: carrier ?? r.carrier,
      orderId: problem ? null : (o?.id ?? null),
      orderNo: o?.order_no ?? null,
      customerName: o?.customer_name ?? null,
      status: o?.status ?? null,
      problem,
    };
  });
}

export async function applyTracking(rows: { orderId: string; carrier: string; trackingNo: string }[]) {
  await requireStaff();
  let ok = 0;
  let lineSent = 0;
  const failed: string[] = [];
  for (const r of rows) {
    try {
      const res = await markShipped(r.orderId, r.carrier, r.trackingNo.trim().toUpperCase());
      ok++;
      if (res.line === "sent") lineSent++;
    } catch {
      failed.push(r.trackingNo);
    }
  }
  revalidatePath("/admin");
  return { ok, lineSent, failed };
}

// ---------- ลูกค้า ----------

export async function adjustPoints(phone: string, adjustment: number, note: string): Promise<Result> {
  await requireStaff("admin");
  if (!Number.isInteger(adjustment)) return { ok: false, error: "ตัวเลขไม่ถูกต้อง" };
  const { error } = await db().from("customers").update({ points_adjustment: adjustment, note: note || null }).eq("phone", phone);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/customers");
  return { ok: true, message: "บันทึกแล้ว" };
}

// ---------- ตั้งค่า ----------

export async function updateSettings(data: Settings): Promise<Result> {
  await requireStaff("admin");
  const s = mergeSettings(data);
  const nums = [
    s.minPerFile,
    s.shippingFee,
    s.freeShippingMin,
    s.fixFileFee,
    s.dpiGood,
    s.dpiMin,
    s.fileRetentionDays,
    s.maxFileMb,
    s.sheetMarginMm,
    s.stickerGapMm,
    s.minStickerMm,
  ];
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return { ok: false, error: "ตัวเลขต้องไม่ติดลบ" };
  if (s.dpiMin > s.dpiGood) return { ok: false, error: "เกณฑ์ DPI ขั้นต่ำต้องน้อยกว่าเกณฑ์พร้อมพิมพ์" };
  if (!s.tiers.length || s.tiers.some((t) => !(t.min > 0) || !(t.paper >= 0) || !(t.pp >= 0)))
    return { ok: false, error: "ตารางราคาไม่ถูกต้อง" };
  if (new Set(s.tiers.map((t) => t.min)).size !== s.tiers.length) return { ok: false, error: "ช่วงจำนวนในตารางราคาซ้ำกัน" };
  s.tiers = [...s.tiers].sort((a, b) => a.min - b.min);
  if (s.maxFileMb > 200) return { ok: false, error: "ขนาดไฟล์สูงสุด 200MB (ตามที่ตั้ง bucket ไว้)" };
  await saveSettings(s);
  revalidatePath("/", "layout");
  return { ok: true, message: "บันทึกการตั้งค่าแล้ว" };
}

// ---------- พนักงาน ----------

export async function addStaff(email: string, role: Role, password: string): Promise<Result> {
  await requireStaff("admin");
  const e = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(e)) return { ok: false, error: "อีเมลไม่ถูกต้อง" };
  if (password.length < 8) return { ok: false, error: "รหัสผ่านอย่างน้อย 8 ตัวอักษร" };
  const { data, error } = await db().auth.admin.createUser({ email: e, password, email_confirm: true });
  let userId = data?.user?.id;
  if (error) {
    // มีบัญชีอยู่แล้ว: หาแล้วผูกสิทธิ์
    const { data: list } = await db().auth.admin.listUsers({ perPage: 1000 });
    userId = list?.users.find((u) => u.email?.toLowerCase() === e)?.id;
    if (!userId) return { ok: false, error: error.message };
  }
  const { error: e2 } = await db().from("staff").upsert({ user_id: userId, email: e, role });
  if (e2) return { ok: false, error: e2.message };
  revalidatePath("/admin/staff");
  return { ok: true, message: "เพิ่มพนักงานแล้ว" };
}

export async function updateStaffRole(userId: string, role: Role): Promise<Result> {
  const me = await requireStaff("admin");
  if (me.userId === userId) return { ok: false, error: "เปลี่ยนสิทธิ์ตัวเองไม่ได้" };
  await db().from("staff").update({ role }).eq("user_id", userId);
  revalidatePath("/admin/staff");
  return { ok: true };
}

export async function removeStaff(userId: string): Promise<Result> {
  const me = await requireStaff("admin");
  if (me.userId === userId) return { ok: false, error: "ลบตัวเองไม่ได้" };
  await db().from("staff").delete().eq("user_id", userId);
  revalidatePath("/admin/staff");
  return { ok: true };
}

export async function deleteOrderFiles(orderId: string): Promise<Result> {
  await requireStaff("admin");
  const { data: o } = await db().from("orders").select("slip_path").eq("id", orderId).single();
  const { data: items } = await db().from("order_items").select("file_path, preview_path").eq("order_id", orderId);
  await db().from("order_items").update({ file_path: null, preview_path: null }).eq("order_id", orderId);
  await removeIfUnreferenced((items ?? []).flatMap((i) => [i.file_path, i.preview_path]));
  if (o?.slip_path) await storage.remove([o.slip_path]);
  await db().from("orders").update({ files_deleted_at: new Date().toISOString(), slip_path: null }).eq("id", orderId);
  refresh(orderId);
  return { ok: true };
}
