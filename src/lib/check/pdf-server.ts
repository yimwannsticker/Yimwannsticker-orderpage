import "server-only";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  decodePDFRawStream,
  type PDFObject,
} from "pdf-lib";
import type { CheckIssue, CheckResult } from "../types";
import { dpiIssue, finalize, type CheckSettings } from "./rules";

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const PT_TO_MM = 25.4 / 72;
const MAX_PAGES = 20;
const MAX_OPS = 3_000_000;

function mul(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ];
}

interface PlacedImage {
  name: string;
  widthPx: number;
  heightPx: number;
  dpi: number;
  placedWmm: number;
  placedHmm: number;
}

interface FontUse {
  name: string;
  embedded: boolean;
}

interface WalkResult {
  images: PlacedImage[];
  fonts: Map<string, FontUse>;
  text: string[];
}

function decodeStream(obj: PDFObject | undefined): Uint8Array | null {
  if (!(obj instanceof PDFRawStream)) return null;
  try {
    return decodePDFRawStream(obj).decode();
  } catch {
    return null;
  }
}

function num(obj: PDFObject | undefined) {
  return obj instanceof PDFNumber ? obj.asNumber() : undefined;
}

function cleanFontName(n: string) {
  return n.replace(/^\/?[A-Z]{6}\+/, "").replace(/^\//, "");
}

function fontInfo(font: PDFDict): FontUse {
  const base = font.lookup(PDFName.of("BaseFont"));
  const subtype = font.lookup(PDFName.of("Subtype"));
  let name = base instanceof PDFName ? cleanFontName(base.decodeText()) : "ไม่ทราบชื่อ";
  if (subtype instanceof PDFName && subtype.decodeText() === "Type3") {
    return { name: name === "ไม่ทราบชื่อ" ? "Type3" : name, embedded: true };
  }
  let descFont: PDFDict = font;
  if (subtype instanceof PDFName && subtype.decodeText() === "Type0") {
    const desc = font.lookup(PDFName.of("DescendantFonts"));
    if (desc instanceof PDFArray) {
      const d0 = desc.lookup(0);
      if (d0 instanceof PDFDict) descFont = d0;
    }
  }
  const fd = descFont.lookup(PDFName.of("FontDescriptor"));
  let embedded = false;
  if (fd instanceof PDFDict) {
    embedded = ["FontFile", "FontFile2", "FontFile3"].some((k) => fd.get(PDFName.of(k)) !== undefined);
    const fdName = fd.lookup(PDFName.of("FontName"));
    if (name === "ไม่ทราบชื่อ" && fdName instanceof PDFName) name = cleanFontName(fdName.decodeText());
  }
  return { name, embedded };
}

const WS = new Set([0, 9, 10, 12, 13, 32]);
const DELIM = new Set([40, 41, 60, 62, 91, 93, 123, 125, 47, 37]);

/** เดิน content stream แบบย่อ: สนใจแค่ q Q cm Do Tf และข้อความ */
function walkContent(
  doc: PDFDocument,
  bytes: Uint8Array,
  resources: PDFDict | undefined,
  ctm: Matrix,
  out: WalkResult,
  budget: { ops: number; depth: number },
) {
  const stack: Matrix[] = [];
  let cur = ctm;
  const operands: (number | string | null)[] = [];
  const len = bytes.length;
  let i = 0;

  const lookupRes = (cat: string, name: string) => {
    const dict = resources?.lookup(PDFName.of(cat));
    if (!(dict instanceof PDFDict)) return undefined;
    const ref = dict.get(PDFName.of(name));
    return { obj: ref instanceof PDFRef ? doc.context.lookup(ref) : ref, key: ref instanceof PDFRef ? ref.toString() : `${cat}/${name}` };
  };

  while (i < len) {
    if (budget.ops-- <= 0) return;
    const c = bytes[i];
    if (WS.has(c)) {
      i++;
      continue;
    }
    if (c === 37) {
      // comment
      while (i < len && bytes[i] !== 10 && bytes[i] !== 13) i++;
      continue;
    }
    if (c === 40) {
      // (string)
      let depth = 1;
      let s = "";
      i++;
      while (i < len && depth > 0) {
        const b = bytes[i];
        if (b === 92) {
          i += 2;
          continue;
        }
        if (b === 40) depth++;
        else if (b === 41) depth--;
        if (depth > 0 && s.length < 200) s += String.fromCharCode(b);
        i++;
      }
      operands.push(s);
      continue;
    }
    if (c === 60) {
      if (bytes[i + 1] === 60) {
        i += 2;
        operands.push(null);
        continue;
      }
      while (i < len && bytes[i] !== 62) i++;
      i++;
      operands.push(null);
      continue;
    }
    if (c === 62 && bytes[i + 1] === 62) {
      i += 2;
      continue;
    }
    if (c === 91 || c === 93 || c === 123 || c === 125) {
      i++;
      continue;
    }
    if (c === 47) {
      // /Name
      let j = i + 1;
      while (j < len && !WS.has(bytes[j]) && !DELIM.has(bytes[j])) j++;
      operands.push("/" + Buffer.from(bytes.subarray(i + 1, j)).toString("latin1"));
      i = j;
      continue;
    }
    // ตัวเลข หรือ operator
    let j = i;
    while (j < len && !WS.has(bytes[j]) && !DELIM.has(bytes[j])) j++;
    if (j === i) {
      i++;
      continue;
    }
    const tok = Buffer.from(bytes.subarray(i, j)).toString("latin1");
    i = j;
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(tok)) {
      operands.push(parseFloat(tok));
      continue;
    }
    if (tok === "true" || tok === "false" || tok === "null") {
      operands.push(null);
      continue;
    }

    switch (tok) {
      case "q":
        stack.push(cur);
        break;
      case "Q":
        cur = stack.pop() ?? ctm;
        break;
      case "cm": {
        const m = operands.slice(-6);
        if (m.length === 6 && m.every((x) => typeof x === "number")) cur = mul(m as Matrix, cur);
        break;
      }
      case "Tf": {
        const name = operands[operands.length - 2];
        if (typeof name === "string" && name.startsWith("/")) {
          const r = lookupRes("Font", name.slice(1));
          if (r?.obj instanceof PDFDict && !out.fonts.has(r.key)) out.fonts.set(r.key, fontInfo(r.obj));
        }
        break;
      }
      case "Tj":
      case "'":
      case '"': {
        const s = operands[operands.length - 1];
        if (typeof s === "string" && out.text.length < 50) out.text.push(s);
        break;
      }
      case "TJ": {
        if (out.text.length < 50) out.text.push(operands.filter((x) => typeof x === "string").join(""));
        break;
      }
      case "BI": {
        // ข้ามข้อมูล inline image จนถึง EI
        const idPos = indexOfSeq(bytes, [73, 68], i);
        if (idPos < 0) return;
        let k = idPos + 3;
        while (k < len) {
          const e = indexOfSeq(bytes, [69, 73], k);
          if (e < 0) return;
          if (WS.has(bytes[e - 1]) && (e + 2 >= len || WS.has(bytes[e + 2]))) {
            k = e + 2;
            break;
          }
          k = e + 2;
        }
        i = k;
        break;
      }
      case "Do": {
        const name = operands[operands.length - 1];
        if (typeof name !== "string" || !name.startsWith("/")) break;
        const r = lookupRes("XObject", name.slice(1));
        const xo = r?.obj;
        if (!(xo instanceof PDFRawStream)) break;
        const sub = xo.dict.lookup(PDFName.of("Subtype"));
        const subName = sub instanceof PDFName ? sub.decodeText() : "";
        if (subName === "Image") {
          const isMask = xo.dict.lookup(PDFName.of("ImageMask"));
          if (isMask && isMask.toString() === "true") break;
          const w = num(xo.dict.lookup(PDFName.of("Width"))) ?? 0;
          const h = num(xo.dict.lookup(PDFName.of("Height"))) ?? 0;
          const placedW = Math.hypot(cur[0], cur[1]);
          const placedH = Math.hypot(cur[2], cur[3]);
          if (w > 0 && h > 0 && placedW > 0 && placedH > 0) {
            const dpi = Math.round(Math.min(w / (placedW / 72), h / (placedH / 72)));
            out.images.push({
              name: name.slice(1),
              widthPx: w,
              heightPx: h,
              dpi,
              placedWmm: placedW * PT_TO_MM,
              placedHmm: placedH * PT_TO_MM,
            });
          }
        } else if (subName === "Form" && budget.depth < 12) {
          const content = decodeStream(xo);
          if (!content) break;
          const mArr = xo.dict.lookup(PDFName.of("Matrix"));
          let fm: Matrix = IDENTITY;
          if (mArr instanceof PDFArray && mArr.size() === 6) {
            const vals = mArr.asArray().map((v) => (v instanceof PDFNumber ? v.asNumber() : NaN));
            if (vals.every((v) => !Number.isNaN(v))) fm = vals as Matrix;
          }
          const fRes = xo.dict.lookup(PDFName.of("Resources"));
          budget.depth++;
          walkContent(doc, content, fRes instanceof PDFDict ? fRes : resources, mul(fm, cur), out, budget);
          budget.depth--;
        }
        break;
      }
    }
    operands.length = 0;
  }
}

function indexOfSeq(bytes: Uint8Array, seq: number[], from: number) {
  outer: for (let i = from; i <= bytes.length - seq.length; i++) {
    for (let k = 0; k < seq.length; k++) if (bytes[i + k] !== seq[k]) continue outer;
    return i;
  }
  return -1;
}

function boxMm(arr: PDFArray | undefined) {
  if (!arr || arr.size() < 4) return null;
  const v = arr.asArray().map((x) => (x instanceof PDFNumber ? x.asNumber() : 0));
  return { w: Math.abs(v[2] - v[0]) * PT_TO_MM, h: Math.abs(v[3] - v[1]) * PT_TO_MM };
}

/** หาไฟล์รูปที่ถูก link ไว้จาก XMP manifest ของ Illustrator */
export function findLinkedFiles(buf: Buffer): string[] {
  const found = new Set<string>();
  let pos = 0;
  for (let guard = 0; guard < 50; guard++) {
    const start = buf.indexOf("<xmpMM:Manifest", pos, "latin1");
    if (start < 0) break;
    const end = buf.indexOf("</xmpMM:Manifest>", start, "latin1");
    if (end < 0) break;
    const xml = buf.subarray(start, end).toString("utf8");
    for (const li of xml.split(/<rdf:li\b/).slice(1)) {
      if (!/ReferenceStream/.test(li)) continue;
      const m = /stRef:filePath(?:>|=")([^<"]+)/.exec(li);
      if (m) {
        const p = m[1].replace(/^file:\/\//, "");
        found.add(decodeURIComponent(p.split(/[\\/]/).pop() || p));
      }
    }
    pos = end + 1;
  }
  return [...found];
}

const NO_PDF_CONTENT = "without PDF Content";

export const AI_RESAVE_HOWTO =
  "วิธีบันทึกใหม่: เปิดไฟล์ใน Illustrator > File > Save As > เลือก Adobe Illustrator (ai) > ติ๊ก \"Create PDF Compatible File\" และ \"Include Linked Files\" แล้วกด OK";

export async function checkPdfLike(buf: Buffer, kind: "pdf" | "ai", s: CheckSettings): Promise<CheckResult> {
  const head = buf.subarray(0, 1024).toString("latin1");
  const issues: CheckIssue[] = [];
  const info: CheckResult["info"] = { kind };

  if (kind === "ai") {
    const links = findLinkedFiles(buf);
    if (links.length) {
      info.missingLinks = links;
      issues.push({
        level: "red",
        message: `มีรูปที่ถูก link ไว้แต่ไม่ได้ฝังในไฟล์: ${links.join(", ")} — กรุณา Embed รูป (หน้าต่าง Links > Embed Image) หรือส่งไฟล์รูปมาด้วย`,
      });
    }
  }

  const manual = (msg: string): CheckResult =>
    finalize(
      [...issues, { level: "yellow", message: msg }],
      { ...info, needsManualReview: true },
      "server",
      undefined,
      issues.some((x) => x.level === "red") ? undefined : "รอกราฟิกตรวจ",
    );

  if (!head.includes("%PDF")) {
    if (kind === "ai")
      return manual(`ไฟล์ AI นี้ไม่ได้บันทึกแบบ "Create PDF Compatible File" ระบบจึงตรวจอัตโนมัติไม่ได้ กราฟิกจะตรวจให้ภายหลัง ${AI_RESAVE_HOWTO}`);
    return finalize([{ level: "red", message: "เปิดไฟล์ PDF ไม่ได้ ไฟล์อาจเสียหาย กรุณา export ใหม่" }], info, "server");
  }

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
  } catch {
    if (kind === "ai") return manual(`อ่านไฟล์ AI ไม่ได้ กราฟิกจะตรวจให้ภายหลัง ${AI_RESAVE_HOWTO}`);
    return finalize([{ level: "red", message: "เปิดไฟล์ PDF ไม่ได้ ไฟล์อาจเสียหายหรือมีรหัสผ่าน กรุณา export ใหม่" }], info, "server");
  }
  if (doc.isEncrypted) return manual("ไฟล์มีการล็อกรหัสผ่าน ระบบตรวจอัตโนมัติไม่ได้ กราฟิกจะตรวจให้ภายหลัง");

  const pages = doc.getPages();
  info.pages = pages.length;
  const result: WalkResult = { images: [], fonts: new Map(), text: [] };
  const budget = { ops: MAX_OPS, depth: 0 };

  pages.slice(0, MAX_PAGES).forEach((page, idx) => {
    const node = page.node;
    if (idx === 0) {
      const box = boxMm(node.TrimBox() ?? node.CropBox() ?? node.MediaBox());
      if (box) {
        info.pageWidthMm = Math.round(box.w);
        info.pageHeightMm = Math.round(box.h);
      }
    }
    const contents = node.Contents();
    const parts: Uint8Array[] = [];
    if (contents instanceof PDFArray) {
      for (let k = 0; k < contents.size(); k++) {
        const d = decodeStream(contents.lookup(k));
        if (d) parts.push(d);
      }
    } else {
      const d = decodeStream(contents);
      if (d) parts.push(d);
    }
    const joined = Buffer.concat(parts.flatMap((p) => [Buffer.from(p), Buffer.from("\n")]));
    walkContent(doc, joined, node.Resources(), IDENTITY, result, budget);
  });

  const allText = result.text.join(" ");
  if (kind === "ai" && (allText.includes(NO_PDF_CONTENT) || buf.indexOf(NO_PDF_CONTENT, 0, "latin1") >= 0)) {
    return manual(`ไฟล์ AI นี้ไม่ได้บันทึกแบบ "Create PDF Compatible File" ระบบจึงตรวจอัตโนมัติไม่ได้ กราฟิกจะตรวจให้ภายหลัง ${AI_RESAVE_HOWTO}`);
  }

  // ฟอนต์
  const fonts = [...result.fonts.values()];
  info.fonts = [...new Set(fonts.map((f) => f.name))];
  if (kind === "ai" && fonts.length) {
    issues.push({
      level: "red",
      message: `ยังมีตัวอักษรที่ไม่ได้ Create Outline (ฟอนต์: ${info.fonts.join(", ")}) — เลือกตัวอักษรทั้งหมดแล้วกด Type > Create Outlines (Ctrl/Cmd+Shift+O) แล้วบันทึกใหม่`,
    });
  } else if (kind === "pdf") {
    const notEmbedded = [...new Set(fonts.filter((f) => !f.embedded).map((f) => f.name))];
    if (notEmbedded.length) {
      issues.push({
        level: "red",
        message: `ฟอนต์ไม่ได้ฝังในไฟล์: ${notEmbedded.join(", ")} — ตัวอักษรอาจเพี้ยนตอนพิมพ์ กรุณา export PDF ใหม่โดยเลือกฝังฟอนต์ (Embed fonts) หรือแปลงตัวอักษรเป็น Outline`,
      });
    }
  }

  // รูปภายใน ใช้ค่าต่ำสุด ข้ามรูปเล็กมาก (เช่นไอคอน < 5 มม.)
  const meaningful = result.images.filter((im) => im.placedWmm >= 5 && im.placedHmm >= 5);
  if (meaningful.length) {
    const worst = meaningful.reduce((a, b) => (b.dpi < a.dpi ? b : a));
    info.minImageDpi = worst.dpi;
    const d = dpiIssue(worst.dpi, s);
    if (d) {
      const count = meaningful.filter((im) => im.dpi < s.dpiGood).length;
      d.message = `รูปภายในไฟล์ ${count} รูป ${d.level === "red" ? "ความละเอียดต่ำ" : "ความละเอียดค่อนข้างต่ำ"} (ต่ำสุดประมาณ ${worst.dpi} DPI ที่ขนาดจริง ${Math.round(worst.placedWmm)}×${Math.round(worst.placedHmm)} มม.)${d.level === "red" ? " งานส่วนนั้นจะแตกหรือเบลอ กรุณาใช้รูปต้นฉบับที่ใหญ่กว่านี้" : " พิมพ์ได้แต่อาจไม่คมมาก"}`;
      issues.push(d);
    }
  }

  // ขนาดหน้า
  if (info.pageWidthMm && info.pageHeightMm) {
    const W = Math.min(s.sheetWidthMm, s.sheetHeightMm);
    const H = Math.max(s.sheetWidthMm, s.sheetHeightMm);
    const pw = Math.min(info.pageWidthMm, info.pageHeightMm);
    const ph = Math.max(info.pageWidthMm, info.pageHeightMm);
    if (pw > W + 2 || ph > H + 2) {
      issues.push({
        level: "yellow",
        message: `ขนาดงาน ${info.pageWidthMm}×${info.pageHeightMm} มม. ใหญ่กว่าแผ่น ${s.sheetName} (${W}×${H} มม.) ร้านจะย่อให้พอดีแผ่น ถ้าต้องการขนาดจริงกรุณาปรับไฟล์`,
      });
    }
  }
  if (pages.length > 1) {
    issues.push({
      level: "yellow",
      message: `ไฟล์มี ${pages.length} หน้า (1 รายการ = 1 แบบ) ถ้าแต่ละหน้าเป็นคนละแบบ กรุณาแยกเป็นไฟล์ละ 1 หน้า`,
    });
  }

  return finalize(issues, info, "server");
}
