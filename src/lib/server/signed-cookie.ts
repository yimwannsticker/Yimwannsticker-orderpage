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
