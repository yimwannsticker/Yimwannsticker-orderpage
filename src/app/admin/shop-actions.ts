"use server";

import crypto from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { requireStaff } from "@/lib/server/auth";
import { CATALOG_TAG } from "@/lib/server/shop";
import * as storage from "@/lib/server/storage";
import { db } from "@/lib/supabase/admin";

type Result = { ok: true; message?: string; id?: string } | { ok: false; error: string };

function changed() {
  updateTag(CATALOG_TAG);
  revalidatePath("/admin/shop", "layout");
}

const clean = (s: unknown, max = 200) => String(s ?? "").trim().slice(0, max);
const isPath = (p: unknown): p is string => typeof p === "string" && /^catalog\/[0-9a-f-]{36}\.(webp|jpg|png)$/.test(p);

// ---------- หมวดหมู่ ----------

export async function saveCategory(input: { id?: string; name: string; iconPath: string | null }): Promise<Result> {
  await requireStaff("admin");
  const name = clean(input.name, 60);
  if (!name) return { ok: false, error: "กรุณาใส่ชื่อหมวดหมู่" };
  const icon_path = isPath(input.iconPath) ? input.iconPath : null;
  if (input.id) {
    const { error } = await db().from("shop_categories").update({ name, icon_path }).eq("id", input.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data: last } = await db().from("shop_categories").select("position").order("position", { ascending: false }).limit(1);
    const { error } = await db()
      .from("shop_categories")
      .insert({ name, icon_path, position: (last?.[0]?.position ?? 0) + 1 });
    if (error) return { ok: false, error: error.message };
  }
  changed();
  return { ok: true, message: "บันทึกหมวดหมู่แล้ว" };
}

export async function deleteCategory(id: string): Promise<Result> {
  await requireStaff("admin");
  const { error } = await db().from("shop_categories").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  changed();
  return { ok: true, message: "ลบหมวดหมู่แล้ว สินค้าในหมวดนี้ย้ายไป \"ไม่มีหมวด\"" };
}

async function reorder(table: "shop_categories" | "shop_products", ids: string[]) {
  await Promise.all(ids.map((id, i) => db().from(table).update({ position: i + 1 }).eq("id", id)));
}

export async function reorderCategories(ids: string[]): Promise<Result> {
  await requireStaff("admin");
  await reorder("shop_categories", ids.slice(0, 200));
  changed();
  return { ok: true };
}

export async function reorderProducts(ids: string[]): Promise<Result> {
  await requireStaff("admin");
  await reorder("shop_products", ids.slice(0, 1000));
  changed();
  return { ok: true };
}

// ---------- กราฟิก ----------

export async function saveDesigner(input: { id?: string; name: string; active: boolean }): Promise<Result> {
  await requireStaff("admin");
  const name = clean(input.name, 80);
  if (!name) return { ok: false, error: "กรุณาใส่ชื่อกราฟิก" };
  const row = { name, active: Boolean(input.active) };
  const { error } = input.id
    ? await db().from("designers").update(row).eq("id", input.id)
    : await db().from("designers").insert(row);
  if (error) return { ok: false, error: error.message };
  changed();
  return { ok: true, message: "บันทึกแล้ว" };
}

export async function deleteDesigner(id: string): Promise<Result> {
  await requireStaff("admin");
  const { error } = await db().from("designers").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  changed();
  return { ok: true, message: "ลบแล้ว (ยอดขายเดิมในรายงานยังเก็บชื่อไว้)" };
}

// ---------- สินค้า ----------

export interface ProductInput {
  id?: string;
  categoryId: string | null;
  name: string;
  description: string;
  piecesPerSheet: number | null;
  material: string;
  designCode: string;
  designerId: string | null;
  images: { path: string; thumb: string }[];
  badgeBest: boolean;
  badgeNew: boolean;
  active: boolean;
  pricing: "a5" | "fixed";
  optionLabel: string;
  unitLabel: string;
  /** รหัสสินค้า Shopee (ตอนนำเข้า) */
  shopeeItemId?: string | null;
  /** ช่วงเทศกาล "MM-DD" วนทุกปี (ไม่ใส่ทั้งคู่ = ขายตลอดปี) */
  seasonStart?: string | null;
  seasonEnd?: string | null;
  sizes: { id?: string; name: string; surcharge: number; price?: number | null; units?: number | null }[];
  designs: { id?: string; name: string; sku: string; imagePath: string | null; thumbPath: string | null; active: boolean }[];
}

const isUuid = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);

export async function saveProduct(input: ProductInput): Promise<Result> {
  await requireStaff("admin");
  const name = clean(input.name, 150);
  if (!name) return { ok: false, error: "กรุณาใส่ชื่อสินค้า" };
  const designs = (input.designs ?? []).slice(0, 500).map((d) => ({
    id: isUuid(d.id) ? d.id : crypto.randomUUID(),
    name: clean(d.name, 100),
    sku: clean(d.sku, 40),
    image_path: isPath(d.imagePath) ? d.imagePath : null,
    thumb_path: isPath(d.thumbPath) ? d.thumbPath : null,
    active: Boolean(d.active),
  }));
  if (designs.some((d) => !d.name)) return { ok: false, error: "มีลายที่ยังไม่ได้ใส่ชื่อ" };
  if (designs.some((d) => !d.sku)) return { ok: false, error: "มีลายที่ยังไม่มีรหัส SKU" };
  const dup = designs.map((d) => d.sku.toLowerCase()).find((s, i, a) => a.indexOf(s) !== i);
  if (dup) return { ok: false, error: `รหัส SKU ${dup} ซ้ำกันในสินค้านี้` };

  const productId = isUuid(input.id) ? input.id : crypto.randomUUID();
  // SKU ต้องไม่ซ้ำกับลายของสินค้าอื่น
  const { data: others } = await db().from("shop_designs").select("sku, product_id").neq("product_id", productId);
  const taken = new Set((others ?? []).map((o) => String(o.sku).toLowerCase()));
  const clash = designs.find((d) => taken.has(d.sku.toLowerCase()));
  if (clash) return { ok: false, error: `รหัส SKU ${clash.sku} ซ้ำกับสินค้าอื่น` };

  const pricing = input.pricing === "fixed" ? "fixed" : "a5";
  const money = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;
  const sizes = (input.sizes ?? []).slice(0, 20).map((s) => ({
    id: isUuid(s.id) ? s.id : crypto.randomUUID(),
    name: clean(s.name, 60),
    surcharge: pricing === "fixed" ? 0 : money(s.surcharge),
    price: pricing === "fixed" ? money(s.price) : null,
    units: pricing === "fixed" ? Math.max(1, Math.floor(Number(s.units) || 1)) : null,
  }));
  const optionLabel = clean(input.optionLabel, 20) || "ขนาด";
  if (sizes.some((s) => !s.name)) return { ok: false, error: `มี${optionLabel}ที่ยังไม่ได้ใส่ชื่อ` };
  if (sizes.some((s) => s.surcharge < 0)) return { ok: false, error: "ส่วนต่างราคาต้องไม่ติดลบ" };
  if (pricing === "fixed" && !sizes.length) return { ok: false, error: `สินค้าราคาคงที่ต้องมี${optionLabel}อย่างน้อย 1 อย่าง พร้อมราคา` };
  if (pricing === "fixed" && sizes.some((s) => !(s.price! > 0))) return { ok: false, error: `กรุณาใส่ราคาของทุก${optionLabel}` };

  const md = (s: unknown) => {
    const m = /^(\d{2})-(\d{2})$/.exec(String(s ?? ""));
    return m && Number(m[1]) >= 1 && Number(m[1]) <= 12 && Number(m[2]) >= 1 && Number(m[2]) <= 31 ? m[0] : null;
  };
  const seasonStart = md(input.seasonStart);
  const seasonEnd = md(input.seasonEnd);
  if (Boolean(seasonStart) !== Boolean(seasonEnd)) return { ok: false, error: "กรุณาใส่ช่วงเทศกาลให้ครบทั้งวันเริ่มและวันสิ้นสุด" };

  const pieces = Math.floor(Number(input.piecesPerSheet) || 0);
  const row = {
    id: productId,
    category_id: isUuid(input.categoryId) ? input.categoryId : null,
    name,
    description: clean(input.description, 5000),
    pieces_per_sheet: pieces > 0 ? pieces : null,
    material: clean(input.material, 100),
    pricing,
    option_label: optionLabel,
    unit_label: pricing === "fixed" ? clean(input.unitLabel, 20) || "ชิ้น" : "แผ่น",
    ...(input.shopeeItemId ? { shopee_item_id: clean(input.shopeeItemId, 40) } : {}),
    season_start: seasonStart,
    season_end: seasonEnd,
    design_code: clean(input.designCode, 30),
    designer_id: isUuid(input.designerId) ? input.designerId : null,
    images: (input.images ?? []).filter((i) => isPath(i.path)).slice(0, 20).map((i) => ({ path: i.path, thumb: isPath(i.thumb) ? i.thumb : i.path })),
    badge_best: Boolean(input.badgeBest),
    badge_new: Boolean(input.badgeNew),
    active: Boolean(input.active),
  };
  if (!isUuid(input.id)) {
    const { data: last } = await db().from("shop_products").select("position").order("position", { ascending: false }).limit(1);
    Object.assign(row, { position: (last?.[0]?.position ?? 0) + 1 });
  }
  const { error } = await db().from("shop_products").upsert(row);
  if (error) return { ok: false, error: error.message };

  // ขนาด/ลายที่ถูกลบออกจากฟอร์ม (ออเดอร์เก่ายังเก็บชื่อ/รหัสไว้)
  const [{ data: oldSizes }, { data: oldDesigns }] = await Promise.all([
    db().from("shop_product_sizes").select("id").eq("product_id", productId),
    db().from("shop_designs").select("id").eq("product_id", productId),
  ]);
  const goneSizes = (oldSizes ?? []).map((x) => x.id).filter((id) => !sizes.some((s) => s.id === id));
  const goneDesigns = (oldDesigns ?? []).map((x) => x.id).filter((id) => !designs.some((d) => d.id === id));
  if (goneSizes.length) await db().from("shop_product_sizes").delete().in("id", goneSizes);
  if (goneDesigns.length) await db().from("shop_designs").delete().in("id", goneDesigns);

  if (sizes.length) {
    const { error: e } = await db()
      .from("shop_product_sizes")
      .upsert(sizes.map((s, i) => ({ ...s, product_id: productId, position: i + 1 })));
    if (e) return { ok: false, error: e.message };
  }
  if (designs.length) {
    const { error: e } = await db()
      .from("shop_designs")
      .upsert(designs.map((d, i) => ({ ...d, product_id: productId, position: i + 1 })));
    if (e) return { ok: false, error: e.code === "23505" ? "รหัส SKU ซ้ำ กรุณาตรวจสอบ" : e.message };
  }
  changed();
  return { ok: true, id: productId, message: "บันทึกสินค้าแล้ว" };
}

export async function setProductActive(id: string, active: boolean): Promise<Result> {
  await requireStaff("admin");
  const { error } = await db().from("shop_products").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  changed();
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<Result> {
  await requireStaff("admin");
  const { error } = await db().from("shop_products").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  changed();
  return { ok: true, message: "ลบสินค้าแล้ว" };
}

// ---------- แพ็กของ ----------

/** ติ๊กหยิบของทีละรายการ (พนักงานทุกคนทำได้) */
export async function setPicked(itemId: string, picked: boolean): Promise<Result> {
  await requireStaff();
  const { error } = await db()
    .from("order_a5_items")
    .update({ picked_at: picked ? new Date().toISOString() : null })
    .eq("id", itemId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function setAllPicked(orderId: string, picked: boolean): Promise<Result> {
  await requireStaff();
  const { error } = await db()
    .from("order_a5_items")
    .update({ picked_at: picked ? new Date().toISOString() : null })
    .eq("order_id", orderId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

// ---------- นำเข้าจาก Shopee ----------

const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** รับเฉพาะรูปจาก CDN ของ Shopee (กันใช้ server ไปโหลดลิงก์อื่น) */
function shopeeImageUrl(raw: unknown) {
  try {
    const u = new URL(String(raw));
    if (u.protocol !== "https:" || !(u.hostname === "cf.shopee.co.th" || /(^|\.)susercontent\.com$/.test(u.hostname))) return null;
    // ตอนทดสอบในเครื่อง (ออกเน็ตไป Shopee ไม่ได้) ชี้ไปที่ server รูปจำลองได้
    const dev = process.env.NODE_ENV !== "production" && process.env.SHOPEE_IMAGE_DEV_BASE;
    return dev ? `${dev.replace(/\/$/, "")}${u.pathname}` : u.toString();
  } catch {
    return null;
  }
}

async function fetchImage(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const ext = IMAGE_TYPES[type];
  const body = await res.arrayBuffer();
  if (!ext || body.byteLength > 5 * 1024 * 1024) return null;
  const path = `catalog/${crypto.randomUUID()}.${ext}`;
  await storage.put(path, body, type);
  return path;
}

/**
 * ดึงรูปจาก Shopee มาเก็บใน R2 (รูปเต็ม + รูปย่อจาก Shopee ที่ต่อท้าย _tn)
 * ส่งมาทีละไม่เกิน 30 รูป คืน { [ลิงก์ Shopee]: { path, thumb } } เฉพาะรูปที่สำเร็จ
 */
export async function importShopeeImages(
  urls: string[],
): Promise<{ ok: true; images: Record<string, { path: string; thumb: string }>; failed: number } | { ok: false; error: string }> {
  await requireStaff("admin");
  const list = [...new Set((Array.isArray(urls) ? urls : []).map(String))].slice(0, 30);
  const images: Record<string, { path: string; thumb: string }> = {};
  let failed = 0;
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const raw = list[next++];
      const url = shopeeImageUrl(raw);
      try {
        const path = url ? await fetchImage(url) : null;
        if (!path) {
          failed++;
          continue;
        }
        const thumb = (await fetchImage(`${url}_tn`).catch(() => null)) ?? path;
        images[raw] = { path, thumb };
      } catch {
        failed++;
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return { ok: true, images, failed };
}

/** รหัสสินค้า Shopee ที่นำเข้าแล้ว และ SKU ที่ใช้แล้วทั้งหมด (ไว้กันซ้ำตอนนำเข้า) */
export async function shopeeImportState(): Promise<{ imported: string[]; skus: string[] }> {
  await requireStaff("admin");
  const [{ data: p }, { data: d }] = await Promise.all([
    db().from("shop_products").select("shopee_item_id").not("shopee_item_id", "is", null),
    db().from("shop_designs").select("sku"),
  ]);
  return { imported: (p ?? []).map((x) => String(x.shopee_item_id)), skus: (d ?? []).map((x) => String(x.sku)) };
}
