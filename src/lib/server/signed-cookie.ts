import "server-only";
import crypto from "node:crypto";

function secret() {
  const s = process.env.APP_SECRET;
  if (!s) throw new Error("ยังไม่ได้ตั้งค่า APP_SECRET");
  return s;
}

export function sign(payload: object) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verify<T>(value: string | undefined): T | null {
  if (!value) return null;
  const [body, mac] = value.split(".");
  if (!body || !mac) return null;
  const expected = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString()) as T;
  } catch {
    return null;
  }
}

export const LINE_COOKIE = "yw_line";
export interface LineSession {
  userId: string;
  name: string;
  picture?: string;
}

/** สิทธิ์ใช้ไฟล์เดิมหนึ่งไฟล์ (ออกให้หลังยืนยันชื่อ + เบอร์โทร) */
export interface FileGrant {
  /** order_items.id */
  i: string;
  /** เบอร์โทรเจ้าของ */
  p: string;
  exp: number;
}

/** ลูกค้าที่ยืนยันชื่อ + เบอร์ หรือสั่งจากเครื่องนี้แล้ว (จำไว้ให้ครั้งต่อไป) */
export const ME_COOKIE = "yw_me";
export const ME_DAYS = 90;
export interface MeSession {
  /** เบอร์โทร */
  p: string;
  /** ชื่อผู้รับล่าสุด */
  n: string;
  exp: number;
}
