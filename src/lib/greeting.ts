const PREFIX = /^(คุณ|นางสาว|นาง|นาย|น\.ส\.)\s*/;

/** ชื่อหน้า ไม่มีคำนำหน้า (ไว้ต่อท้าย "คุณ") */
export function firstName(s: string) {
  return s.trim().replace(PREFIX, "").split(/\s+/)[0] || s.trim();
}

/** สุ่ม 1 ข้อความ แล้วแทน {n} ด้วยชื่อลูกค้า (null = ไม่มีข้อความให้สุ่ม) */
export function pickMessage(list: string[], name: string) {
  const xs = list.map((m) => m.trim()).filter(Boolean);
  if (!xs.length) return null;
  return xs[Math.floor(Math.random() * xs.length)].replaceAll("{n}", firstName(name));
}

/** ข้อความหลายบรรทัดจากหลังบ้าน → รายการข้อความ */
export function parseMessageLines(text: string) {
  return text
    .split("\n")
    .map((l) => l.trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, 50);
}
