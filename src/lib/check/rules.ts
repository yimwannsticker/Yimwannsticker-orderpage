import type { CheckIssue, CheckLevel, CheckResult, Settings } from "../types";

export type CheckSettings = Pick<Settings, "dpiGood" | "dpiMin" | "sheetWidthMm" | "sheetHeightMm" | "sheetName">;

const MM_PER_INCH = 25.4;

/** DPI จริงเมื่อขยายภาพให้เต็มแผ่น (วางให้พอดีแผ่น หมุนแนวให้ตรงกับภาพ) */
export function effectiveDpi(widthPx: number, heightPx: number, s: CheckSettings) {
  const longPx = Math.max(widthPx, heightPx);
  const shortPx = Math.min(widthPx, heightPx);
  const longIn = Math.max(s.sheetWidthMm, s.sheetHeightMm) / MM_PER_INCH;
  const shortIn = Math.min(s.sheetWidthMm, s.sheetHeightMm) / MM_PER_INCH;
  // ภาพจะถูกย่อ/ขยายให้พอดีแผ่น ด้านที่ชนขอบก่อนเป็นตัวกำหนดขนาด
  return Math.round(Math.max(longPx / longIn, shortPx / shortIn));
}

export function dpiLevel(dpi: number, s: CheckSettings): CheckLevel {
  if (dpi >= s.dpiGood) return "green";
  if (dpi >= s.dpiMin) return "yellow";
  return "red";
}

/** ขนาดพิกเซลที่ควรมีให้ได้ dpiGood บนแผ่นเต็ม */
export function recommendedPx(s: CheckSettings) {
  return {
    w: Math.round((s.sheetWidthMm / MM_PER_INCH) * s.dpiGood),
    h: Math.round((s.sheetHeightMm / MM_PER_INCH) * s.dpiGood),
  };
}

export function dpiIssue(dpi: number, s: CheckSettings): CheckIssue | null {
  const lvl = dpiLevel(dpi, s);
  const rec = recommendedPx(s);
  if (lvl === "yellow")
    return {
      level: "yellow",
      message: `ความละเอียดประมาณ ${dpi} DPI เมื่อพิมพ์เต็มแผ่น ${s.sheetName} พิมพ์ได้ แต่อาจไม่คมมากถ้ามองใกล้ๆ (แนะนำ ${rec.w}×${rec.h} พิกเซลขึ้นไป)`,
    };
  if (lvl === "red")
    return {
      level: "red",
      message: `ความละเอียดต่ำ (ประมาณ ${dpi} DPI เมื่อพิมพ์เต็มแผ่น ${s.sheetName}) งานจะแตกหรือเบลอ กรุณาใช้ไฟล์ต้นฉบับขนาดใหญ่กว่านี้ (แนะนำ ${rec.w}×${rec.h} พิกเซลขึ้นไป)`,
    };
  return null;
}

export const RGB_NOTE: CheckIssue = {
  level: "yellow",
  message: "ไฟล์เป็นโหมดสี RGB สีที่พิมพ์ออกมาอาจเพี้ยนจากหน้าจอเล็กน้อย (โดยเฉพาะสีสดๆ) ไม่ต้องแก้ก็พิมพ์ได้",
};

const TITLES: Record<CheckLevel, string> = {
  green: "พร้อมพิมพ์",
  yellow: "พิมพ์ได้แต่มีข้อควรระวัง",
  red: "ต้องแก้ไฟล์",
};

export function finalize(
  issues: CheckIssue[],
  info: CheckResult["info"],
  checkedBy: CheckResult["checkedBy"],
  forceLevel?: CheckLevel,
  title?: string,
): CheckResult {
  const rank = { green: 0, yellow: 1, red: 2 } as const;
  let level: CheckLevel = forceLevel ?? "green";
  for (const i of issues) if (rank[i.level] > rank[level]) level = i.level;
  // ปัญหาแดงขึ้นก่อน
  const sorted = [...issues].sort((a, b) => rank[b.level] - rank[a.level]);
  return { level, title: title ?? TITLES[level], issues: sorted, info, checkedBy };
}

export function rasterCheck(
  widthPx: number,
  heightPx: number,
  colorMode: string,
  s: CheckSettings,
  checkedBy: CheckResult["checkedBy"],
  kind: string,
): CheckResult {
  const dpi = effectiveDpi(widthPx, heightPx, s);
  const issues: CheckIssue[] = [];
  const d = dpiIssue(dpi, s);
  if (d) issues.push(d);
  if (colorMode === "RGB") issues.push(RGB_NOTE);
  if (!["RGB", "CMYK", "Grayscale"].includes(colorMode))
    issues.push({ level: "yellow", message: `โหมดสีของไฟล์เป็น ${colorMode} ร้านจะแปลงสีให้ก่อนพิมพ์` });
  return finalize(issues, { kind, widthPx, heightPx, dpi, colorMode }, checkedBy);
}
