import "server-only";
import crypto from "node:crypto";
import { AwsClient } from "aws4fetch";

/**
 * ที่เก็บไฟล์งาน/สลิป: Cloudflare R2 (หรือที่เก็บไฟล์แบบ S3 อื่น เช่น MinIO ตอนพัฒนาในเครื่อง)
 * bucket เป็นแบบ private ทุกไฟล์เข้าถึงผ่านลิงก์ที่เซ็นแล้วและมีวันหมดอายุ
 */
let client: AwsClient | null = null;

function config() {
  const bucket = process.env.R2_BUCKET;
  const endpoint =
    process.env.S3_ENDPOINT || (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : "");
  if (!bucket || !endpoint || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY)
    throw new Error("ยังไม่ได้ตั้งค่า R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET");
  if (!client) {
    client = new AwsClient({
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      service: "s3",
      region: process.env.S3_REGION || "auto",
    });
  }
  return { client, base: `${endpoint.replace(/\/$/, "")}/${bucket}` };
}

function objectUrl(path: string) {
  const { base } = config();
  return `${base}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

async function presign(
  method: "GET" | "PUT",
  path: string,
  expires: number,
  query?: Record<string, string>,
  datetime?: string,
) {
  const { client } = config();
  const url = new URL(objectUrl(path));
  url.searchParams.set("X-Amz-Expires", String(expires));
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);
  const signed = await client.sign(url.toString(), { method, aws: { signQuery: true, ...(datetime ? { datetime } : {}) } });
  return signed.url;
}

/**
 * ลิงก์รูปสินค้า/แบนเนอร์ในร้าน: เซ็นด้วยเวลาเที่ยงคืน (UTC) ของวันนี้ ลิงก์จึงเหมือนเดิมทั้งวัน
 * browser แคชรูปได้ ไม่ต้องโหลดใหม่ทุกครั้งที่เปิดหน้า (ลิงก์ใช้ได้ 7 วัน)
 */
export function imageUrl(path: string | null | undefined) {
  if (!path) return Promise.resolve(null);
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return presign("GET", path, 7 * 24 * 60 * 60, { "response-cache-control": "public, max-age=86400" }, `${day}T000000Z`);
}

/** ลิงก์ให้ browser อัปโหลดไฟล์ตรง (PUT) อายุ 2 ชั่วโมง */
export function uploadUrl(path: string) {
  return presign("PUT", path, 2 * 60 * 60);
}

/** ลิงก์ดู/ดาวน์โหลดไฟล์ */
export function readUrl(path: string, expires = 60 * 30, downloadName?: string) {
  return presign(
    "GET",
    path,
    Math.min(expires, 7 * 24 * 60 * 60),
    downloadName
      ? { "response-content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}` }
      : undefined,
  );
}

export async function exists(path: string) {
  const { client } = config();
  const res = await client.fetch(objectUrl(path), { method: "HEAD" });
  return res.ok;
}

export async function download(path: string) {
  const { client } = config();
  const res = await client.fetch(objectUrl(path));
  if (!res.ok) return null;
  return res.blob();
}

/** ลบหลายไฟล์ในครั้งเดียว (S3 DeleteObjects สูงสุด 1,000 ไฟล์ต่อครั้ง) */
export async function remove(paths: string[]) {
  const list = [...new Set(paths.filter(Boolean))];
  if (!list.length) return;
  const { client, base } = config();
  for (let i = 0; i < list.length; i += 1000) {
    const chunk = list.slice(i, i + 1000);
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const body = `<?xml version="1.0" encoding="UTF-8"?><Delete><Quiet>true</Quiet>${chunk
      .map((k) => `<Object><Key>${esc(k)}</Key></Object>`)
      .join("")}</Delete>`;
    const bytes = new TextEncoder().encode(body);
    const md5 = crypto.createHash("md5").update(bytes).digest("base64");
    const res = await client.fetch(`${base}?delete`, {
      method: "POST",
      body: bytes,
      headers: { "Content-Type": "application/xml", "Content-MD5": md5, "Content-Length": String(bytes.length) },
    });
    if (!res.ok) console.error("ลบไฟล์ไม่สำเร็จ", res.status, await res.text());
  }
}
