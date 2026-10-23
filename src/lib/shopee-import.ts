/**
 * แปลงไฟล์ export จาก Shopee (media_info, sales_info และ basic_info ถ้ามี) เป็นสินค้าในร้าน
 * - ไม่นำเข้าตัวเลือกที่มีคำว่า "ตำหนิ" สินค้าลดล้างสต็อค งานศพ และงานเคลือบ
 * - การ์ด (ตัวเลือก "แพ็ค N ใบ") เป็นสินค้าราคาคงที่ ใช้ราคาเดียวกับ Shopee
 * - สินค้าอื่นใช้ราคาขั้นบันได A5 ส่วนต่างตามขนาดคิดจากสัดส่วนราคาใน Shopee
 */

export interface ShopeePlanDesign {
  name: string;
  /** ชื่อตัวเลือกใน Shopee */
  option: string;
  image: string | null;
  active: boolean;
}

export interface ShopeePlan {
  itemId: string;
  title: string;
  name: string;
  description: string;
  images: string[];
  pricing: "a5" | "fixed";
  optionLabel: string;
  unitLabel: string;
  piecesPerSheet: number | null;
  material: string;
  designCode: string;
  sizes: { name: string; surcharge: number; price: number | null; units: number | null }[];
  designs: ShopeePlanDesign[];
  /** จำนวนตัวเลือก "ตำหนิ" ที่ตัดออก */
  skippedFlawed: number;
}

export interface ShopeeExcluded {
  itemId: string;
  title: string;
  reason: string;
}

type Table = Record<string, string>[];

const ID = "et_title_product_id";

/** แถวข้อมูล (ข้ามหัวตาราง/คำอธิบายของ Shopee) เป็น object ตามชื่อคอลัมน์แถวแรก */
export function tableOf(rows: string[][]): Table {
  const head = rows[0] ?? [];
  if (!head.includes(ID)) return [];
  const idCol = head.indexOf(ID);
  return rows
    .slice(1)
    .filter((r) => /^\d{5,}$/.test(String(r[idCol] ?? "").trim()))
    .map((r) => Object.fromEntries(head.map((h, i) => [h, String(r[i] ?? "").trim()])));
}

/** ประเภทไฟล์จากแถวที่ 2 (Shopee ใส่ media_info / sales_info / basic_info) หรือจากคอลัมน์ */
export function shopeeFileKind(rows: string[][]): "media" | "sales" | "basic" | null {
  const head = rows[0] ?? [];
  const tag = (rows[1] ?? [])[0] ?? "";
  if (tag === "media_info" || head.includes("ps_item_cover_image")) return "media";
  if (tag === "sales_info" || head.includes("et_title_variation_price")) return "sales";
  if (tag === "basic_info" || head.some((h) => /description/i.test(h))) return "basic";
  return null;
}

const FLAW = "ตำหนิ";
const EXCLUDE: [RegExp, string][] = [
  [/ลดล้างสต็?อค|ลดล้างสต็?อก/, "สินค้าลดล้างสต็อค (ตำหนิ)"],
  [/งานศพ/, "สติกเกอร์งานศพ"],
  [/เคลือบลามิเนต|งานเคลือบ/, "งานเคลือบลามิเนต"],
];

/** ตัดคำโฆษณาท้ายชื่อ Shopee ให้เหลือชื่อสินค้าสั้นๆ (แก้ต่อได้ในหน้าตัวอย่าง) */
export function shortName(title: string) {
  let s = title.replace(/^\s*[([][^)\]]*(?:แพ็ค|สำหรับ)[^)\]]*[)\]]\s*/, "");
  const cut = s.search(/\s(?:กันน้ำ|\d+\s*(?:-\s*\d+\s*)?ดวง|ขนาด\s*\d)/);
  if (cut > 8) s = s.slice(0, cut);
  // วงเล็บที่ถูกตัดครึ่ง เช่น "(24-36"
  s = s.replace(/\s*[([][^)\]]*$/, "").replace(/\s+/g, " ").trim();
  if (s.length > 80) s = s.slice(0, 80).replace(/\s+\S*$/, "");
  return s || title.slice(0, 80);
}

/** จำนวนดวงต่อแผ่นจากชื่อ เช่น "84ดวง/แผ่น" (ช่วง "21-36ดวง" หรือหลายแบบ "15,36ดวง" ไม่เดา) */
export function piecesFromTitle(title: string) {
  const m = /(?<![\d,\-–.])(\d{1,4})\s*ดวง/.exec(title);
  return m ? Number(m[1]) : null;
}

/** แยกรหัสลายข้างหน้าชื่อตัวเลือก เช่น "83-ธรรมดา" → { code: "83", name: "ธรรมดา" } */
export function splitOption(option: string) {
  const m = /^(\d{1,4})\s*[-–]\s*(.+)$/.exec(option.trim());
  return m ? { code: m[1], name: m[2].trim() } : { code: "", name: option.trim() };
}

const mode = <T>(list: T[]) => {
  const c = new Map<T, number>();
  for (const x of list) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
};

const looksLikeSize = (s: string) => /\d\s*(?:x|×)\s*\d|ซม|cm|มม|mm/i.test(s);

export function buildShopeePlans(
  input: { media: string[][]; sales: string[][]; basic?: string[][] | null },
  opts: { a5BasePrice: number },
): { plans: ShopeePlan[]; excluded: ShopeeExcluded[] } {
  const media = tableOf(input.media);
  const sales = tableOf(input.sales);
  const basic = input.basic ? tableOf(input.basic) : [];
  const descKey = Object.keys(basic[0] ?? {}).find((k) => /description/i.test(k));

  const salesBy = new Map<string, Table>();
  for (const r of sales) salesBy.set(r[ID], [...(salesBy.get(r[ID]) ?? []), r]);

  const plans: ShopeePlan[] = [];
  const excluded: ShopeeExcluded[] = [];

  for (const m of media) {
    const itemId = m[ID];
    const title = m.et_title_product_name || salesBy.get(itemId)?.[0]?.et_title_product_name || "";
    const ex = EXCLUDE.find(([re]) => re.test(title));
    if (ex) {
      excluded.push({ itemId, title, reason: ex[1] });
      continue;
    }
    const variants = salesBy.get(itemId) ?? [];
    if (!variants.length) {
      excluded.push({ itemId, title, reason: "ไม่มีข้อมูลราคาในไฟล์ sales_info" });
      continue;
    }

    // ตัวเลือกชั้นที่ 1 (ลาย) พร้อมรูป จาก media_info
    const options: { option: string; image: string | null }[] = [];
    for (let i = 1; i <= 100; i++) {
      const option = m[`et_title_option_${i}_for_variation_1`];
      if (option) options.push({ option, image: m[`et_title_option_image_${i}_for_variation_1`] || null });
    }
    const images = ["ps_item_cover_image", ...Array.from({ length: 8 }, (_, i) => `ps_item_image.${i + 1}`)]
      .map((k) => m[k])
      .filter((u): u is string => Boolean(u));

    // แยกชื่อตัวเลือก Shopee "ลาย,ขนาด" ด้วยรายชื่อลายที่รู้ (ชื่อลายอาจมีจุลภาค)
    const byLength = [...options].sort((a, b) => b.option.length - a.option.length);
    const parsed = variants.map((v) => {
      const full = v.et_title_variation_name ?? "";
      const o = byLength.find((x) => full === x.option || full.startsWith(`${x.option},`));
      const tier1 = o ? o.option : options.length ? full.split(",")[0] : "";
      const tier2 = o ? full.slice(o.option.length + 1) : options.length ? full.split(",").slice(1).join(",") : full;
      return { tier1, tier2: tier2.trim(), price: Number(v.et_title_variation_price) || 0, stock: Number(v.et_title_variation_stock) || 0 };
    });
    const clean = parsed.filter((p) => !p.tier1.includes(FLAW) && !p.tier2.includes(FLAW));
    const skippedFlawed = options.filter((o) => o.option.includes(FLAW)).length;

    // ลาย: ตัวเลือกชั้นที่ 1 ที่ไม่ใช่ตำหนิ (สินค้าไม่มีตัวเลือก = 1 ลาย ใช้รูปปก)
    const designOptions = options.length ? options.filter((o) => !o.option.includes(FLAW)) : [{ option: "", image: images[0] ?? null }];
    const codes = designOptions.map((o) => splitOption(o.option).code).filter(Boolean);
    const designCode = mode(codes) ?? `S${itemId.slice(-4)}`;
    const designs: ShopeePlanDesign[] = designOptions
      .map((o) => {
        const rows = clean.filter((p) => p.tier1 === o.option);
        const { code, name } = splitOption(o.option);
        return {
          option: o.option,
          name: (code === designCode || !code ? name : o.option) || shortName(title),
          image: o.image ?? (options.length ? null : images[0] ?? null),
          active: rows.some((r) => r.stock > 0),
          has: rows.length > 0,
        };
      })
      .filter((d) => d.has)
      .map(({ has: _has, ...d }) => d);
    if (!designs.length) {
      excluded.push({ itemId, title, reason: "ไม่มีลายที่นำเข้าได้ (ตำหนิทั้งหมด)" });
      continue;
    }

    // ตัวเลือกชั้นที่ 2: ขนาด/สี/แพ็ค ราคา = ราคาที่พบบ่อยสุดของตัวเลือกนั้น
    const tier2 = [...new Set(clean.map((p) => p.tier2).filter(Boolean))].map((name) => ({
      name,
      price: mode(clean.filter((p) => p.tier2 === name).map((p) => p.price)) ?? 0,
    }));
    const packs = tier2.map((t) => /แพ็ค\s*(\d+)/.exec(t.name)?.[1]);
    const isCard = /การ์ด/.test(title) && tier2.length > 0 && packs.every(Boolean);

    let sizes: ShopeePlan["sizes"] = [];
    let optionLabel = "ขนาด";
    if (isCard) {
      optionLabel = "แพ็ค";
      sizes = tier2
        .map((t, i) => ({ name: t.name, surcharge: 0, price: t.price, units: Number(packs[i]) }))
        .sort((a, b) => a.units - b.units);
    } else if (tier2.length > 1) {
      optionLabel = tier2.every((t) => looksLikeSize(t.name)) ? "ขนาด" : "สี";
      const min = Math.min(...tier2.map((t) => t.price).filter((p) => p > 0));
      sizes = tier2.map((t) => ({
        name: t.name,
        surcharge: min > 0 && t.price > min ? Math.round(opts.a5BasePrice * (t.price / min - 1)) : 0,
        price: null,
        units: null,
      }));
    }

    const description = descKey ? basic.find((b) => b[ID] === itemId)?.[descKey] ?? "" : "";
    plans.push({
      itemId,
      title,
      name: shortName(title),
      description,
      images,
      pricing: isCard ? "fixed" : "a5",
      optionLabel,
      unitLabel: isCard ? "แพ็ค" : "แผ่น",
      piecesPerSheet: isCard ? null : piecesFromTitle(title),
      material: /กันน้ำ/.test(title) ? "กันน้ำ 100%" : "",
      designCode,
      sizes,
      designs,
      skippedFlawed,
    });
  }
  return { plans, excluded };
}
