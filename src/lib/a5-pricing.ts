import type { Quote } from "./pricing";
import type { A5Tier, Settings } from "./types";

/**
 * ราคาสติกเกอร์สำเร็จรูป A5 แยกจากงานพิมพ์ไฟล์ A3+ (ไม่แตะ logic ราคาเดิม)
 * ราคาส่งขั้นบันได หาขั้นจากจำนวนแผ่น A5 รวมทุกสินค้าทุกลายในตะกร้า แล้วบวกส่วนต่างตามขนาด (ถ้ามี)
 */
export type A5PricingSettings = Pick<Settings, "a5Tiers" | "a5ShippingFee" | "a5FreeShippingMin">;

export interface A5QuoteLine {
  qty: number;
  /** ส่วนต่างราคาตามขนาดที่เลือก (บาท/แผ่น) */
  surcharge: number;
}

export type A5Nudge = { kind: "shipping"; need: number } | { kind: "tier"; need: number; price: number };

export interface A5Quote {
  sheets: number;
  tier: A5Tier;
  lines: { unitPrice: number; lineTotal: number }[];
  subtotal: number;
  shipping: number;
  nudge: A5Nudge | null;
}

export function sortedA5Tiers(tiers: A5Tier[]) {
  return [...tiers].sort((a, b) => a.min - b.min);
}

export function findA5Tier(tiers: A5Tier[], sheets: number): A5Tier {
  const list = sortedA5Tiers(tiers);
  let tier = list[0];
  for (const t of list) if (sheets >= t.min) tier = t;
  return tier;
}

const qtyOf = (n: number) => Math.max(0, Math.floor(Number(n) || 0));

export function computeA5Quote(s: A5PricingSettings, lines: A5QuoteLine[]): A5Quote {
  const sheets = lines.reduce((a, l) => a + qtyOf(l.qty), 0);
  const tier = findA5Tier(s.a5Tiers, sheets);
  const out = lines.map((l) => {
    const unitPrice = tier.price + (Number(l.surcharge) || 0);
    return { unitPrice, lineTotal: unitPrice * qtyOf(l.qty) };
  });
  const subtotal = out.reduce((a, l) => a + l.lineTotal, 0);
  const shipping = sheets > 0 && sheets < s.a5FreeShippingMin ? s.a5ShippingFee : 0;

  let nudge: A5Nudge | null = null;
  if (sheets > 0) {
    const options: A5Nudge[] = [];
    if (shipping > 0) options.push({ kind: "shipping", need: s.a5FreeShippingMin - sheets });
    const next = sortedA5Tiers(s.a5Tiers).find((t) => t.min > sheets);
    if (next && next.price < tier.price) options.push({ kind: "tier", need: next.min - sheets, price: next.price });
    // ใกล้สุดก่อน ถ้าเท่ากันเลือกส่งฟรี
    nudge = options.sort((a, b) => a.need - b.need)[0] ?? null;
  }
  return { sheets, tier, lines: out, subtotal, shipping, nudge };
}

export function a5NudgeText(n: A5Nudge) {
  if (n.kind === "shipping") return `สั่ง A5 เพิ่มอีก ${n.need} แผ่น ส่งฟรี`;
  return `สั่ง A5 เพิ่มอีก ${n.need} แผ่น ราคาแผ่นละ ${n.price} บาท`;
}

/** ช่วงราคาต่อแผ่นของสินค้า (ราคาขั้นถูกสุด–แพงสุด รวมส่วนต่างขนาด) */
export function a5PriceRange(tiers: A5Tier[], surcharges: number[]) {
  const prices = tiers.map((t) => t.price);
  const adds = surcharges.length ? surcharges : [0];
  return { min: Math.min(...prices) + Math.min(...adds), max: Math.max(...prices) + Math.max(...adds) };
}

/**
 * รวมยอดออเดอร์ที่มีทั้ง A3+ และ A5
 * ค่าส่งคิดแยกตามเกณฑ์ของแต่ละฝั่ง แล้วเก็บอันที่แพงกว่า (ส่งกล่องเดียว)
 */
export function combineTotals(a3: Pick<Quote, "subtotal" | "fixFeeTotal" | "shipping">, a5: Pick<A5Quote, "subtotal" | "shipping">) {
  const shipping = Math.max(a3.shipping, a5.shipping);
  return { shipping, total: a3.subtotal + a3.fixFeeTotal + a5.subtotal + shipping };
}
