import { describe, expect, it } from "vitest";
import zlib from "node:zlib";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { DEFAULT_SETTINGS as S } from "@/lib/constants";
import { checkPdfLike } from "@/lib/check/pdf-server";
import { checkPsd } from "@/lib/check/psd-server";
import { dpiAtSize } from "@/lib/check/rules";
import { applySize, perSheet } from "@/lib/sticker-size";

function png(w: number, h: number) {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h, 200);
  for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const mm = (v: number) => (v / 25.4) * 72;

async function makePdf(opts: { text?: boolean; imagePx?: number; imageMm?: number; pageMm?: [number, number] }) {
  const doc = await PDFDocument.create();
  const [pw, ph] = opts.pageMm ?? [330, 483];
  const page = doc.addPage([mm(pw), mm(ph)]);
  page.drawRectangle({ x: 10, y: 10, width: 100, height: 100 });
  if (opts.text) {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText("Hello", { x: 50, y: 50, size: 24, font });
  }
  if (opts.imagePx) {
    const img = await doc.embedPng(png(opts.imagePx, opts.imagePx));
    page.drawImage(img, { x: 20, y: 20, width: mm(opts.imageMm!), height: mm(opts.imageMm!) });
  }
  return Buffer.from(await doc.save());
}

describe("ขนาดดวง", () => {
  it("DPI ตามขนาดดวงจริง", () => {
    // 600px ที่ 5 ซม. = 305 DPI, ที่ 2 ซม. = 762 DPI
    expect(dpiAtSize(600, 600, 50, 50)).toBe(305);
    expect(dpiAtSize(600, 600, 20, 20)).toBe(762);
  });
  it("ไฟล์เดียวกัน ดวงเล็กผ่าน ดวงใหญ่ไม่ผ่าน", () => {
    const base = { level: "green" as const, title: "พร้อมพิมพ์", issues: [], info: { kind: "png", widthPx: 600, heightPx: 600, hasAlpha: true }, checkedBy: "browser" as const };
    expect(applySize(base, { shape: "rect", widthMm: 50, heightMm: 50 }, S)!.level).toBe("green");
    expect(applySize(base, { shape: "rect", widthMm: 80, heightMm: 80 }, S)!.level).toBe("yellow");
    expect(applySize(base, { shape: "rect", widthMm: 150, heightMm: 150 }, S)!.level).toBe("red");
    // คำนวณซ้ำได้ ไม่ซ้อนปัญหาเดิม
    const red = applySize(base, { shape: "rect", widthMm: 150, heightMm: 150 }, S)!;
    expect(applySize(red, { shape: "rect", widthMm: 50, heightMm: 50 }, S)!.issues).toEqual([]);
  });
  it("วงกลมกับไฟล์ไม่จัตุรัส / ไดคัทตามทรงกับ JPG = เหลือง", () => {
    const jpg = { level: "green" as const, title: "", issues: [], info: { kind: "jpg", widthPx: 1200, heightPx: 600, hasAlpha: false }, checkedBy: "browser" as const };
    expect(applySize(jpg, { shape: "circle", widthMm: 40, heightMm: 40 }, S)!.issues[0].code).toBe("shape");
    expect(applySize(jpg, { shape: "freeform", widthMm: 80, heightMm: 40 }, S)!.issues.map((i) => i.code)).toEqual(["shape"]);
  });
  it("จำนวนดวงต่อแผ่น", () => {
    // พื้นที่ใช้ได้ 310×463 ระยะห่าง 3 มม.
    expect(perSheet(50, 50, S)).toBe(5 * 8);
    expect(perSheet(20, 20, S)).toBe(13 * 20);
    expect(perSheet(400, 400, S)).toBe(0);
  });
  it("PDF: รูปภายในคิดตามสัดส่วนขนาดดวง", () => {
    const pdf = { level: "green" as const, title: "", issues: [], info: { kind: "pdf", pageWidthMm: 100, pageHeightMm: 100, minImageDpi: 300 }, checkedBy: "server" as const };
    expect(applySize(pdf, { shape: "rect", widthMm: 50, heightMm: 50 }, S)!.info.dpi).toBe(600);
    expect(applySize(pdf, { shape: "rect", widthMm: 300, heightMm: 300 }, S)!.level).toBe("red");
  });
});

describe("checkPdfLike", () => {
  it("PDF เวกเตอร์ล้วน = เขียว", async () => {
    const r = await checkPdfLike(await makePdf({}), "pdf");
    expect(r.level).toBe("green");
    expect(r.info.pageWidthMm).toBe(330);
  });
  it("PDF ฟอนต์ไม่ embed = แดง", async () => {
    const r = await checkPdfLike(await makePdf({ text: true }), "pdf");
    expect(r.level).toBe("red");
    expect(r.issues[0].message).toContain("Helvetica");
  });
  it("AI ยังมีฟอนต์ = แดง บอกชื่อฟอนต์", async () => {
    const r = await checkPdfLike(await makePdf({ text: true }), "ai");
    expect(r.level).toBe("red");
    expect(r.info.fonts).toEqual(["Helvetica"]);
  });
  it("เก็บ DPI รูปภายในที่ขนาดหน้าจริงไว้คำนวณตามขนาดดวง", async () => {
    // 300px ที่ 100มม. = 76 dpi
    const r = await checkPdfLike(await makePdf({ imagePx: 300, imageMm: 100 }), "pdf");
    expect(r.info.minImageDpi).toBe(76);
    expect(r.level).toBe("green");
    expect(applySize(r, { shape: "rect", widthMm: 330, heightMm: 483 }, S)!.level).toBe("red");
  });
  it("AI มีรูป link = แดง บอกชื่อไฟล์", async () => {
    const base = await makePdf({});
    const xmp = `<x:xmpmeta><xmpMM:Manifest><rdf:Seq><rdf:li rdf:parseType="Resource"><stMfs:linkForm>ReferenceStream</stMfs:linkForm><xmpMM:reference rdf:parseType="Resource"><stRef:filePath>/Users/a/Desktop/logo%20final.png</stRef:filePath></xmpMM:reference></rdf:li><rdf:li rdf:parseType="Resource"><stMfs:linkForm>EmbedByReference</stMfs:linkForm><xmpMM:reference rdf:parseType="Resource"><stRef:filePath>/x/embedded.jpg</stRef:filePath></xmpMM:reference></rdf:li></rdf:Seq></xmpMM:Manifest></x:xmpmeta>`;
    const buf = Buffer.concat([base, Buffer.from(`\n%${xmp}\n`)]);
    const r = await checkPdfLike(buf, "ai");
    expect(r.level).toBe("red");
    expect(r.info.missingLinks).toEqual(["logo final.png"]);
  });
  it("AI ไม่ได้ save แบบ PDF compatible = เหลือง รอกราฟิกตรวจ", async () => {
    const r = await checkPdfLike(Buffer.from("%!PS-Adobe-3.0\n%%Creator: Adobe Illustrator"), "ai");
    expect(r.level).toBe("yellow");
    expect(r.title).toBe("รอกราฟิกตรวจ");
    expect(r.info.needsManualReview).toBe(true);
  });
});

describe("checkPsd", () => {
  it("อ่าน header ขนาด + RGB", () => {
    const h = Buffer.alloc(200);
    h.write("8BPS", 0, "latin1");
    h.writeUInt16BE(1, 4);
    h.writeUInt16BE(3, 12);
    h.writeUInt32BE(2000, 14);
    h.writeUInt32BE(1400, 18);
    h.writeUInt16BE(8, 22);
    h.writeUInt16BE(3, 24);
    const r = checkPsd(h);
    expect(r.info.widthPx).toBe(1400);
    expect(r.info.colorMode).toBe("RGB");
    expect(r.level).toBe("yellow");
  });
});
