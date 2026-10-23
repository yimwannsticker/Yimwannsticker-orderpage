"use client";

import { useSyncExternalStore } from "react";
import type { A5CartLine, DraftItem } from "../types";

/** ตะกร้าสติกเกอร์สำเร็จรูป A5 เก็บในเครื่องลูกค้า (งาน A3+ อยู่ในร่างออเดอร์เดิม yw_draft_v1) */
const CART_KEY = "yw_cart_a5_v1";
export const DRAFT_KEY = "yw_draft_v1";
const EVENT = "yw-cart-change";

const EMPTY: A5CartLine[] = [];
let cache: { raw: string | null; lines: A5CartLine[] } = { raw: null, lines: EMPTY };

function read(): A5CartLine[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(CART_KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cache.raw) return cache.lines;
  let lines: A5CartLine[] = EMPTY;
  try {
    const parsed = raw ? (JSON.parse(raw) as A5CartLine[]) : [];
    lines = parsed.filter((l) => l && l.productId && l.designId && Number(l.qty) > 0);
  } catch {
    lines = EMPTY;
  }
  cache = { raw, lines };
  return lines;
}

export function getCart() {
  return read();
}

export function setCart(lines: A5CartLine[]) {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(lines.filter((l) => l.qty > 0)));
  } catch {
    // พื้นที่เต็ม/โหมดส่วนตัว
  }
  window.dispatchEvent(new Event(EVENT));
}

export const sameLine = (a: A5CartLine, b: Pick<A5CartLine, "designId" | "sizeId">) => a.designId === b.designId && a.sizeId === b.sizeId;

/** เพิ่มหลายลายพร้อมกัน (ลาย+ขนาดเดิมรวมจำนวนให้) */
export function addToCart(add: A5CartLine[]) {
  const lines = [...read()];
  for (const a of add) {
    const i = lines.findIndex((l) => sameLine(l, a));
    if (i >= 0) lines[i] = { ...lines[i], qty: lines[i].qty + a.qty };
    else lines.push(a);
  }
  setCart(lines);
}

export function clearCart() {
  setCart([]);
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => (e.key === CART_KEY || e.key === DRAFT_KEY) && cb();
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** ตะกร้า A5 (อัปเดตทุกหน้า/ทุกแท็บอัตโนมัติ) */
export function useCart() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

// ---------- งาน A3+ (ร่างออเดอร์เดิม) ----------

let draftCache: { raw: string | null; items: DraftItem[] } = { raw: null, items: [] };

function readDraftItems(): DraftItem[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(DRAFT_KEY);
  } catch {
    return [];
  }
  if (raw === draftCache.raw) return draftCache.items;
  let items: DraftItem[] = [];
  try {
    const d = raw ? (JSON.parse(raw) as { items?: DraftItem[] }) : null;
    items = (d?.items ?? []).filter((i) => i.status === "done" && (i.uploadId || i.source));
  } catch {
    items = [];
  }
  draftCache = { raw, items };
  return items;
}

const NO_ITEMS: DraftItem[] = [];

/** ไฟล์ A3+ ที่อยู่ในร่างออเดอร์ */
export function useDraftItems() {
  return useSyncExternalStore(subscribe, readDraftItems, () => NO_ITEMS);
}

/** แก้ไฟล์ในร่างออเดอร์จากหน้าตะกร้า */
export function updateDraftItems(fn: (items: DraftItem[]) => DraftItem[]) {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null") ?? { items: [], customer: null, step: 0 };
    d.items = fn(readDraftItems());
    if (!d.items.length) d.step = 0;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(EVENT));
}

/** แจ้งหน้าอื่นว่าร่างออเดอร์เปลี่ยน (ใช้ในหน้าสั่งพิมพ์) */
export function notifyCartChanged() {
  window.dispatchEvent(new Event(EVENT));
}
