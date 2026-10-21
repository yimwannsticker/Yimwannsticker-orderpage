export function baht(n: number) {
  return `${n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} บาท`;
}

/** เก็บเบอร์เป็นตัวเลข 10 หลัก ขึ้นต้น 0 */
export function normalizePhone(input: string) {
  let d = (input || "").replace(/\D/g, "");
  if (d.startsWith("66") && d.length === 11) d = "0" + d.slice(2);
  return d;
}

export function isValidPhone(p: string) {
  return /^0\d{8,9}$/.test(p);
}

export function formatPhone(p: string) {
  if (p.length === 10) return `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}`;
  return p;
}

export function fileSizeText(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function thaiDate(d: string | Date | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatAddress(a: {
  line1: string;
  subdistrict: string;
  district: string;
  province: string;
  zipcode: string;
}) {
  const bkk = a.province.includes("กรุงเทพ");
  const sub = a.subdistrict ? `${bkk ? "แขวง" : "ต."}${a.subdistrict}` : "";
  const dist = a.district ? `${bkk ? "เขต" : "อ."}${a.district}` : "";
  const prov = a.province ? (bkk ? a.province : `จ.${a.province}`) : "";
  return [a.line1, sub, dist, prov, a.zipcode].filter(Boolean).join(" ");
}
