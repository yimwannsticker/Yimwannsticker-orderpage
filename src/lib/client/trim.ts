"use client";

import type { Trim } from "../types";

/** สีต่างจากพื้นหลังไม่เกินนี้ (0–255 ต่อช่องสี) ถือว่าเป็นพื้นหลัง (เผื่อ JPG มีจุดรบกวน) */
const TOL = 40;
/** alpha ต่ำกว่านี้ถือว่าโปร่งใส */
const CLEAR = 24;
/** ขอบไฟล์ต้องเป็นสีเดียวกันอย่างน้อยเท่านี้ ถึงจะนับว่ามีพื้นหลังสีพื้น */
const UNIFORM = 0.85;

export interface TrimSuggestion extends Trim {
  /** ชื่อสีภาษาไทย เช่น "สีขาว" */
  label: string;
  /** พื้นที่ที่ตัดออก (0–1) */
  removed: number;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // รูปจาก R2 (ไฟล์เดิม) ต้องขอแบบ CORS ไม่งั้นอ่านพิกเซลไม่ได้
    if (!url.startsWith("blob:") && !url.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("load"));
    img.src = url;
  });
}

function pixels(img: HTMLImageElement, maxSide: number) {
  const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k));
  const h = Math.max(1, Math.round(img.naturalHeight * k));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  return { data: ctx.getImageData(0, 0, w, h).data, w, h };
}

const hex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

function colorLabel(color: string) {
  if (color === "transparent") return "โปร่งใส";
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min > 40) return "สีพื้น";
  if (min > 225) return "สีขาว";
  if (max < 40) return "สีดำ";
  return "สีเทา";
}

/** หาสีพื้นหลังจากขอบไฟล์ (null = ขอบไม่ใช่สีเดียวกัน) */
function borderColor(data: Uint8ClampedArray, w: number, h: number): string | null {
  const edge: number[] = [];
  for (let x = 0; x < w; x++) edge.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) edge.push(y * w, y * w + w - 1);
  let clear = 0;
  const bins = new Map<number, number>();
  for (const p of edge) {
    const i = p * 4;
    if (data[i + 3] < CLEAR) {
      clear++;
      continue;
    }
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    bins.set(key, (bins.get(key) ?? 0) + 1);
  }
  if (clear / edge.length >= UNIFORM) return "transparent";
  // ค่าเฉลี่ยของกลุ่มสีที่เจอบ่อยที่สุด
  const top = [...bins.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top) return null;
  let r = 0, g = 0, b = 0, n = 0;
  for (const p of edge) {
    const i = p * 4;
    if (data[i + 3] < CLEAR) continue;
    if ((((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4)) !== top[0]) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  const c = [r / n, g / n, b / n].map(Math.round) as [number, number, number];
  let match = 0;
  for (const p of edge) {
    const i = p * 4;
    if (data[i + 3] >= CLEAR && isBg(data, i, c)) match++;
  }
  return match / edge.length >= UNIFORM ? hex(...c) : null;
}

function isBg(data: Uint8ClampedArray, i: number, c: [number, number, number] | null) {
  if (data[i + 3] < CLEAR) return true;
  if (!c) return false;
  return Math.abs(data[i] - c[0]) <= TOL && Math.abs(data[i + 1] - c[1]) <= TOL && Math.abs(data[i + 2] - c[2]) <= TOL;
}

const rgb = (color: string): [number, number, number] | null =>
  color === "transparent" ? null : ([1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)) as [number, number, number]);

const cache = new Map<string, Promise<TrimSuggestion | null>>();

/**
 * หาพื้นหลังสีพื้นรอบงาน (ขาว ดำ เทา หรือโปร่งใส) จากรูปตัวอย่าง
 * คืนกรอบส่วนงานจริง หรือ null ถ้าไม่มีพื้นที่ว่างให้ตัด / อ่านรูปไม่ได้
 */
export function detectTrim(url: string): Promise<TrimSuggestion | null> {
  if (!cache.has(url)) cache.set(url, detect(url).catch(() => null));
  return cache.get(url)!;
}

async function detect(url: string): Promise<TrimSuggestion | null> {
  const img = await loadImage(url);
  const { data, w, h } = pixels(img, 1000);
  const color = borderColor(data, w, h);
  if (!color) return null;
  const c = rgb(color);
  // แถว/คอลัมน์ที่มีส่วนงาน (ต้องมีจุดไม่ใช่พื้นหลังมากพอ กันจุดรบกวน)
  const minHits = Math.max(1, Math.round(Math.max(w, h) * 0.003));
  const rows = new Uint32Array(h);
  const cols = new Uint32Array(w);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (isBg(data, (y * w + x) * 4, c)) continue;
      rows[y]++;
      cols[x]++;
    }
  const first = (a: Uint32Array) => a.findIndex((v) => v >= minHits);
  const last = (a: Uint32Array) => a.length - 1 - [...a].reverse().findIndex((v) => v >= minHits);
  const x0 = first(cols);
  const y0 = first(rows);
  if (x0 < 0 || y0 < 0) return null;
  const x1 = last(cols);
  const y1 = last(rows);
  const t = { x: x0 / w, y: y0 / h, w: (x1 - x0 + 1) / w, h: (y1 - y0 + 1) / h };
  const removed = 1 - t.w * t.h;
  // แทบไม่มีขอบว่าง ไม่ต้องเสนอ
  if (t.w > 0.97 && t.h > 0.97) return null;
  return { ...t, color, label: colorLabel(color), removed };
}

/**
 * รูปหลังตัดพื้นหลัง: ครอปตามกรอบ แล้วทำพื้นหลังที่ต่อกับขอบให้โปร่งใส
 * (สีเดียวกันที่อยู่ข้างในงานไม่ถูกลบ) ใช้แสดงให้ลูกค้าตรวจ
 */
export async function renderTrimmed(url: string, trim: Trim, maxSide = 1600): Promise<string> {
  const img = await loadImage(url);
  const sw = img.naturalWidth * trim.w;
  const sh = img.naturalHeight * trim.h;
  const k = Math.min(1, maxSide / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * k));
  const h = Math.max(1, Math.round(sh * k));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, img.naturalWidth * trim.x, img.naturalHeight * trim.y, sw, sh, 0, 0, w, h);
  const im = ctx.getImageData(0, 0, w, h);
  const d = im.data;
  const c = rgb(trim.color);
  // flood fill จากขอบ
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (p: number) => {
    if (!seen[p] && isBg(d, p * 4, c)) {
      seen[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const p = stack.pop()!;
    d[p * 4 + 3] = 0;
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < w * (h - 1)) push(p + w);
  }
  ctx.putImageData(im, 0, 0);
  return canvas.toDataURL("image/png");
}
