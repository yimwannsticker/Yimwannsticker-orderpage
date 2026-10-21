import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS as S } from "@/lib/constants";
import { computeQuote, freeSheetsFor, nudgeText, validateItems } from "@/lib/pricing";

describe("computeQuote", () => {
  it("ใช้ขั้นราคาจากจำนวนรวมทุกประเภท", () => {
    const q = computeQuote(S, [
      { product: "paper", qty: 30 },
      { product: "pp", qty: 30 },
    ]);
    expect(q.totalSheets).toBe(60);
    expect(q.lines.map((l) => l.unitPrice)).toEqual([24, 28]);
    expect(q.subtotal).toBe(30 * 24 + 30 * 28);
    expect(q.shipping).toBe(0);
  });

  it("ค่าส่งเมื่อน้อยกว่า 20 แผ่น และข้อความกระตุ้นอันที่ใกล้สุด", () => {
    const q = computeQuote(S, [{ product: "paper", qty: 8 }]);
    expect(q.lines[0].unitPrice).toBe(30);
    expect(q.shipping).toBe(50);
    expect(q.total).toBe(8 * 30 + 50);
    expect(q.nudge).toEqual({ kind: "tier", need: 2, saveMin: 5, saveMax: 5 });
    expect(nudgeText(q.nudge!)).toBe("สั่งเพิ่มอีก 2 แผ่น ทุกแผ่นถูกลงแผ่นละ 5 บาท");

    const q2 = computeQuote(S, [{ product: "paper", qty: 15 }]);
    expect(q2.nudge).toEqual({ kind: "shipping", need: 5 });
    expect(nudgeText(q2.nudge!)).toBe("สั่งเพิ่มอีก 5 แผ่น ส่งฟรี");
  });

  it("ส่วนลดต่างกันตามประเภทแสดงเป็นช่วง", () => {
    const q = computeQuote(S, [
      { product: "paper", qty: 20 },
      { product: "pp", qty: 25 },
    ]);
    expect(q.nudge).toEqual({ kind: "tier", need: 5, saveMin: 1, saveMax: 1 });
    const q2 = computeQuote(S, [
      { product: "paper", qty: 5 },
      { product: "pp", qty: 3 },
    ]);
    expect(nudgeText(q2.nudge!)).toBe("สั่งเพิ่มอีก 2 แผ่น ทุกแผ่นถูกลงแผ่นละ 5–6 บาท");
  });

  it("ค่าแก้ไฟล์", () => {
    const q = computeQuote(S, [{ product: "pp", qty: 300, fixService: true }]);
    expect(q.lines[0].unitPrice).toBe(23);
    expect(q.fixFeeTotal).toBe(50);
    expect(q.total).toBe(300 * 23 + 50);
    expect(q.nudge).toBeNull();
  });
});

describe("โปรสะสม", () => {
  it("แถม 5 ทุกครั้งที่ข้ามหลัก 100", () => {
    expect(freeSheetsFor(S.promo, 0, 300)).toBe(15);
    expect(freeSheetsFor(S.promo, 90, 20)).toBe(5);
    expect(freeSheetsFor(S.promo, 100, 99)).toBe(0);
    expect(freeSheetsFor(S.promo, 199, 1)).toBe(5);
    expect(freeSheetsFor({ ...S.promo, enabled: false }, 0, 300)).toBe(0);
  });
  it("สะสมอีกกี่แผ่น", () => {
    const q = computeQuote(S, [{ product: "paper", qty: 30 }], 50);
    expect(q.freeSheets).toBe(0);
    expect(q.toNextFree).toBe(20);
  });
});

describe("validateItems", () => {
  it("ตรวจขั้นต่ำ ไฟล์แดง และแผ่นแถม", () => {
    expect(validateItems(S, [{ product: "paper", qty: 4 }], 0).ok).toBe(false);
    expect(validateItems(S, [{ product: "paper", qty: 5, checkLevel: "red" }], 0).ok).toBe(false);
    expect(validateItems(S, [{ product: "paper", qty: 5, checkLevel: "red", acceptRisk: true }], 0).ok).toBe(true);
    expect(validateItems(S, [{ product: "paper", qty: 100, freeQty: 3 }], 5).ok).toBe(false);
    expect(validateItems(S, [{ product: "paper", qty: 100, freeQty: 5 }], 5).ok).toBe(true);
  });
});
