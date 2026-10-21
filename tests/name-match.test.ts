import { describe, expect, it } from "vitest";
import { nameMatches } from "@/lib/name-match";

describe("nameMatches", () => {
  it("ชื่อเต็ม ไม่สนคำนำหน้าและช่องว่าง", () => {
    expect(nameMatches("สมหญิง ใจดี", "คุณสมหญิง  ใจดี")).toBe(true);
    expect(nameMatches("น.ส.สมหญิง ใจดี", "สมหญิง ใจดี")).toBe(true);
    expect(nameMatches("สมหญิงใจดี", "สมหญิง ใจดี")).toBe(true);
  });
  it("ชื่อหน้าอย่างเดียวได้", () => {
    expect(nameMatches("สมหญิง", "สมหญิง ใจดี")).toBe(true);
    expect(nameMatches("ใจดี", "สมหญิง ใจดี")).toBe(false);
  });
  it("ชื่อไม่ตรง / สั้นเกิน", () => {
    expect(nameMatches("สมชาย", "สมหญิง ใจดี")).toBe(false);
    expect(nameMatches("ส", "ส")).toBe(false);
    expect(nameMatches("Yimwann", "ร้าน yimwann")).toBe(false);
  });
});
