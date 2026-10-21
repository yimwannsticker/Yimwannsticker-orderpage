import { NextResponse } from "next/server";
import { STORAGE_BUCKET } from "@/lib/constants";
import { getSettings } from "@/lib/server/settings";
import { db } from "@/lib/supabase/admin";

export const maxDuration = 60;

/**
 * งานรายวัน (Vercel Cron):
 * 1) ลบไฟล์ของออเดอร์ที่ส่งของแล้วเกิน N วัน (ตั้งได้ในหลังบ้าน)
 * 2) ลบไฟล์ที่อัปโหลดแต่ไม่ได้สั่งจริงเกิน 3 วัน
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const settings = await getSettings();
  const bucket = db().storage.from(STORAGE_BUCKET);
  const cutoff = new Date(Date.now() - settings.fileRetentionDays * 86400_000).toISOString();

  const { data: orders } = await db()
    .from("orders")
    .select("id, slip_path")
    .eq("status", "shipped")
    .lt("shipped_at", cutoff)
    .is("files_deleted_at", null)
    .limit(100);
  let removedOrders = 0;
  for (const o of orders ?? []) {
    const { data: items } = await db().from("order_items").select("file_path, preview_path").eq("order_id", o.id);
    const paths = [o.slip_path, ...(items ?? []).flatMap((i) => [i.file_path, i.preview_path])].filter(Boolean) as string[];
    if (paths.length) await bucket.remove(paths);
    await db().from("order_items").update({ file_path: null, preview_path: null }).eq("order_id", o.id);
    await db().from("orders").update({ files_deleted_at: new Date().toISOString(), slip_path: null }).eq("id", o.id);
    removedOrders++;
  }

  const staleCutoff = new Date(Date.now() - 3 * 86400_000).toISOString();
  const { data: stale } = await db()
    .from("uploads")
    .select("id, path")
    .eq("used", false)
    .lt("created_at", staleCutoff)
    .limit(500);
  if (stale?.length) {
    await bucket.remove(stale.map((s) => s.path));
    await db().from("uploads").delete().in("id", stale.map((s) => s.id));
  }
  // ประวัติการอัปโหลดที่ใช้แล้วเก็บไว้ไม่จำเป็น
  await db().from("uploads").delete().eq("used", true).lt("created_at", cutoff);

  return NextResponse.json({ removedOrders, removedUploads: stale?.length ?? 0 });
}
