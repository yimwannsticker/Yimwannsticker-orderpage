import type { CheckIssue, CheckLevel, CheckResult, Settings } from "../types";

export type CheckSettings = Pick<Settings, "dpiGood" | "dpiMin" | "sheetWidthMm" | "sheetHeightMm" | "sheetName">;

const MM_PER_INCH = 25.4;

/** DPI เมื่อพิมพ์ภาพขนาด px ลงพื้นที่ w×h มม. (ย่อ/ขยายให้พอดีกรอบ ด้านที่ชนขอบก่อนเป็นตัวกำหนด) */
export function dpiAtSize(widthPx: number, heightPx: number, wMm: number, hMm: number) {
  return Math.round(Math.max(widthPx / (wMm / MM_PER_INCH), heightPx / (hMm / MM_PER_INCH)));
}

/** ขนาดใหญ่สุด (มม.) ที่ยังคมชัดตามเกณฑ์ dpiGood */
export function maxSharpMm(widthPx: number, heightPx: number, s: Pick<Settings, "dpiGood">) {
  return { w: (widthPx / s.dpiGood) * MM_PER_INCH, h: (heightPx / s.dpiGood) * MM_PER_INCH };
}

export function dpiLevel(dpi: number, s: CheckSettings): CheckLevel {
  if (dpi >= s.dpiGood) return "green";
  if (dpi >= s.dpiMin) return "yellow";
  return "red";
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

/** ตรวจไฟล์ภาพตอนอัปโหลด (ยังไม่รู้ขนาดดวง เก็บขนาดพิกเซลไว้คำนวณความคมชัดภายหลัง) */
export function rasterCheck(
  widthPx: number,
  heightPx: number,
  colorMode: string,
  checkedBy: CheckResult["checkedBy"],
  kind: string,
  hasAlpha?: boolean,
): CheckResult {
  const issues: CheckIssue[] = [];
  if (colorMode === "RGB") issues.push(RGB_NOTE);
  if (!["RGB", "CMYK", "Grayscale"].includes(colorMode))
    issues.push({ level: "yellow", message: `โหมดสีของไฟล์เป็น ${colorMode} ร้านจะแปลงสีให้ก่อนพิมพ์` });
  return finalize(issues, { kind, widthPx, heightPx, colorMode, hasAlpha }, checkedBy);
}
