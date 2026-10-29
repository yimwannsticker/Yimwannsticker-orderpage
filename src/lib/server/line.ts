import "server-only";
import crypto from "node:crypto";
import { carrierInfo, trackingUrl } from "../constants";

// ตอนทดสอบในเครื่องชี้ไปที่ server จำลองได้ (ใช้ไม่ได้บนเว็บจริง)
const API = (process.env.NODE_ENV !== "production" && process.env.LINE_API_DEV_BASE) || "https://api.line.me";

export function lineLoginEnabled() {
  return Boolean(process.env.LINE_LOGIN_CHANNEL_ID && process.env.LINE_LOGIN_CHANNEL_SECRET);
}

export function messagingEnabled() {
  return Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN);
}

function token() {
  return process.env.LINE_CHANNEL_ACCESS_TOKEN!;
}

export function verifySignature(body: string, signature: string | null) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const mac = crypto.createHmac("sha256", secret).update(body).digest("base64");
  const a = Buffer.from(mac);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function call(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`LINE API ${path} ${res.status}: ${await res.text()}`);
  return res.status === 200 ? res.json().catch(() => ({})) : {};
}

export async function reply(replyToken: string, messages: object[]) {
  return call("/v2/bot/message/reply", { method: "POST", body: JSON.stringify({ replyToken, messages }) });
}

/** push ใช้เฉพาะตอนแจ้งเลขแทร็ค 1 ข้อความต่อออเดอร์ */
export async function pushTracking(
  to: string,
  o: { orderNo: string; trackingNo: string; carrier: string; statusUrl: string },
  template: string,
) {
  const carrierName = carrierInfo(o.carrier)?.label ?? o.carrier;
  const trackUrl = trackingUrl(o.carrier, o.trackingNo) ?? o.statusUrl;
  const text = template
    .replaceAll("{orderNo}", o.orderNo)
    .replaceAll("{trackingNo}", o.trackingNo)
    .replaceAll("{carrier}", carrierName);
  const flex = {
    type: "flex",
    altText: text.slice(0, 390),
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: "จัดส่งแล้ว 🎉", weight: "bold", size: "xl", color: "#006A52" },
          { type: "text", text: text, wrap: true, size: "sm", color: "#555555" },
          { type: "separator" },
          row("เลขออเดอร์", o.orderNo),
          row("ขนส่ง", carrierName),
          row("เลขพัสดุ", o.trackingNo),
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "button", style: "primary", color: "#006A52", action: { type: "uri", label: "ติดตามพัสดุ", uri: trackUrl } },
          { type: "button", style: "link", action: { type: "uri", label: "ดูรายละเอียดออเดอร์", uri: o.statusUrl } },
        ],
      },
    },
  };
  return call("/v2/bot/message/push", { method: "POST", body: JSON.stringify({ to, messages: [flex] }) });
}

/** แจ้งสถานะออเดอร์ (การ์ดหัวข้อ + ข้อความ + ปุ่มดูออเดอร์) */
export async function pushStatus(to: string, m: { title: string; text: string; orderNo: string; statusUrl: string; button?: string }) {
  const flex = {
    type: "flex",
    altText: `${m.title} · ${m.orderNo}`.slice(0, 390),
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: m.title, weight: "bold", size: "lg", color: "#006A52", wrap: true },
          { type: "text", text: m.text, wrap: true, size: "sm", color: "#555555" },
          { type: "separator" },
          row("เลขออเดอร์", m.orderNo),
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [{ type: "button", style: "primary", color: "#006A52", action: { type: "uri", label: m.button ?? "ดูรายละเอียดออเดอร์", uri: m.statusUrl } }],
      },
    },
  };
  return call("/v2/bot/message/push", { method: "POST", body: JSON.stringify({ to, messages: [flex] }) });
}

function row(label: string, value: string) {
  return {
    type: "box",
    layout: "baseline",
    contents: [
      { type: "text", text: label, size: "sm", color: "#999999", flex: 3 },
      { type: "text", text: value, size: "sm", color: "#222222", flex: 5, wrap: true, weight: "bold" },
    ],
  };
}

export async function getQuota(): Promise<{ limit: number | null; used: number } | null> {
  if (!messagingEnabled()) return null;
  try {
    const [q, c] = await Promise.all([call("/v2/bot/message/quota"), call("/v2/bot/message/quota/consumption")]);
    return { limit: q.type === "limited" ? q.value : null, used: c.totalUsage ?? 0 };
  } catch (e) {
    console.error(e);
    return null;
  }
}

// ---------- LINE Login ----------

export function loginUrl(state: string, redirectUri: string) {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINE_LOGIN_CHANNEL_ID!,
    redirect_uri: redirectUri,
    state,
    scope: "profile openid",
    // ชวนลูกค้าแอดเพื่อน LINE OA ของร้าน (ต้องผูก OA กับ Login channel ใน LINE Developers)
    bot_prompt: "aggressive",
  });
  return `https://access.line.me/oauth2/v2.1/authorize?${p}`;
}

export async function exchangeCode(code: string, redirectUri: string) {
  const res = await fetch(`${API}/oauth2/v2.1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: process.env.LINE_LOGIN_CHANNEL_ID!,
      client_secret: process.env.LINE_LOGIN_CHANNEL_SECRET!,
    }),
  });
  if (!res.ok) throw new Error(`LINE token ${res.status}`);
  const tok = (await res.json()) as { access_token: string };
  const prof = await fetch(`${API}/v2/profile`, { headers: { Authorization: `Bearer ${tok.access_token}` } });
  if (!prof.ok) throw new Error(`LINE profile ${prof.status}`);
  return (await prof.json()) as { userId: string; displayName: string; pictureUrl?: string };
}
