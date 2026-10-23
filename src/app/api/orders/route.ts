import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { productLabel, shapeLabel } from "@/lib/constants";
import { applySize, cleanTrim, perSheet, sizeText, trimCheck } from "@/lib/sticker-size";
import { baht, formatAddress, isValidPhone, normalizePhone } from "@/lib/format";
import { combineTotals, computeA5Quote } from "@/lib/a5-pricing";
import { computeQuote, validateItems } from "@/lib/pricing";
import { loadA5Lines } from "@/lib/server/a5-order";
import { notifyShop, siteUrl } from "@/lib/server/email";
import { bad, readJson } from "@/lib/server/http";
import { getOrCreateCustomer, getPoints } from "@/lib/server/orders";
import { getSettings } from "@/lib/server/settings";
import { ownsPhone } from "@/lib/server/customer-lookup";
import { rememberMe } from "@/lib/server/me";
import { LINE_COOKIE, verify, type FileGrant, type LineSession } from "@/lib/server/signed-cookie";
import { verifySlip } from "@/lib/server/slip";
import * as storage from "@/lib/server/storage";
import { db } from "@/lib/supabase/admin";
import type { Address, CheckResult, Finish, ProductKey, Shape } from "@/lib/types";

export const maxDuration = 30;

interface Body {
  items: {
    uploadId: string;
    previewUploadId?: string | null;
    product: ProductKey;
    finish: Finish;
    qty: number;
    freeQty: number;
    acceptRisk: boolean;
    fixService: boolean;
    shape: Shape;
    widthMm: number;
    heightMm: number;
    trim?: unknown;
    /**
     * สั่งซ้ำ: ใช้ไฟล์จากรายการในออเดอร์เดิม ยืนยันด้วย token ของออเดอร์นั้น
     * หรือ grant ที่ได้จากหน้า "ไฟล์ที่เคยสั่ง" (ยืนยันชื่อ + เบอร์แล้ว)
     */
    reorder?: ReorderRef | null;
  }[];
  /** สติกเกอร์สำเร็จรูป A5 (ไม่บังคับ) */
  a5?: { designId: string; sizeId: string | null; qty: number }[];
  customer: { name: string; phone: string; address: Address; note?: string };
  slipUploadId: string;
  consent: boolean;
  expectedTotal: number;
}

export async function POST(req: Request) {
  const body = await readJson<Body>(req);
  if (!body || !Array.isArray(body.items) || !body.customer) return bad("ข้อมูลไม่ครบ");
  if (!body.consent) return bad("กรุณายอมรับนโยบายความเป็นส่วนตัว");
  if (body.items.length > 30) return bad("จำนวนไฟล์ไม่ถูกต้อง (สูงสุด 30 ไฟล์ต่อออเดอร์)");
  // ออเดอร์มีงานพิมพ์ไฟล์ A3+ และ/หรือ สติกเกอร์สำเร็จรูป A5
  const a5 = await loadA5Lines(body.a5 ?? null);
  if (!a5.ok) return bad(a5.error);
  if (body.items.length < 1 && !a5.lines.length) return bad("ยังไม่มีสินค้าในออเดอร์");

  const phone = normalizePhone(body.customer.phone);
  const name = (body.customer.name || "").trim().slice(0, 100);
  const a = body.customer.address ?? ({} as Address);
  const address: Address = {
    line1: String(a.line1 || "").trim().slice(0, 300),
    subdistrict: String(a.subdistrict || "").trim().slice(0, 100),
    district: String(a.district || "").trim().slice(0, 100),
    province: String(a.province || "").trim().slice(0, 100),
    zipcode: String(a.zipcode || "").trim(),
  };
  if (!name) return bad("กรุณากรอกชื่อผู้รับ");
  if (!isValidPhone(phone)) return bad("เบอร์โทรต้องเป็นตัวเลข 10 หลัก");
  if (!address.line1 || !address.district || !address.province || !/^\d{5}$/.test(address.zipcode))
    return bad("กรุณากรอกที่อยู่ให้ครบ");

  const settings = await getSettings();

  // ไฟล์ทั้งหมดต้องอัปโหลดผ่านระบบและยังไม่ถูกใช้
  const ids = [
    ...body.items.filter((i) => !i.reorder).flatMap((i) => [i.uploadId, i.previewUploadId]),
    body.slipUploadId,
  ].filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x));
  const { data: uploads } = await db().from("uploads").select("*").in("id", ids);
  const byId = new Map((uploads ?? []).map((u) => [u.id as string, u]));
  const slip = byId.get(body.slipUploadId);
  if (!slip || slip.kind !== "slip" || slip.used) return bad("กรุณาอัปโหลดสลิปการโอนเงิน");

  const reorderItems = await loadReorderItems(body.items.map((i) => i.reorder ?? null));

  const missing = body.items.findIndex((i, idx) => i.reorder && !reorderItems[idx]);
  if (missing >= 0)
    return bad(`ไฟล์เดิมของไฟล์ที่ ${missing + 1} ถูกลบออกจากระบบแล้ว กรุณาลบรายการนี้แล้วอัปโหลดไฟล์ใหม่`);

  const items = body.items.map((it, idx) => {
    const src = reorderItems[idx];
    const up = src ? src.up : byId.get(it.uploadId);
    const pv = src ? src.preview : it.previewUploadId ? byId.get(it.previewUploadId) : null;
    const product: ProductKey = it.product === "pp" ? "pp" : "paper";
    const finish: Finish =
      product === "paper" ? "gloss" : (["gloss", "matte", "clear"] as Finish[]).includes(it.finish) ? it.finish : "matte";
    const shape: Shape | null = (["rect", "circle", "freeform"] as Shape[]).includes(it.shape) ? it.shape : null;
    const widthMm = Math.round(Number(it.widthMm) * 10) / 10 || null;
    const heightMm = shape === "circle" ? widthMm : Math.round(Number(it.heightMm) * 10) / 10 || null;
    const size = shape && widthMm && heightMm ? { shape, widthMm, heightMm } : null;
    const trim = cleanTrim(it.trim);
    return {
      trim,
      up,
      shape,
      widthMm,
      heightMm,
      perSheet: size ? perSheet(size.widthMm, size.heightMm, settings, size.shape) : null,
      preview: pv && pv.kind === "preview" ? pv : null,
      product,
      finish,
      qty: Math.floor(Number(it.qty) || 0),
      freeQty: Math.floor(Number(it.freeQty) || 0),
      acceptRisk: Boolean(it.acceptRisk),
      fixService: Boolean(it.fixService),
      // ความคมชัดคิดตามขนาดดวงที่เลือก
      check: applySize(trimCheck((up?.check_result ?? null) as CheckResult | null, trim), size, settings),
      reorderOf: src?.itemId ?? null,
      // ครั้งก่อนร้านแก้ไฟล์ให้แล้ว หรือลูกค้ายอมรับแล้ว ไม่ต้องเลือกใหม่
      prevApproved: src?.prevApproved ?? false,
    };
  });
  if (items.some((i) => !i.up || i.up.kind !== "artwork" || i.up.used))
    return bad("มีไฟล์ที่อัปโหลดไม่สำเร็จ กรุณาลบแล้วอัปโหลดใหม่");

  // ตรวจว่าไฟล์อัปโหลดเสร็จจริง
  const exists = await Promise.all([slip.path, ...items.map((i) => i.up!.path)].map((p) => storage.exists(p)));
  if (!exists[0]) return bad("อัปโหลดสลิปยังไม่เสร็จ กรุณาอัปโหลดใหม่");
  if (exists.slice(1).some((e) => !e)) return bad("มีไฟล์ที่อัปโหลดไม่สำเร็จ กรุณาลบแล้วอัปโหลดใหม่");

  const { points, pending } = await getPoints(phone);
  const quote = computeQuote(settings, items, points + pending);
  if (items.length) {
    const v = validateItems(
      settings,
      items.map((i) => ({ ...i, checkLevel: i.prevApproved ? null : (i.check?.level ?? null) })),
      quote.freeSheets,
    );
    if (!v.ok) return bad(v.message!, 400, { quote });
  }
  const a5q = computeA5Quote(settings, a5.lines);
  const totals = combineTotals(quote, a5q);
  if (Math.abs(totals.total - Number(body.expectedTotal)) > 0.001)
    return bad("ยอดเงินมีการเปลี่ยนแปลง กรุณาตรวจสอบยอดใหม่อีกครั้ง", 409, { quote });

  const store = await cookies();
  const line = verify<LineSession>(store.get(LINE_COOKIE)?.value);
  const owner = await ownsPhone(phone, name);
  await getOrCreateCustomer(phone, name, owner ? (line?.userId ?? null) : null);

  const token = crypto.randomBytes(18).toString("base64url");
  const now = new Date().toISOString();
  const { data: order, error } = await db()
    .from("orders")
    .insert({
      token,
      customer_phone: phone,
      customer_name: name,
      address,
      line_user_id: line?.userId ?? null,
      total_sheets: quote.totalSheets,
      free_sheets: quote.freeSheets,
      subtotal: quote.subtotal,
      fix_fee_total: quote.fixFeeTotal,
      shipping_fee: totals.shipping,
      total: totals.total,
      // ใส่เฉพาะเมื่อมี A5 (ออเดอร์ A3+ ล้วนยังสั่งได้แม้ยังไม่ได้รัน migration 0007)
      ...(a5.lines.length ? { a5_sheets: a5q.sheets, a5_subtotal: a5q.subtotal } : {}),
      pricing_snapshot: {
        tier: quote.tier,
        tiers: settings.tiers,
        shippingFee: settings.shippingFee,
        freeShippingMin: settings.freeShippingMin,
        promo: settings.promo,
        fixFileFee: settings.fixFileFee,
        prevPoints: quote.prevPoints,
        ...(a5.lines.length
          ? {
              a5: {
                tier: a5q.tier,
                tiers: settings.a5Tiers,
                shippingFee: settings.a5ShippingFee,
                freeShippingMin: settings.a5FreeShippingMin,
                shipping: a5q.shipping,
                a3Shipping: quote.shipping,
              },
            }
          : {}),
      },
      slip_path: slip.path,
      slip_uploaded_at: now,
      consent_at: now,
      customer_note: (body.customer.note || "").slice(0, 500) || null,
      attention_note: "ออเดอร์ใหม่ รอตรวจสลิป",
    })
    .select("id, order_no, token")
    .single();
  if (error || !order) {
    console.error(error);
    return bad("บันทึกออเดอร์ไม่สำเร็จ กรุณาลองใหม่", 500);
  }

  const { error: itemErr } = !items.length
    ? { error: null }
    : await db()
        .from("order_items")
        .insert(
          items.map((it, idx) => ({
            order_id: order.id,
            position: idx + 1,
            reorder_of: it.reorderOf,
            shape: it.shape,
            width_mm: it.widthMm,
            height_mm: it.heightMm,
            per_sheet: it.perSheet,
            // ใส่เฉพาะเมื่อมี (ออเดอร์ทั่วไปยังสั่งได้แม้ยังไม่ได้รัน migration 0006)
            ...(it.trim ? { trim: it.trim } : {}),
            file_path: it.up.path,
            file_name: it.up.file_name,
            file_size: it.up.size,
            preview_path: it.preview?.path ?? null,
            check_result: it.check,
            accept_risk: it.acceptRisk,
            fix_service: it.fixService,
            fix_fee: quote.lines[idx].fixFee,
            product: it.product,
            finish: it.finish,
            qty: it.qty,
            free_qty: it.freeQty,
            unit_price: quote.lines[idx].unitPrice,
            line_total: quote.lines[idx].lineTotal,
          })),
        );
  const { error: a5Err } =
    itemErr || !a5.lines.length
      ? { error: null }
      : await db()
          .from("order_a5_items")
          .insert(
            a5.lines.map((l, idx) => ({
              order_id: order.id,
              position: idx + 1,
              product_id: l.productId,
              design_id: l.designId,
              size_id: l.sizeId,
              product_name: l.productName,
              design_name: l.designName,
              size_name: l.sizeName,
              sku: l.sku,
              designer_id: l.designerId,
              designer_name: l.designerName,
              thumb_path: l.thumbPath,
              qty: l.qty,
              unit_price: a5q.lines[idx].unitPrice,
              line_total: a5q.lines[idx].lineTotal,
            })),
          );
  if (itemErr || a5Err) {
    console.error(itemErr ?? a5Err);
    await db().from("orders").delete().eq("id", order.id);
    return bad("บันทึกออเดอร์ไม่สำเร็จ กรุณาลองใหม่", 500);
  }
  await db().from("uploads").update({ used: true }).in("id", ids.filter((id) => byId.has(id)));

  // ตรวจสลิปอัตโนมัติ (ถ้าเปิดไว้)
  if (settings.slipVerify.enabled) {
    const slipBlob = await storage.download(slip.path);
    const res = slipBlob ? await verifySlip(settings, slipBlob, totals.total) : null;
    if (res) {
      await db()
        .from("orders")
        .update({
          slip_verify: res,
          ...(res.ok ? { status: "paid", paid_at: new Date().toISOString(), attention_note: "ออเดอร์ใหม่ (สลิปผ่านการตรวจอัตโนมัติ)" } : {}),
        })
        .eq("id", order.id);
    }
  }

  const lines = items
    .map((it, i) => `${i + 1}. ${it.up.file_name} — ${productLabel(it.product, it.finish)} ${shapeLabel(it.shape)} ${sizeText(it)} × ${it.qty}${it.freeQty ? ` (+แถม ${it.freeQty})` : ""}${it.trim ? " [ตัดพื้นหลังรอบงาน]" : ""}${it.check ? ` [${it.check.title}]` : ""}`)
    .join("\n");
  const a5Text = a5.lines.length
    ? `สติกเกอร์สำเร็จรูป A5 (${a5q.sheets} แผ่น)\n${a5.lines
        .map((l) => `- ${l.sku} ${l.productName} / ${l.designName}${l.sizeName ? ` / ${l.sizeName}` : ""} × ${l.qty}`)
        .join("\n")}\n\n`
    : "";
  const a3Text = items.length ? `งานพิมพ์ไฟล์ ${settings.sheetName}\n${lines}\nรวม ${quote.totalSheets} แผ่น แถม ${quote.freeSheets} แผ่น\n\n` : "";
  await notifyShop(
    settings.notifyEmail,
    `ออเดอร์ใหม่ ${order.order_no} — ${baht(totals.total)}`,
    `ออเดอร์ใหม่ ${order.order_no}\nลูกค้า: ${name} ${phone}\nที่อยู่: ${formatAddress(address)}\n\n${a5Text}${a3Text}ยอดชำระ ${baht(totals.total)}\n\nดูออเดอร์: ${siteUrl()}/admin/orders/${order.id}`,
  );

  const res = NextResponse.json({ orderNo: order.order_no, token: order.token });
  return owner ? rememberMe(res, phone, name) : res;
}

type UploadLike = { path: string; file_name: string; size: number; kind: string; used: boolean; check_result: unknown };

type ReorderRef = { token?: string; itemId?: string; grant?: string };

/** หาไฟล์ของรายการในออเดอร์เดิมสำหรับสั่งซ้ำ (คืนค่าเรียงตามลำดับรายการ) */
async function loadReorderItems(refs: (ReorderRef | null)[]) {
  type Found = { itemId: string; up: UploadLike; preview: { path: string; kind: "preview" } | null; prevApproved: boolean };
  // แปลงแต่ละ ref เป็น itemId + เงื่อนไขที่ต้องตรง
  const wanted = refs.map((r) => {
    if (!r) return null;
    if (r.grant) {
      const g = verify<FileGrant>(String(r.grant));
      return g && g.exp > Date.now() ? { itemId: g.i, phone: g.p } : null;
    }
    return r.token && r.itemId ? { itemId: String(r.itemId), token: String(r.token) } : null;
  });
  const ids = [...new Set(wanted.filter(Boolean).map((w) => w!.itemId))];
  const out: (Found | null)[] = refs.map(() => null);
  if (!ids.length) return out;
  const { data: rows } = await db()
    .from("order_items")
    .select("id, file_path, file_name, file_size, preview_path, check_result, accept_risk, fix_service, orders(token, customer_phone)")
    .in("id", ids);
  wanted.forEach((w, idx) => {
    if (!w) return;
    const row = rows?.find((x) => x.id === w.itemId);
    const o = row?.orders as unknown as { token: string; customer_phone: string } | null;
    if (!row?.file_path || !o) return;
    if ("token" in w && w.token !== o.token) return;
    if ("phone" in w && w.phone !== o.customer_phone) return;
    out[idx] = {
      itemId: row.id,
      up: { path: row.file_path, file_name: row.file_name, size: row.file_size, kind: "artwork", used: false, check_result: row.check_result },
      preview: row.preview_path ? { path: row.preview_path, kind: "preview" } : null,
      prevApproved: Boolean(row.fix_service || row.accept_risk),
    };
  });
  return out;
}
