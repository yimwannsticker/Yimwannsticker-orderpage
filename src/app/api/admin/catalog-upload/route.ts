import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getStaff } from "@/lib/server/auth";
import { bad, readJson } from "@/lib/server/http";
import * as storage from "@/lib/server/storage";

const TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

/** แอดมินอัปโหลดรูปสินค้า/ลาย/แบนเนอร์ (ย่อขนาดใน browser มาแล้ว) */
export async function POST(req: Request) {
  const staff = await getStaff();
  if (staff?.role !== "admin") return bad("ไม่มีสิทธิ์", 403);
  const body = await readJson<{ files: { type: string }[] }>(req);
  const files = (body?.files ?? []).slice(0, 200);
  if (!files.length || files.some((f) => !TYPES[f.type])) return bad("รองรับเฉพาะรูป webp / jpg / png");
  const out = await Promise.all(
    files.map(async (f) => {
      const path = `catalog/${crypto.randomUUID()}.${TYPES[f.type]}`;
      return { path, signedUrl: await storage.uploadUrl(path) };
    }),
  );
  return NextResponse.json({ files: out });
}
