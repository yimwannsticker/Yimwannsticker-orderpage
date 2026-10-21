import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { ACCEPTED_EXT, fileExt } from "@/lib/constants";
import { bad, readJson } from "@/lib/server/http";
import { getSettings } from "@/lib/server/settings";
import * as storage from "@/lib/server/storage";
import { db } from "@/lib/supabase/admin";

type Kind = "artwork" | "preview" | "slip";

/** ขอ URL สำหรับอัปโหลดไฟล์ตรงเข้า Storage (ไม่ผ่าน server เพื่อรองรับไฟล์ใหญ่) */
export async function POST(req: Request) {
  const body = await readJson<{ kind: Kind; fileName: string; size: number }>(req);
  if (!body || !["artwork", "preview", "slip"].includes(body.kind)) return bad("ข้อมูลไม่ถูกต้อง");
  const settings = await getSettings();
  const ext = fileExt(body.fileName || "");
  const size = Number(body.size) || 0;

  if (body.kind === "artwork") {
    if (!(ACCEPTED_EXT as readonly string[]).includes(ext))
      return bad("รองรับเฉพาะไฟล์ .jpg .png .pdf .ai .psd");
    if (size > settings.maxFileMb * 1024 * 1024) return bad(`ไฟล์ใหญ่เกิน ${settings.maxFileMb}MB`);
  } else {
    if (!["jpg", "jpeg", "png", "webp"].includes(ext)) return bad("รองรับเฉพาะรูปภาพ .jpg .png");
    if (size > 10 * 1024 * 1024) return bad("รูปใหญ่เกิน 10MB");
  }

  const month = new Date().toISOString().slice(0, 7);
  // ชื่อไฟล์ใน storage ใช้ตัวอักษรอังกฤษเท่านั้น ชื่อจริงเก็บในฐานข้อมูล
  const path = `${body.kind}/${month}/${crypto.randomUUID()}/file.${ext}`;
  const signedUrl = await storage.uploadUrl(path);

  const { data: row, error: insErr } = await db()
    .from("uploads")
    .insert({ path, kind: body.kind, file_name: (body.fileName || "file").slice(0, 200), size })
    .select("id")
    .single();
  if (insErr || !row) return bad("เตรียมอัปโหลดไม่สำเร็จ กรุณาลองใหม่", 500);

  return NextResponse.json({ uploadId: row.id, signedUrl });
}
