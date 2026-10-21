import type { PriceTier, ProductKey, Settings } from "./types";

type PricingSettings = Pick<
  Settings,
  "tiers" | "minPerFile" | "shippingFee" | "freeShippingMin" | "promo" | "fixFileFee"
>;

export interface QuoteItemInput {
  product: ProductKey | null;
  qty: number;
  freeQty?: number;
  fixService?: boolean;
}

export interface QuoteLine {
  unitPrice: number;
  lineTotal: number;
  fixFee: number;
}

export type Nudge =
  | { kind: "shipping"; need: number }
  | { kind: "tier"; need: number; saveMin: number; saveMax: number };

export interface Quote {
  totalSheets: number;
  tier: PriceTier;
  lines: QuoteLine[];
  subtotal: number;
  fixFeeTotal: number;
  shipping: number;
  total: number;
  freeSheets: number;
  /** ยอดสะสมก่อนออเดอร์นี้ */
  prevPoints: number;
  /** ต้องสะสมอีกกี่แผ่นถึงจะได้แถมรอบถัดไป */
  toNextFree: number;
  nudge: Nudge | null;
}

export function sortedTiers(tiers: PriceTier[]) {
  return [...tiers].sort((a, b) => a.min - b.min);
}

/** หาขั้นราคาจากจำนวนรวมทุกไฟล์ทุกประเภท */
export function findTier(tiers: PriceTier[], totalSheets: number): PriceTier {
  const list = sortedTiers(tiers);
  let tier = list[0];
  for (const t of list) if (totalSheets >= t.min) tier = t;
  return tier;
}

export function freeSheetsFor(promo: Settings["promo"], prevPoints: number, sheets: number) {
  if (!promo.enabled || promo.every <= 0 || promo.free <= 0) return 0;
  const before = Math.floor(Math.max(0, prevPoints) / promo.every);
  const after = Math.floor(Math.max(0, prevPoints + sheets) / promo.every);
  return Math.max(0, after - before) * promo.free;
}

export function toNextFree(promo: Settings["promo"], points: number) {
  if (!promo.enabled || promo.every <= 0) return 0;
  const rem = points % promo.every;
  return promo.every - rem;
}

export function computeQuote(s: PricingSettings, items: QuoteItemInput[], prevPoints = 0): Quote {
  const totalSheets = items.reduce((sum, it) => sum + Math.max(0, Math.floor(it.qty || 0)), 0);
  const tier = findTier(s.tiers, totalSheets);
  const lines = items.map((it) => {
    const qty = Math.max(0, Math.floor(it.qty || 0));
    const unitPrice = it.product ? tier[it.product] : 0;
    return {
      unitPrice,
      lineTotal: unitPrice * qty,
      fixFee: it.fixService ? s.fixFileFee : 0,
    };
  });
  const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
  const fixFeeTotal = lines.reduce((a, l) => a + l.fixFee, 0);
  const shipping = totalSheets > 0 && totalSheets < s.freeShippingMin ? s.shippingFee : 0;
  const freeSheets = freeSheetsFor(s.promo, prevPoints, totalSheets);

  return {
    totalSheets,
    tier,
    lines,
    subtotal,
    fixFeeTotal,
    shipping,
    total: subtotal + fixFeeTotal + shipping,
    freeSheets,
    prevPoints,
    toNextFree: toNextFree(s.promo, prevPoints + totalSheets),
    nudge: computeNudge(s, items, totalSheets, tier, shipping),
  };
}

function computeNudge(
  s: PricingSettings,
  items: QuoteItemInput[],
  totalSheets: number,
  tier: PriceTier,
  shipping: number,
): Nudge | null {
  if (totalSheets <= 0) return null;
  const candidates: Nudge[] = [];
  if (shipping > 0) candidates.push({ kind: "shipping", need: s.freeShippingMin - totalSheets });

  const next = sortedTiers(s.tiers).find((t) => t.min > totalSheets);
  if (next) {
    const products = new Set(items.map((i) => i.product).filter(Boolean) as ProductKey[]);
    if (products.size === 0) products.add("paper");
    const saves = [...products].map((p) => tier[p] - next[p]).filter((v) => v > 0);
    if (saves.length) {
      candidates.push({
        kind: "tier",
        need: next.min - totalSheets,
        saveMin: Math.min(...saves),
        saveMax: Math.max(...saves),
      });
    }
  }
  if (!candidates.length) return null;
  // แสดงอันที่ใกล้ที่สุด ถ้าเท่ากันเลือกส่งฟรีก่อน
  return candidates.sort((a, b) => a.need - b.need)[0];
}

export function nudgeText(n: Nudge) {
  if (n.kind === "shipping") return `สั่งเพิ่มอีก ${n.need} แผ่น ส่งฟรี`;
  const save = n.saveMin === n.saveMax ? `${n.saveMin}` : `${n.saveMin}–${n.saveMax}`;
  return `สั่งเพิ่มอีก ${n.need} แผ่น ทุกแผ่นถูกลงแผ่นละ ${save} บาท`;
}

/** แบ่งแผ่นแถมเริ่มต้น: ให้ไฟล์ที่สั่งเยอะที่สุด */
export function defaultFreeAllocation(qtys: number[], free: number) {
  const out = qtys.map(() => 0);
  if (!qtys.length || free <= 0) return out;
  let best = 0;
  qtys.forEach((q, i) => {
    if (q > qtys[best]) best = i;
  });
  out[best] = free;
  return out;
}

export interface ItemValidation {
  ok: boolean;
  message?: string;
}

export function validateItems(
  s: Pick<Settings, "minPerFile">,
  items: (QuoteItemInput & { checkLevel?: string | null; acceptRisk?: boolean })[],
  freeSheets: number,
): ItemValidation {
  if (!items.length) return { ok: false, message: "ยังไม่มีไฟล์ในออเดอร์" };
  for (const [i, it] of items.entries()) {
    if (!it.product) return { ok: false, message: `ไฟล์ที่ ${i + 1}: กรุณาเลือกประเภทสติกเกอร์` };
    if (!Number.isInteger(it.qty) || it.qty < s.minPerFile)
      return { ok: false, message: `ไฟล์ที่ ${i + 1}: ขั้นต่ำ ${s.minPerFile} แผ่น` };
    if (it.checkLevel === "red" && !it.acceptRisk && !it.fixService)
      return {
        ok: false,
        message: `ไฟล์ที่ ${i + 1}: ไฟล์ต้องแก้ไข กรุณาติ๊กยอมรับ หรือเลือกให้ร้านช่วยแก้ไฟล์`,
      };
  }
  const allocated = items.reduce((a, it) => a + (it.freeQty ?? 0), 0);
  if (items.some((it) => (it.freeQty ?? 0) < 0 || !Number.isInteger(it.freeQty ?? 0)))
    return { ok: false, message: "จำนวนแผ่นแถมไม่ถูกต้อง" };
  if (allocated !== freeSheets)
    return { ok: false, message: `กรุณาแบ่งแผ่นแถมให้ครบ ${freeSheets} แผ่น (ตอนนี้ ${allocated})` };
  return { ok: true };
}
