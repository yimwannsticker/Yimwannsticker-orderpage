import { describe, expect, it } from "vitest";
import { bangkokMonthDay, guessSeason, inSeason, monthDayLabel, suggestProducts, type ShopProduct } from "@/lib/shop-types";

describe("ช่วงเทศกาล", () => {
  it("ไม่ตั้งช่วง = ขายตลอด", () => expect(inSeason(null, null, "06-01")).toBe(true));
  it("ช่วงในปีเดียว", () => {
    expect(inSeason("03-15", "04-16", "04-13")).toBe(true);
    expect(inSeason("03-15", "04-16", "04-17")).toBe(false);
    expect(inSeason("03-15", "04-16", "03-15")).toBe(true);
  });
  it("ช่วงข้ามปี", () => {
    expect(inSeason("11-15", "01-05", "12-31")).toBe(true);
    expect(inSeason("11-15", "01-05", "01-05")).toBe(true);
    expect(inSeason("11-15", "01-05", "01-06")).toBe(false);
    expect(inSeason("11-15", "01-05", "11-14")).toBe(false);
  });
  it("ใช้วันที่ตามเวลาไทย", () => {
    // 31 ธ.ค. 18:00 UTC = 1 ม.ค. ตี 1 เวลาไทย
    expect(bangkokMonthDay(new Date("2026-12-31T18:00:00Z"))).toBe("01-01");
  });
  it("เดาเทศกาลจากชื่อสินค้า", () => {
    expect(guessSeason("สติกเกอร์สงกรานต์ V2")).toEqual({ start: "03-15", end: "04-16" });
    expect(guessSeason("สติกเกอร์ คริสมาสต์ สวัสดีปีใหม่")).toEqual({ start: "11-15", end: "01-05" });
    expect(guessSeason("สติกเกอร์ บราวนี่")).toBeNull();
    expect(monthDayLabel("01-05")).toBe("5 ม.ค.");
  });
});

describe("สินค้าแนะนำในตะกร้า", () => {
  const p = (id: string, sold: number, extra: Partial<ShopProduct> = {}) =>
    ({ id, sold, pricing: "a5", badgeBest: false, position: 0, designs: [{ active: true }], ...extra }) as unknown as ShopProduct;
  it("ขายดีก่อน ไม่เอาที่อยู่ในตะกร้า การ์ด หรือไม่มีลายเปิดขาย", () => {
    const list = [p("a", 5), p("b", 50), p("c", 20), p("card", 99, { pricing: "fixed" }), p("off", 80, { designs: [] })];
    expect(suggestProducts(list, new Set(["c"])).map((x) => x.id)).toEqual(["b", "a"]);
  });
});
