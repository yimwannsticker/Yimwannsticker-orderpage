import type { Quote } from "./pricing";
import type { A5Tier, Settings } from "./types";

/**
 * ราคาร้านสำเร็จรูป แยกจากงานพิมพ์ไฟล์ A3+ (ไม่แตะ logic ราคาเดิม)
 * - สติกเกอร์ A5: ราคาส่งขั้นบันได หาขั้นจากจำนวนแผ่น A5 รวมทุกสินค้าทุกลายในตะกร้า + ส่วนต่างตามขนาด
 * - สินค้าราคาคงที่ (การ์ด): ราคาต่อหน่วยตามตัวเลือก ไม่นับเป็นแผ่น A5 ค่าส่งมีเกณฑ์ของตัวเอง (นับเป็นใบ)
 */
export type A5PricingSettings = Pick<Settings, "a5Tiers" | "a5ShippingFee" | "a5FreeShippingMin" | "fixedShippingFee" | "fixedFreeShippingUnits">;

export interface A5QuoteLine {
  qty: number;
  /** ส่วนต่างราคาตามขนาดที่เลือก (บาท/แผ่น) */
  surcharge: number;
  /** สินค้าราคาคงที่: ราคาต่อหน่วย และจำนวนชิ้นต่อหน่วย (เช่น แพ็ค 25 ใบ) */
  fixed?: { price: number; units: number } | null;
}

export type A5Nudge =
  | { kind: "shipping"; need: number }
  | { kind: "tier"; need: number; price: number }
  | { kind: "fixed_shipping"; need: number };

export interface A5Quote {
  /** แผ่น A5 (ราคาขั้นบันได) */
  sheets: number;
  tier: A5Tier;
  lines: { unitPrice: number; lineTotal: number }[];
  /** ยอดรวมทั้ง A5 และสินค้าราคาคงที่ */
  subtotal: number;
  /** ค่าส่งตามเกณฑ์ A5 (0 ถ้าไม่มี A5) */
  shipping: number;
  /** สินค้าราคาคงที่: จำนวนชิ้นรวม ยอด และค่าส่งตามเกณฑ์ของตัวเอง */
  fixedUnits: number;
  fixedSubtotal: number;
  fixedShipping: number;
  hasFixed: boolean;
  nudge: A5Nudge | null;
  fixedNudge: A5Nudge | null;
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
  const sheets = lines.reduce((a, l) => a + (l.fixed ? 0 : qtyOf(l.qty)), 0);
  const tier = findA5Tier(s.a5Tiers, sheets);
  const out = lines.map((l) => {
    const unitPrice = l.fixed ? Number(l.fixed.price) || 0 : tier.price + (Number(l.surcharge) || 0);
    return { unitPrice, lineTotal: unitPrice * qtyOf(l.qty) };
  });
  const subtotal = out.reduce((a, l) => a + l.lineTotal, 0);
  const shipping = sheets > 0 && sheets < s.a5FreeShippingMin ? s.a5ShippingFee : 0;

  const fixedLines = lines.map((l, i) => ({ l, i })).filter((x) => x.l.fixed);
  const hasFixed = fixedLines.some((x) => qtyOf(x.l.qty) > 0);
  const fixedUnits = fixedLines.reduce((a, x) => a + qtyOf(x.l.qty) * Math.max(1, Number(x.l.fixed!.units) || 1), 0);
  const fixedSubtotal = fixedLines.reduce((a, x) => a + out[x.i].lineTotal, 0);
  const fixedShipping = hasFixed && fixedUnits < s.fixedFreeShippingUnits ? s.fixedShippingFee : 0;

  let nudge: A5Nudge | null = null;
  if (sheets > 0) {
    const options: A5Nudge[] = [];
    if (shipping > 0) options.push({ kind: "shipping", need: s.a5FreeShippingMin - sheets });
    const next = sortedA5Tiers(s.a5Tiers).find((t) => t.min > sheets);
    if (next && next.price < tier.price) options.push({ kind: "tier", need: next.min - sheets, price: next.price });
    // ใกล้สุดก่อน ถ้าเท่ากันเลือกส่งฟรี
    nudge = options.sort((a, b) => a.need - b.need)[0] ?? null;
  }
  const fixedNudge: A5Nudge | null = fixedShipping > 0 ? { kind: "fixed_shipping", need: s.fixedFreeShippingUnits - fixedUnits } : null;
  return { sheets, tier, lines: out, subtotal, shipping, fixedUnits, fixedSubtotal, fixedShipping, hasFixed, nudge, fixedNudge };
}

export function a5NudgeText(n: A5Nudge) {
  if (n.kind === "shipping") return `สั่ง A5 เพิ่มอีก ${n.need} แผ่น ส่งฟรี`;
  if (n.kind === "fixed_shipping") return `สั่งการ์ดเพิ่มอีก ${n.need} ใบ ส่งฟรี`;
  return `สั่ง A5 เพิ่มอีก ${n.need} แผ่น ราคาแผ่นละ ${n.price} บาท`;
}

/** ช่วงราคาต่อแผ่นของสินค้า A5 (ราคาขั้นถูกสุด–แพงสุด รวมส่วนต่างขนาด) */
export function a5PriceRange(tiers: A5Tier[], surcharges: number[]) {
  const prices = tiers.map((t) => t.price);
  const adds = surcharges.length ? surcharges : [0];
  return { min: Math.min(...prices) + Math.min(...adds), max: Math.max(...prices) + Math.max(...adds) };
}

/**
 * รวมค่าส่งทั้งออเดอร์ (ส่งกล่องเดียว)
 * - งาน A3+ และ A5 คิดตามเกณฑ์ของแต่ละฝั่ง แล้วเก็บอันที่แพงกว่า
 * - สินค้าราคาคงที่ (การ์ด): ถ้ามีรายการอื่นที่ถึงเกณฑ์ส่งฟรีแล้ว ส่งฟรีทั้งกล่อง
 *   ไม่งั้นคิดตามเกณฑ์การ์ด (เก็บอันที่แพงกว่าเช่นกัน)
 */
export function combineTotals(
  a3: Pick<Quote, "subtotal" | "fixFeeTotal" | "shipping" | "totalSheets">,
  a5: Pick<A5Quote, "subtotal" | "shipping" | "sheets" | "hasFixed" | "fixedShipping">,
) {
  const others = [a3.totalSheets > 0 ? a3.shipping : null, a5.sheets > 0 ? a5.shipping : null].filter((x): x is number => x !== null);
  const othersFee = others.length ? Math.max(...others) : 0;
  let shipping = othersFee;
  if (a5.hasFixed) shipping = others.length && othersFee === 0 ? 0 : Math.max(othersFee, a5.fixedShipping);
  return { shipping, total: a3.subtotal + a3.fixFeeTotal + a5.subtotal + shipping };
}
