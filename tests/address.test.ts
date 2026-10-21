import { describe, expect, it } from "vitest";
import zips from "@/data/th-zip.json";
import { guessZip, parseAddress, type ZipEntry } from "@/lib/address-parse";

const db = zips as unknown as Record<string, ZipEntry[]>;
const parse = (t: string) => {
  const zip = guessZip(t);
  return parseAddress(t, zip ? db[zip] : null);
};

describe("parseAddress", () => {
  it("หลายบรรทัด", () => {
    const r = parse("สมหญิง ใจดี\n99/1 หมู่ 3 ถ.ห้วยแก้ว ต.สุเทพ อ.เมืองเชียงใหม่ จ.เชียงใหม่ 50200\n081-234-5678");
    expect(r).toMatchObject({
      name: "สมหญิง ใจดี",
      phone: "0812345678",
      subdistrict: "สุเทพ",
      district: "เมืองเชียงใหม่",
      province: "เชียงใหม่",
      zipcode: "50200",
      line1: "99/1 หมู่ 3 ถ.ห้วยแก้ว",
    });
  });
  it("บรรทัดเดียว กรุงเทพ", () => {
    const r = parse("นายสมชาย ดีมาก 0891234567 123 ซ.สุขุมวิท 22 แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110");
    expect(r.phone).toBe("0891234567");
    expect(r.subdistrict).toBe("คลองเตย");
    expect(r.district).toBe("คลองเตย");
    expect(r.province).toBe("กรุงเทพมหานคร");
    expect(r.name).toBe("นายสมชาย ดีมาก");
    expect(r.line1).toBe("123 ซ.สุขุมวิท 22");
  });
});

import { isValidPhone, phoneProblem } from "@/lib/format";
describe("เบอร์โทร", () => {
  it("ต้องครบ 10 หลัก", () => {
    expect(isValidPhone("0812345678")).toBe(true);
    expect(isValidPhone("081234567")).toBe(false);
    expect(isValidPhone("08123456789")).toBe(false);
    expect(phoneProblem("081-234-567")).toBe("เบอร์โทรต้องมี 10 หลัก (ตอนนี้ 9 หลัก)");
    expect(phoneProblem("081-234-5678")).toBeNull();
    expect(phoneProblem("+66 81 234 5678")).toBeNull();
  });
});
