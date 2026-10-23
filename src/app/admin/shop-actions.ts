"use server";

import crypto from "node:crypto";
import { revalidatePath, updateTag } from "next/cache";
import { requireStaff } from "@/lib/server/auth";
import { CATALOG_TAG } from "@/lib/server/shop";
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

// ---------- นักออกแบบ ----------

export async function saveDesigner(input: { id?: string; name: string; active: boolean }): Promise<Result> {
  await requireStaff("admin");
  const name = clean(input.name, 80);
  if (!name) return { ok: false, error: "กรุณาใส่ชื่อนักออกแบบ" };
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
  sizes: { id?: string; name: string; surcharge: number }[];
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

  const sizes = (input.sizes ?? []).slice(0, 20).map((s) => ({
    id: isUuid(s.id) ? s.id : crypto.randomUUID(),
    name: clean(s.name, 60),
    surcharge: Math.round((Number(s.surcharge) || 0) * 100) / 100,
  }));
  if (sizes.some((s) => !s.name)) return { ok: false, error: "มีขนาดที่ยังไม่ได้ใส่ชื่อ" };
  if (sizes.some((s) => s.surcharge < 0)) return { ok: false, error: "ส่วนต่างราคาต้องไม่ติดลบ" };

  const pieces = Math.floor(Number(input.piecesPerSheet) || 0);
  const row = {
    id: productId,
    category_id: isUuid(input.categoryId) ? input.categoryId : null,
    name,
    description: clean(input.description, 5000),
    pieces_per_sheet: pieces > 0 ? pieces : null,
    material: clean(input.material, 100),
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
