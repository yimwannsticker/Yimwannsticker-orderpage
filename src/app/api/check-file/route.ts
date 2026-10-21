import { NextResponse } from "next/server";
import { bad, readJson } from "@/lib/server/http";
import { db } from "@/lib/supabase/admin";
import type { CheckResult } from "@/lib/types";

/**
 * เก็บผลตรวจไฟล์ที่ตรวจใน browser ของลูกค้า (ทุกชนิดไฟล์)
 * ตรวจฝั่งลูกค้าเพื่อให้ทำงานบนโฮสต์ฟรีที่จำกัดเวลาประมวลผล และกราฟิกตรวจซ้ำอีกครั้งในหลังบ้าน
 */
export async function POST(req: Request) {
  const body = await readJson<{ uploadId: string; clientCheck?: CheckResult }>(req);
  if (!body?.uploadId) return bad("ข้อมูลไม่ถูกต้อง");
  const c = body.clientCheck;
  if (!c || !["green", "yellow", "red"].includes(c.level) || !Array.isArray(c.issues)) return bad("ไม่มีผลตรวจไฟล์");
  const { data: up } = await db().from("uploads").select("id, kind, used").eq("id", body.uploadId).maybeSingle();
  if (!up || up.kind !== "artwork" || up.used) return bad("ไม่พบไฟล์", 404);

  const result: CheckResult = {
    level: c.level,
    title: String(c.title ?? "").slice(0, 60),
    issues: c.issues.slice(0, 20).map((i) => ({
      level: i.level,
      message: String(i.message).slice(0, 600),
      ...(i.code ? { code: i.code } : {}),
    })),
    info: c.info ?? {},
    checkedBy: "browser",
  };
  await db().from("uploads").update({ check_result: result }).eq("id", up.id);
  return NextResponse.json({ result });
}
