import { NextResponse } from "next/server";
import { STORAGE_BUCKET, fileExt } from "@/lib/constants";
import { checkPdfLike } from "@/lib/check/pdf-server";
import { checkPsd } from "@/lib/check/psd-server";
import { bad, readJson } from "@/lib/server/http";
import { db } from "@/lib/supabase/admin";
import type { CheckResult } from "@/lib/types";

export const maxDuration = 60;

/**
 * ตรวจไฟล์หลังอัปโหลด
 * - PDF / AI / PSD: ดาวน์โหลดจาก Storage มาตรวจฝั่ง server
 * - JPG / PNG: ตรวจใน browser แล้วส่งผลมาเก็บ
 */
export async function POST(req: Request) {
  const body = await readJson<{ uploadId: string; clientCheck?: CheckResult }>(req);
  if (!body?.uploadId) return bad("ข้อมูลไม่ถูกต้อง");
  const { data: up } = await db()
    .from("uploads")
    .select("id, path, kind, file_name, used")
    .eq("id", body.uploadId)
    .maybeSingle();
  if (!up || up.kind !== "artwork") return bad("ไม่พบไฟล์", 404);

  const ext = fileExt(up.file_name);
  let result: CheckResult;
  if (ext === "pdf" || ext === "ai" || ext === "psd") {
    const { data: blob, error } = await db().storage.from(STORAGE_BUCKET).download(up.path);
    if (error || !blob) return bad("ยังอัปโหลดไฟล์ไม่เสร็จ กรุณาลองใหม่", 409);
    const buf = Buffer.from(await blob.arrayBuffer());
    try {
      result = ext === "psd" ? checkPsd(buf) : await checkPdfLike(buf, ext);
    } catch (e) {
      console.error("check failed", e);
      result = {
        level: "yellow",
        title: "รอกราฟิกตรวจ",
        issues: [{ level: "yellow", message: "ระบบตรวจไฟล์นี้อัตโนมัติไม่ได้ กราฟิกจะตรวจให้ภายหลัง" }],
        info: { kind: ext, needsManualReview: true },
        checkedBy: "server",
      };
    }
  } else {
    const c = body.clientCheck;
    if (!c || !["green", "yellow", "red"].includes(c.level)) return bad("ไม่มีผลตรวจไฟล์");
    result = { ...c, checkedBy: "browser" };
  }
  await db().from("uploads").update({ check_result: result }).eq("id", up.id);
  return NextResponse.json({ result });
}
