import "server-only";
import { db } from "../supabase/admin";
import * as storage from "./storage";

const KEEP = 8;
const EVERY_MS = 7 * 86400_000;

export async function allRows(table: string) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from(table).select("*").range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

const TABLES = [
  "orders",
  "order_items",
  "customers",
  "settings",
  // ร้าน A5 (สินค้า ลาย รายการในออเดอร์)
  "order_a5_items",
  "shop_categories",
  "designers",
  "shop_products",
  "shop_product_sizes",
  "shop_designs",
];

/** ข้อมูลทุกตารางสำหรับกู้คืน */
export async function backupData() {
  const tables = Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, await allRows(t)] as const)));
  return { exportedAt: new Date().toISOString(), ...tables };
}

/** สำรองลง R2 แล้วลบชุดเก่าเกิน 8 ชุด */
export async function saveBackup() {
  const body = new TextEncoder().encode(JSON.stringify(await backupData()));
  const stamp = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 16).replace(/[T:]/g, "-");
  const path = `backups/yimwann-backup-${stamp}.json`;
  await storage.put(path, body.buffer as ArrayBuffer, "application/json");
  await db().from("backups").insert({ path, size_bytes: body.byteLength });

  const { data } = await db().from("backups").select("id, path").order("created_at", { ascending: false });
  const old = (data ?? []).slice(KEEP);
  if (old.length) {
    await storage.remove(old.map((b) => b.path));
    await db().from("backups").delete().in("id", old.map((b) => b.id));
  }
  return { path, size: body.byteLength };
}

export async function listBackups() {
  const { data } = await db().from("backups").select("id, path, size_bytes, created_at").order("created_at", { ascending: false });
  return data ?? [];
}

/** เรียกจากงานตั้งเวลารายชั่วโมง: สำรองเมื่อชุดล่าสุดเก่ากว่า 7 วัน (รอบที่พลาดไปจะทำต่อเอง) */
export async function backupIfDue() {
  const { data } = await db().from("backups").select("created_at").order("created_at", { ascending: false }).limit(1);
  const last = data?.[0]?.created_at ? new Date(data[0].created_at).getTime() : 0;
  if (Date.now() - last < EVERY_MS) return null;
  return saveBackup();
}
