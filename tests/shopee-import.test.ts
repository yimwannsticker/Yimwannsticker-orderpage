import writeXlsxFile from "write-excel-file/node";
import { describe, expect, it } from "vitest";
import { buildShopeePlans, piecesFromTitle, shopeeFileKind, shortName, sizeFromTitle, splitOption } from "@/lib/shopee-import";
import { readXlsxRows } from "@/lib/xlsx-read";

const ID = "et_title_product_id";
const MEDIA_HEAD = [ID, "et_title_product_name", "ps_item_cover_image", "ps_item_image.1", "et_title_variation_1"];
for (let i = 1; i <= 4; i++) MEDIA_HEAD.push(`et_title_option_${i}_for_variation_1`, `et_title_option_image_${i}_for_variation_1`);
const SALES_HEAD = [ID, "et_title_product_name", "et_title_variation_name", "et_title_variation_price", "et_title_variation_stock"];

/** แถวหัวตาราง + แถวคำอธิบายแบบไฟล์ Shopee แล้วตามด้วยข้อมูล */
const sheet = (head: string[], tag: string, rows: string[][]) => [head, [tag], ["รหัสสินค้า"], [], [], [], ...rows];
const img = (s: string) => `https://cf.shopee.co.th/file/${s}`;

const media = sheet(MEDIA_HEAD, "media_info", [
  ["111111", "สติกเกอร์อุ้งเท้าแมว ขอบคุณ กันน้ำ 100% 12ดวง/แผ่น", img("c1"), img("c2"), "แบบ", "27-แมวดำ", img("o1"), "27-แมวส้ม", img("o2"), "[ตำหนิ] 27-แมวดำ", img("o3")],
  ["222222", "(แพ็ค25,50,100) การ์ดขอบคุณ Thank you ขนาด 9 x 5.5 ซม.", img("c3"), "", "แบบ", "05-PR-01", img("o4")],
  ["333333", "[A3] สติกเกอร์ ของชำร่วย งานศพ", img("c4"), "", "", ""],
  ["444444", "สติกเกอร์ Thank you ลายแมว กันน้ำ 100% 18ดวง/แผ่น", img("c5"), "", "", ""],
]);
const sales = sheet(SALES_HEAD, "sales_info", [
  ["111111", "", "27-แมวดำ,4x6 ซม", "20", "100"],
  ["111111", "", "27-แมวดำ,8.3x14 ซม", "40", "100"],
  ["111111", "", "27-แมวส้ม,4x6 ซม", "20", "0"],
  ["111111", "", "27-แมวส้ม,8.3x14 ซม", "40", "0"],
  ["111111", "", "[ตำหนิ] 27-แมวดำ,4x6 ซม", "9", "5"],
  ["222222", "", "05-PR-01,แพ็ค 25 ใบ", "75", "10"],
  ["222222", "", "05-PR-01,แพ็ค 50 ใบ", "130", "10"],
  ["222222", "", "05-PR-01,แพ็ค 100 ใบ", "220", "10"],
  ["333333", "", "", "100", "10"],
  ["444444", "", "", "20", "3"],
]);

describe("นำเข้าจาก Shopee", () => {
  const { plans, excluded } = buildShopeePlans({ media, sales }, { a5BasePrice: 15 });
  const by = (id: string) => plans.find((p) => p.itemId === id)!;

  it("ไม่นำเข้างานศพ", () => {
    expect(excluded.map((x) => x.itemId)).toEqual(["333333"]);
    expect(plans.map((p) => p.itemId)).toEqual(["111111", "222222", "444444"]);
  });
  it("ตัดตัวเลือกตำหนิ ลายที่คลัง 0 ปิดไว้", () => {
    const p = by("111111");
    expect(p.designs.map((d) => [d.name, d.active, d.image])).toEqual([
      ["แมวดำ", true, img("o1")],
      ["แมวส้ม", false, img("o2")],
    ]);
    expect(p.skippedFlawed).toBe(1);
    expect(p.designCode).toBe("27");
  });
  it("อุ้งเท้าแมว: ราคาขั้นบันได + ส่วนต่าง 15 บาทสำหรับไซส์ใหญ่", () => {
    const p = by("111111");
    expect(p.pricing).toBe("a5");
    expect(p.optionLabel).toBe("ขนาด");
    expect(p.sizes.map((s) => [s.name, s.surcharge])).toEqual([
      ["4x6 ซม", 0],
      ["8.3x14 ซม", 15],
    ]);
    expect(p.piecesPerSheet).toBe(12);
    expect(p.material).toBe("กันน้ำ 100%");
    expect(p.images).toEqual([img("c1"), img("c2")]);
  });
  it("การ์ด: ราคาคงที่ตามแพ็ค ราคาเดียวกับ Shopee", () => {
    const p = by("222222");
    expect(p.pricing).toBe("fixed");
    expect(p.unitLabel).toBe("แพ็ค");
    expect(p.sizes.map((s) => [s.price, s.units])).toEqual([
      [75, 25],
      [130, 50],
      [220, 100],
    ]);
    expect(p.name).toBe("การ์ดขอบคุณ Thank you");
    expect(p.description).toBe("ขนาด 9x5.5 ซม.");
  });
  it("สินค้าไม่มีตัวเลือก = 1 ลาย ใช้รูปปก", () => {
    const p = by("444444");
    expect(p.designs).toHaveLength(1);
    expect(p.designs[0].image).toBe(img("c5"));
    expect(p.designCode).toBe("S4444");
    expect(p.sizes).toEqual([]);
    expect(p.piecesPerSheet).toBe(18);
  });
  it("ตัวช่วยแยกชื่อ", () => {
    expect(splitOption("83-ธรรมดา")).toEqual({ code: "83", name: "ธรรมดา" });
    expect(splitOption("วาเลนไทน์เซ็ต")).toEqual({ code: "", name: "วาเลนไทน์เซ็ต" });
    expect(piecesFromTitle("กันน้ำ 100% 84ดวง/แผ่น")).toBe(84);
    expect(piecesFromTitle("กันน้ำ 100% 21-36ดวง/แผ่น")).toBeNull();
    const range = buildShopeePlans(
      { media: sheet(MEDIA_HEAD, "media_info", [["555555", "สติกเกอร์ ทุเรียน กันน้ำ 100% 21-36ดวง/แผ่น", img("c6")]]), sales: sheet(SALES_HEAD, "sales_info", [["555555", "", "", "20", "1"]]) },
      { a5BasePrice: 15 },
    ).plans[0];
    expect(range.piecesPerSheet).toBeNull();
    expect(range.description).toBe("จำนวน 21–36 ดวง/แผ่น (ต่างกันตามลาย)");
    expect(sizeFromTitle("(2x2ซม.) สติกเกอร์ ไส้ขนม")).toBe("2x2 ซม.");
    expect(shortName("สติกเกอร์ บราวนี่ Brownie กันน้ำ 100% 36ดวง/แผ่น น่ารัก")).toBe("สติกเกอร์ บราวนี่ Brownie");
  });
  it("อ่านไฟล์ .xlsx และแยกประเภทไฟล์", async () => {
    const buf = await writeXlsxFile(sales.map((r) => r.map((v) => ({ value: v })))).toBuffer();
    const rows = await readXlsxRows(new Uint8Array(buf));
    expect(shopeeFileKind(rows)).toBe("sales");
    expect(rows[6].slice(0, 5)).toEqual(sales[6]);
    expect(buildShopeePlans({ media, sales: rows }, { a5BasePrice: 15 }).plans).toHaveLength(3);
  });
});
