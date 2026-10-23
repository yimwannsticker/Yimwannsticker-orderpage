import { describe, expect, it } from "vitest";
import { a5NudgeText, combineTotals, computeA5Quote } from "@/lib/a5-pricing";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { computeQuote } from "@/lib/pricing";
import { shortOrderText } from "@/lib/pack";
import { makeSku, nextSkuNumber } from "@/lib/shop-types";

const s = DEFAULT_SETTINGS; // 1–14 = 15, 15–49 = 12, 50–99 = 11, 100+ = 10 · ต่ำกว่า 15 แผ่นค่าส่ง 30

describe("ราคา A5", () => {
  it("หาขั้นจากแผ่นรวมทุกลาย คละได้", () => {
    const q = computeA5Quote(s, [{ qty: 10, surcharge: 0 }, { qty: 5, surcharge: 0 }]);
    expect(q.sheets).toBe(15);
    expect(q.tier.price).toBe(12);
    expect(q.subtotal).toBe(180);
    expect(q.shipping).toBe(0);
  });
  it("น้อยกว่า 15 แผ่น แผ่นละ 15 + ค่าส่ง 30", () => {
    const q = computeA5Quote(s, [{ qty: 14, surcharge: 0 }]);
    expect(q.subtotal).toBe(210);
    expect(q.shipping).toBe(30);
    expect(q.nudge).toEqual({ kind: "shipping", need: 1 });
    expect(a5NudgeText(q.nudge!)).toBe("สั่ง A5 เพิ่มอีก 1 แผ่น ส่งฟรี");
  });
  it("ขั้น 50 และ 100", () => {
    expect(computeA5Quote(s, [{ qty: 50, surcharge: 0 }]).tier.price).toBe(11);
    expect(computeA5Quote(s, [{ qty: 99, surcharge: 0 }]).tier.price).toBe(11);
    expect(computeA5Quote(s, [{ qty: 100, surcharge: 0 }]).subtotal).toBe(1000);
  });
  it("บวกส่วนต่างตามขนาด", () => {
    const q = computeA5Quote(s, [{ qty: 20, surcharge: 3 }]);
    expect(q.lines[0].unitPrice).toBe(15);
    expect(q.subtotal).toBe(300);
  });
  it("ข้อความกระตุ้นขั้นราคาถัดไป", () => {
    const q = computeA5Quote(s, [{ qty: 45, surcharge: 0 }]);
    expect(a5NudgeText(q.nudge!)).toBe("สั่ง A5 เพิ่มอีก 5 แผ่น ราคาแผ่นละ 11 บาท");
  });
});

describe("ออเดอร์รวม A5 + A3+", () => {
  const a3 = (qty: number) => computeQuote(s, [{ product: "paper", qty }]);
  it("ค่าส่งเก็บฝั่งที่แพงกว่า", () => {
    const t = combineTotals(a3(10), computeA5Quote(s, [{ qty: 5, surcharge: 0 }]));
    expect(t.shipping).toBe(50);
    expect(t.total).toBe(250 + 75 + 50);
  });
  it("A5 ส่งฟรี แต่ A3+ ยังไม่ถึงเกณฑ์ → ค่าส่ง A3+", () => {
    expect(combineTotals(a3(10), computeA5Quote(s, [{ qty: 20, surcharge: 0 }])).shipping).toBe(50);
  });
  it("ทั้งคู่ส่งฟรี", () => {
    expect(combineTotals(a3(20), computeA5Quote(s, [{ qty: 20, surcharge: 0 }])).shipping).toBe(0);
  });
  it("A3+ อย่างเดียว ยอดเท่าเดิม", () => {
    const q = a3(10);
    expect(combineTotals(q, computeA5Quote(s, [])).total).toBe(q.total);
  });
  it("A5 อย่างเดียว", () => {
    const t = combineTotals(computeQuote(s, []), computeA5Quote(s, [{ qty: 3, surcharge: 0 }]));
    expect(t).toEqual({ shipping: 30, total: 75 });
  });
});

describe("แพ็กของ", () => {
  it("รายการแบบสั้น", () => {
    expect(shortOrderText([{ sku: "33-02", qty: 2 }, { sku: "33-01", qty: 3 }], { files: 2, sheets: 40, free: 0 })).toBe(
      "A5: 33-01×3, 33-02×2 | A3+: 2 ไฟล์ 40 แผ่น",
    );
    expect(shortOrderText([], { files: 1, sheets: 10, free: 5 })).toBe("A3+: 1 ไฟล์ 10 แผ่น +แถม 5");
  });
  it("SKU อัตโนมัติ", () => {
    expect(makeSku("33", 1)).toBe("33-01");
    expect(nextSkuNumber("33", ["33-01", "33-07", "34-09"])).toBe(8);
    expect(nextSkuNumber("33", [])).toBe(1);
  });
});

describe("สินค้าราคาคงที่ (การ์ด)", () => {
  const card = (qty: number, units: number, price: number) => ({ qty, surcharge: 0, fixed: { price, units } });
  const noA3 = { subtotal: 0, fixFeeTotal: 0, shipping: 0, totalSheets: 0 };

  it("ไม่นับเป็นแผ่น A5 และใช้ราคาตามแพ็ค", () => {
    const q = computeA5Quote(s, [card(2, 50, 130), { qty: 14, surcharge: 0 }]);
    expect(q.sheets).toBe(14);
    expect(q.tier.price).toBe(15);
    expect(q.fixedUnits).toBe(100);
    expect(q.fixedSubtotal).toBe(260);
    expect(q.subtotal).toBe(260 + 210);
  });
  it("สั่งการ์ดอย่างเดียว ไม่ถึง 200 ใบ ค่าส่ง 30", () => {
    const q = computeA5Quote(s, [card(1, 100, 220)]);
    expect(q.fixedShipping).toBe(30);
    expect(a5NudgeText(q.fixedNudge!)).toBe("สั่งการ์ดเพิ่มอีก 100 ใบ ส่งฟรี");
    expect(combineTotals(noA3, q)).toEqual({ shipping: 30, total: 250 });
  });
  it("การ์ดครบ 200 ใบ ส่งฟรี", () => {
    const q = computeA5Quote(s, [card(2, 100, 220)]);
    expect(combineTotals(noA3, q).shipping).toBe(0);
  });
  it("การ์ดไม่ถึง 200 แต่ A5 ถึงยอดส่งฟรี ส่งฟรีทั้งกล่อง", () => {
    const q = computeA5Quote(s, [card(1, 25, 75), { qty: 15, surcharge: 0 }]);
    expect(combineTotals(noA3, q).shipping).toBe(0);
  });
  it("การ์ดไม่ถึง 200 และ A5 ไม่ถึงยอด เก็บ 30 ครั้งเดียว", () => {
    const q = computeA5Quote(s, [card(1, 25, 75), { qty: 3, surcharge: 0 }]);
    expect(combineTotals(noA3, q).shipping).toBe(30);
  });
  it("การ์ดครบ 200 แต่ A5 ไม่ถึงยอด ยังคิดค่าส่ง A5", () => {
    const q = computeA5Quote(s, [card(2, 100, 220), { qty: 3, surcharge: 0 }]);
    expect(combineTotals(noA3, q).shipping).toBe(30);
  });
  it("การ์ดสั่งรวมงาน A3+ ที่ส่งฟรีแล้ว ส่งฟรีทั้งกล่อง", () => {
    const q = computeA5Quote(s, [card(1, 25, 75)]);
    expect(combineTotals({ subtotal: 500, fixFeeTotal: 0, shipping: 0, totalSheets: 10 }, q).shipping).toBe(0);
  });
});
