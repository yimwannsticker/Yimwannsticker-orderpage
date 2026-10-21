import { dpiAtSize, dpiLevel, finalize, type CheckSettings } from "./check/rules";
import { piecesPerSheet } from "./sheet-layout";
import type { CheckIssue, CheckResult, Settings, Shape } from "./types";

export interface StickerSize {
  shape: Shape;
  widthMm: number;
  heightMm: number;
}

type LayoutSettings = Pick<Settings, "sheetWidthMm" | "sheetHeightMm" | "sheetMarginMm" | "stickerGapMm" | "cornerMarkMm">;

/**
 * จำนวนดวงต่อแผ่น (วิธีเดียวกับ Sheet Yield Calculator ของร้าน ดู sheet-layout.ts)
 * ไดคัทตามทรงคิดจากกรอบสี่เหลี่ยมของงาน
 */
export function perSheet(wMm: number, hMm: number, s: LayoutSettings, shape: Shape | null = "rect") {
  return piecesPerSheet(wMm, hMm, shape === "circle", {
    sheetW: s.sheetWidthMm,
    sheetH: s.sheetHeightMm,
    margin: s.sheetMarginMm,
    gap: s.stickerGapMm,
    cornerR: s.cornerMarkMm,
  });
}

export function cm(mm: number) {
  return Math.round(mm) % 10 === 0 ? String(Math.round(mm) / 10) : (Math.round(mm) / 10).toFixed(1);
}

export function sizeText(size: { shape: Shape | null; widthMm: number | null; heightMm: number | null }) {
  if (!size.widthMm || !size.heightMm) return "-";
  if (size.shape === "circle") return `Ø ${cm(size.widthMm)} ซม.`;
  return `${cm(size.widthMm)} × ${cm(size.heightMm)} ซม.`;
}

/** สัดส่วน กว้าง/ยาว ของไฟล์ (จากพิกเซล หรือขนาดหน้า PDF) */
export function fileAspect(check: CheckResult | null) {
  const i = check?.info;
  if (i?.widthPx && i.heightPx) return i.widthPx / i.heightPx;
  if (i?.pageWidthMm && i.pageHeightMm) return i.pageWidthMm / i.pageHeightMm;
  return null;
}

/** ข้อความ "ขนาดใหญ่สุดที่คมชัด" สำหรับไฟล์ภาพ */
export function maxSharpText(check: CheckResult | null, s: Pick<Settings, "dpiGood">) {
  const i = check?.info;
  if (!i?.widthPx || !i.heightPx) return null;
  const w = (i.widthPx / s.dpiGood) * 25.4;
  const h = (i.heightPx / s.dpiGood) * 25.4;
  return `ไฟล์ ${i.widthPx}×${i.heightPx} พิกเซล พิมพ์คมชัด (${s.dpiGood} DPI) ได้ถึงประมาณ ${cm(w)} × ${cm(h)} ซม.`;
}

function dpiMessage(dpi: number, level: "yellow" | "red", what: string, size: string) {
  return level === "red"
    ? `${what}ความละเอียดต่ำ (ประมาณ ${dpi} DPI ที่ขนาด ${size}) งานจะแตกหรือเบลอ กรุณาใช้ไฟล์ต้นฉบับที่ใหญ่กว่านี้ หรือเลือกขนาดดวงเล็กลง`
    : `${what}ความละเอียดประมาณ ${dpi} DPI ที่ขนาด ${size} พิมพ์ได้ แต่อาจไม่คมมากถ้ามองใกล้ๆ`;
}

/**
 * คำนวณผลตรวจไฟล์ใหม่ตามขนาดดวงและทรงไดคัท
 * (ความคมชัดขึ้นกับขนาดที่พิมพ์จริง ไม่ใช่ขนาดแผ่น)
 */
export function applySize(check: CheckResult | null, size: StickerSize | null, s: CheckSettings): CheckResult | null {
  if (!check) return null;
  const keep = check.issues.filter((i) => !i.code);
  const info = { ...check.info, dpi: undefined as number | undefined };
  const manual = check.title === "รอกราฟิกตรวจ" || info.needsManualReview;
  if (!size || !(size.widthMm > 0 && size.heightMm > 0)) {
    return finalize(keep, info, check.checkedBy, undefined, manual ? "รอกราฟิกตรวจ" : undefined);
  }
  const issues: CheckIssue[] = [...keep];
  const label = sizeText(size);

  if (info.widthPx && info.heightPx) {
    const dpi = dpiAtSize(info.widthPx, info.heightPx, size.widthMm, size.heightMm);
    info.dpi = dpi;
    const lvl = dpiLevel(dpi, s);
    if (lvl !== "green") {
      const needW = Math.ceil((size.widthMm / 25.4) * s.dpiGood);
      const needH = Math.ceil((size.heightMm / 25.4) * s.dpiGood);
      issues.push({
        level: lvl,
        code: "dpi",
        message: `${dpiMessage(dpi, lvl, "ไฟล์", label)} (ขนาดนี้ควรมีอย่างน้อย ${needW}×${needH} พิกเซล)`,
      });
    }
  } else if (info.minImageDpi && info.pageWidthMm && info.pageHeightMm) {
    // PDF/AI: รูปภายในถูกย่อ/ขยายตามสัดส่วนหน้า → ขนาดดวง
    const k = Math.min(size.widthMm / info.pageWidthMm, size.heightMm / info.pageHeightMm);
    const dpi = Math.round(info.minImageDpi / k);
    info.dpi = dpi;
    const lvl = dpiLevel(dpi, s);
    if (lvl !== "green") issues.push({ level: lvl, code: "dpi", message: dpiMessage(dpi, lvl, "รูปภายในไฟล์", label) });
  }

  const aspect = fileAspect(check);
  if (aspect) {
    const want = size.widthMm / size.heightMm;
    const off = Math.abs(Math.log(aspect / want));
    if (size.shape === "circle" && Math.abs(Math.log(aspect)) > 0.05) {
      issues.push({ level: "yellow", code: "shape", message: "ไฟล์ไม่เป็นสี่เหลี่ยมจัตุรัส เมื่อตัดเป็นวงกลม ขอบบางส่วนของงานจะถูกตัดออก" });
    } else if (size.shape !== "circle" && off > 0.1) {
      issues.push({
        level: "yellow",
        code: "size",
        message: "สัดส่วนกว้าง×ยาวที่เลือกไม่ตรงกับไฟล์ งานจะถูกย่อให้พอดีและมีขอบว่าง ถ้าไม่ต้องการ ให้กดปรับขนาดตามสัดส่วนไฟล์",
      });
    }
  }

  if (size.shape === "freeform") {
    const k = info.kind;
    if (k === "jpg" || k === "jpeg" || (k === "png" && info.hasAlpha === false)) {
      issues.push({
        level: "yellow",
        code: "shape",
        message: "ไดคัทตามทรงควรใช้ไฟล์ PNG พื้นหลังโปร่งใส ไฟล์นี้มีพื้นหลังทึบ กราฟิกจะทำเส้นตัดตามรูปให้ (ถ้าแยกรูปจากพื้นหลังไม่ได้ จะติดต่อกลับ)",
      });
    }
  }
  return finalize(issues, info, check.checkedBy, undefined, manual && !issues.some((i) => i.level === "red") ? "รอกราฟิกตรวจ" : undefined);
}

export interface SizeValidation {
  ok: boolean;
  message?: string;
}

export function validateSize(
  size: { shape: Shape | null; widthMm: number | null; heightMm: number | null },
  s: LayoutSettings & Pick<Settings, "minStickerMm">,
): SizeValidation {
  if (!size.shape) return { ok: false, message: "กรุณาเลือกรูปทรงไดคัท" };
  if (!size.widthMm || !size.heightMm) return { ok: false, message: "กรุณาใส่ขนาดดวง" };
  if (Math.min(size.widthMm, size.heightMm) < s.minStickerMm)
    return { ok: false, message: `ขนาดดวงเล็กสุด ${cm(s.minStickerMm)} ซม.` };
  if (perSheet(size.widthMm, size.heightMm, s, size.shape) < 1) return { ok: false, message: "ขนาดดวงใหญ่เกินแผ่น" };
  return { ok: true };
}

/** ผลตรวจของรายการ ตามขนาดดวงที่เลือกตอนนี้ */
export function itemCheck(
  item: { check: CheckResult | null; shape: Shape | null; widthMm: number | null; heightMm: number | null },
  s: CheckSettings,
) {
  const size =
    item.shape && item.widthMm && item.heightMm ? { shape: item.shape, widthMm: item.widthMm, heightMm: item.heightMm } : null;
  return applySize(item.check, size, s);
}
