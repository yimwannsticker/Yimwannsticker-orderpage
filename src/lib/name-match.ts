const PREFIX = /^(คุณ|นางสาว|นาง|นาย|น\.ส\.|ด\.ช\.|ด\.ญ\.|mr\.?|mrs\.?|ms\.?|miss)\s*/i;

/** ตัดคำนำหน้า ช่องว่าง และเครื่องหมาย เพื่อเทียบชื่อ */
export function normalizeName(s: string) {
  return (s || "")
    .trim()
    .replace(PREFIX, "")
    .toLowerCase()
    .replace(/[\s.,\-_'"()]/g, "");
}

/** ชื่อที่ลูกค้ากรอกตรงกับชื่อผู้รับในออเดอร์ไหม (ชื่อเต็ม หรือเฉพาะชื่อหน้าก็ได้) */
export function nameMatches(input: string, stored: string) {
  const a = normalizeName(input);
  if (a.length < 2) return false;
  if (a === normalizeName(stored)) return true;
  const first = (stored || "").trim().replace(PREFIX, "").split(/\s+/)[0] ?? "";
  return a === normalizeName(first);
}
