import { describe, expect, it } from "vitest";
import { applySize, cleanTrim, fileAspect, trimCheck } from "@/lib/sticker-size";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import type { CheckResult } from "@/lib/types";

const png: CheckResult = { level: "green", title: "พร้อมพิมพ์", issues: [], info: { kind: "png", widthPx: 2000, heightPx: 1000 }, checkedBy: "browser" };

describe("cleanTrim", () => {
  it("รับกรอบที่ถูกต้อง", () => {
    expect(cleanTrim({ x: 0.1, y: 0.2, w: 0.5, h: 0.6, color: "#FFFFFF" })).toEqual({ x: 0.1, y: 0.2, w: 0.5, h: 0.6, color: "#ffffff" });
    expect(cleanTrim({ x: 0, y: 0, w: 1, h: 1, color: "transparent" })?.color).toBe("transparent");
  });
  it("ปฏิเสธค่าที่ผิด", () => {
    expect(cleanTrim(null)).toBeNull();
    expect(cleanTrim({ x: 0.6, y: 0, w: 0.6, h: 0.5, color: "#ffffff" })).toBeNull();
    expect(cleanTrim({ x: 0, y: 0, w: 0.01, h: 0.5, color: "#ffffff" })).toBeNull();
    expect(cleanTrim({ x: 0, y: 0, w: 0.5, h: 0.5, color: "red" })).toBeNull();
    expect(cleanTrim({ x: "a", y: 0, w: 0.5, h: 0.5, color: "#ffffff" })).toBeNull();
  });
});

describe("trimCheck", () => {
  it("สัดส่วนและพิกเซลคิดจากส่วนงาน", () => {
    const t = trimCheck(png, { x: 0.25, y: 0, w: 0.5, h: 1, color: "#ffffff" })!;
    expect(t.info.widthPx).toBe(1000);
    expect(fileAspect(t)).toBe(1);
  });
  it("DPI ลดลงเมื่อใช้ส่วนงานเล็กลง", () => {
    const size = { shape: "rect" as const, widthMm: 50, heightMm: 50 };
    const full = applySize(trimCheck(png, null), { ...size, heightMm: 25 }, DEFAULT_SETTINGS)!;
    const cut = applySize(trimCheck(png, { x: 0.25, y: 0, w: 0.5, h: 1, color: "#ffffff" }), size, DEFAULT_SETTINGS)!;
    expect(cut.info.dpi).toBeLessThan(full.info.dpi!);
    expect(cut.issues.some((i) => i.code === "size")).toBe(false);
  });
});
