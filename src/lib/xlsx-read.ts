/**
 * อ่านไฟล์ .xlsx แบบง่าย (ชีตแรก เป็นตารางข้อความ) ไม่ต้องใช้ไลบรารี
 * ใช้กับไฟล์ export จาก Shopee ซึ่งไลบรารีทั่วไปบางตัวเปิดไม่ได้
 * ทำงานได้ทั้งใน browser และ Node (ใช้ DecompressionStream)
 */

type Entry = { name: string; method: number; offset: number; size: number };

function entries(buf: Uint8Array): Entry[] {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // หา End of Central Directory จากท้ายไฟล์
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("ไม่ใช่ไฟล์ .xlsx");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out: Entry[] = [];
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("ไฟล์ .xlsx เสียหาย");
    const method = v.getUint16(p + 10, true);
    const size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen));
    const lName = v.getUint16(local + 26, true);
    const lExtra = v.getUint16(local + 28, true);
    out.push({ name, method, offset: local + 30 + lName + lExtra, size });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

async function inflate(data: Uint8Array) {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readText(buf: Uint8Array, list: Entry[], name: string) {
  const e = list.find((x) => x.name === name);
  if (!e) return null;
  const raw = buf.subarray(e.offset, e.offset + e.size);
  const bytes = e.method === 8 ? await inflate(raw) : raw;
  return new TextDecoder().decode(bytes);
}

const unescape = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, c: string) => {
    if (c[0] === "#") return String.fromCodePoint(c[1] === "x" || c[1] === "X" ? parseInt(c.slice(2), 16) : Number(c.slice(1)));
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[c.toLowerCase()];
  });

/** ข้อความใน <t> ทั้งหมด (ไม่รวมคำอ่าน <rPh>) */
function texts(xml: string) {
  return [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>|<t\b[^>]*\/>/g)]
    .map((m) => unescape(m[1] ?? ""))
    .join("");
}

function colIndex(ref: string) {
  let n = 0;
  for (const ch of /^[A-Z]+/.exec(ref)?.[0] ?? "A") n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

/** คืนแถวของชีตแรกเป็นอาร์เรย์ข้อความ (ช่องว่างเป็น "") */
export async function readXlsxRows(file: ArrayBuffer | Uint8Array): Promise<string[][]> {
  const buf = file instanceof Uint8Array ? file : new Uint8Array(file);
  const list = entries(buf);
  const shared = [...((await readText(buf, list, "xl/sharedStrings.xml")) ?? "").matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) =>
    texts(m[1]),
  );

  // หาไฟล์ของชีตแรกจาก workbook
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wb = await readText(buf, list, "xl/workbook.xml");
  const rels = await readText(buf, list, "xl/_rels/workbook.xml.rels");
  const rid = wb && /<sheet\b[^>]*\br:id="([^"]+)"/.exec(wb)?.[1];
  if (rid && rels) {
    const target = new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"|<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`).exec(
      rels,
    );
    const t = target?.[1] ?? target?.[2];
    if (t) sheetPath = t.startsWith("/") ? t.slice(1) : t.startsWith("xl/") ? t : `xl/${t}`;
  }
  const sheet = await readText(buf, list, sheetPath);
  if (!sheet) throw new Error("ไม่พบชีตในไฟล์");

  const rows: string[][] = [];
  for (const rm of sheet.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const row: string[] = [];
    for (const cm of (rm[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const body = cm[2] ?? "";
      const ref = /\br="([A-Z]+)\d*"/.exec(attrs)?.[1];
      const i = ref ? colIndex(ref) : row.length;
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
      const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let val = "";
      if (type === "s" && v != null) val = shared[Number(v)] ?? "";
      else if (type === "inlineStr") val = texts(body);
      else if (v != null) val = unescape(v);
      while (row.length < i) row.push("");
      row[i] = val;
    }
    rows.push(row);
  }
  return rows;
}
