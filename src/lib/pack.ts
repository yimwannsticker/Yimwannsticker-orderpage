/** สรุปรายการแบบสั้น สำหรับวางในช่องหมายเหตุของ MyOrder เช่น "A5: 33-01×3, 33-02×2 | A3+: 2 ไฟล์ 40 แผ่น" */
export function shortOrderText(
  a5: { sku: string; qty: number }[],
  a3: { files: number; sheets: number; free: number },
  sheetName = "A3+",
) {
  const parts: string[] = [];
  if (a5.length) {
    const sorted = [...a5].sort((a, b) => a.sku.localeCompare(b.sku, "th", { numeric: true }));
    parts.push(`A5: ${sorted.map((l) => `${l.sku}×${l.qty}`).join(", ")}`);
  }
  if (a3.files) parts.push(`${sheetName}: ${a3.files} ไฟล์ ${a3.sheets} แผ่น${a3.free ? ` +แถม ${a3.free}` : ""}`);
  return parts.join(" | ");
}
