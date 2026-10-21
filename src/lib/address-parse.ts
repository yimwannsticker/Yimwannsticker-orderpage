import { normalizePhone } from "./format";

/** [ตำบล, อำเภอ, จังหวัด] */
export type ZipEntry = [string, string, string];

export interface ParsedAddress {
  name: string;
  phone: string;
  line1: string;
  subdistrict: string;
  district: string;
  province: string;
  zipcode: string;
}

export function findZip(text: string) {
  const m = /(?<!\d)(\d{5})(?!\d)/g;
  let last: string | null = null;
  for (const x of text.matchAll(m)) last = x[1];
  return last;
}

export function findPhone(text: string) {
  const m = /(?<!\d)(?:\+?66[ -]?|0)(?:\d[ -]?){7,8}\d(?!\d)/.exec(text);
  if (!m) return { phone: "", raw: "" };
  const phone = normalizePhone(m[0]);
  return /^0\d{8,9}$/.test(phone) ? { phone, raw: m[0] } : { phone: "", raw: "" };
}

const PREFIX = {
  sub: ["ตำบล", "แขวง", "ต\\.", "ต "],
  dist: ["อำเภอ", "เขต", "อ\\.", "อ "],
  prov: ["จังหวัด", "จ\\.", "จ "],
};

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeName(text: string, name: string, prefixes: string[]) {
  if (!name) return text;
  const withPrefix = new RegExp(`(?:${prefixes.join("|")})\\s*${escape(name)}`);
  if (withPrefix.test(text)) return text.replace(withPrefix, " ");
  return text.replace(name, " ");
}

/** แยกที่อยู่ทั้งก้อนเป็นช่อง ใช้ข้อมูลรหัสไปรษณีย์ช่วยเดาตำบล/อำเภอ/จังหวัด */
export function parseAddress(text: string, zipEntries: ZipEntry[] | null): ParsedAddress {
  const out: ParsedAddress = {
    name: "",
    phone: "",
    line1: "",
    subdistrict: "",
    district: "",
    province: "",
    zipcode: "",
  };
  let rest = text.replace(/\r/g, "");

  const { phone, raw } = findPhone(rest);
  out.phone = phone;
  if (raw) rest = rest.replace(raw, " ");
  rest = rest.replace(/(โทร|เบอร์|tel\.?|phone)\s*[:：]?/gi, " ");

  const zip = findZip(rest);
  if (zip) {
    out.zipcode = zip;
    rest = rest.replace(new RegExp(`(?<!\\d)${zip}(?!\\d)`), " ");
  }

  if (zipEntries?.length) {
    const scored = zipEntries
      .map((e) => {
        let score = 0;
        if (rest.includes(e[0])) score += 3;
        if (rest.includes(e[1])) score += 2;
        if (rest.includes(e[2])) score += 1;
        return { e, score };
      })
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    const sameDistrict = new Set(zipEntries.map((e) => e[1]));
    // ถ้าเดาตำบลไม่ได้ เติมเฉพาะส่วนที่มั่นใจ
    out.province = best.e[2];
    if (best.score >= 3 || zipEntries.length === 1) {
      [out.subdistrict, out.district] = best.e;
    } else if (best.score >= 2 || sameDistrict.size === 1) {
      out.district = best.e[1];
    }
    rest = removeName(rest, out.subdistrict, PREFIX.sub);
    rest = removeName(rest, out.district, PREFIX.dist);
    rest = removeName(rest, out.province, PREFIX.prov);
    rest = rest.replace(/กรุงเทพฯ|กทม\.?/g, " ");
  }

  // บรรทัดแรกที่ไม่มีตัวเลขบ้านเลขที่ มักเป็นชื่อ
  const lines = rest
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l && !/^(ชื่อ|ที่อยู่)\s*[:：]?$/.test(l));
  const nameIdx = lines.findIndex((l) => !/\d/.test(l));
  if (nameIdx === 0 && lines.length > 1) {
    out.name = lines[0].replace(/^(ชื่อ|ผู้รับ)\s*[:：]?\s*/, "");
    lines.splice(0, 1);
  } else if (lines.length === 1) {
    // ทุกอย่างอยู่บรรทัดเดียว: ข้อความก่อนตัวเลขตัวแรกคือชื่อ
    const m = /^([^\d]+?)\s+(\d.*)$/.exec(lines[0]);
    if (m) {
      out.name = m[1].replace(/^(ชื่อ|ผู้รับ)\s*[:：]?\s*/, "");
      lines[0] = m[2];
    }
  }
  out.line1 = lines
    .join(" ")
    .replace(/^(ที่อยู่)\s*[:：]?\s*/, "")
    .replace(/\s+,/g, ",")
    .replace(/[,\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return out;
}

/** หารหัสไปรษณีย์จากข้อความ (ตัดเบอร์โทรออกก่อน) เพื่อนำไปโหลดข้อมูลตำบล */
export function guessZip(text: string) {
  const { raw } = findPhone(text);
  return findZip(raw ? text.replace(raw, " ") : text);
}
