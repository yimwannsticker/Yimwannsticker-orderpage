/** ข้อมูลร้านสติกเกอร์สำเร็จรูป A5 ที่ส่งให้หน้าเว็บ (รูปแปลงเป็นลิงก์แล้ว) */

export interface ShopCategory {
  id: string;
  name: string;
  iconUrl: string | null;
}

export interface ShopSize {
  id: string;
  name: string;
  /** สินค้า A5: บวกเพิ่มจากราคาขั้นบันได */
  surcharge: number;
  /** สินค้าราคาคงที่: ราคาต่อหน่วย และจำนวนชิ้นต่อหน่วย (นับเกณฑ์ส่งฟรี) */
  price: number | null;
  units: number | null;
}

export type ShopPricing = "a5" | "fixed";

export interface ShopDesign {
  id: string;
  name: string;
  sku: string;
  imageUrl: string | null;
  thumbUrl: string | null;
  active: boolean;
}

export interface ShopProduct {
  id: string;
  categoryId: string | null;
  name: string;
  description: string;
  piecesPerSheet: number | null;
  material: string;
  /** a5 = ราคาขั้นบันไดตามแผ่น A5 · fixed = ราคาคงที่ตามตัวเลือก (เช่น การ์ดแพ็ค) */
  pricing: ShopPricing;
  /** ชื่อปุ่มตัวเลือก เช่น ขนาด / สี / แพ็ค */
  optionLabel: string;
  /** หน่วยที่ขาย เช่น แผ่น / แพ็ค */
  unitLabel: string;
  images: { url: string; thumbUrl: string }[];
  badgeBest: boolean;
  badgeNew: boolean;
  sold: number;
  createdAt: string;
  position: number;
  sizes: ShopSize[];
  designs: ShopDesign[];
}

export interface ShopCatalog {
  categories: ShopCategory[];
  products: ShopProduct[];
}

export type ShopSort = "best" | "new" | "price_asc" | "price_desc";

export const SORTS: { key: ShopSort; label: string }[] = [
  { key: "best", label: "ขายดี" },
  { key: "new", label: "ใหม่" },
  { key: "price_asc", label: "ราคา ↑" },
  { key: "price_desc", label: "ราคา ↓" },
];

/** ส่วนต่างราคาถูกสุดของสินค้า (ใช้เรียงตามราคา) */
export const minSurcharge = (p: ShopProduct) => (p.sizes.length ? Math.min(...p.sizes.map((s) => s.surcharge)) : 0);

/** ราคาของรายการในตะกร้า: สินค้าราคาคงที่ใช้ราคาของตัวเลือก ไม่งั้นใช้ราคาขั้นบันได + ส่วนต่าง */
export function quoteLineFor(p: Pick<ShopProduct, "pricing">, size: ShopSize | null, qty: number) {
  if (p.pricing === "fixed") return { qty, surcharge: 0, fixed: { price: size?.price ?? 0, units: size?.units ?? 1 } };
  return { qty, surcharge: size?.surcharge ?? 0, fixed: null };
}

/** ช่วงราคาสินค้าราคาคงที่ */
export function fixedPriceRange(p: Pick<ShopProduct, "sizes">) {
  const prices = p.sizes.map((s) => s.price ?? 0);
  return prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : { min: 0, max: 0 };
}

/** เรียงสินค้า · a5Base = ราคา A5 ต่อแผ่นที่ใช้เทียบกับสินค้าราคาคงที่ */
export function sortProducts(list: ShopProduct[], sort: ShopSort, a5Base = 0) {
  const sortPrice = (p: ShopProduct) => (p.pricing === "fixed" ? fixedPriceRange(p).min : a5Base + minSurcharge(p));
  const xs = [...list];
  if (sort === "best") xs.sort((a, b) => Number(b.badgeBest) - Number(a.badgeBest) || b.sold - a.sold || a.position - b.position);
  if (sort === "new") xs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (sort === "price_asc") xs.sort((a, b) => sortPrice(a) - sortPrice(b) || b.sold - a.sold);
  if (sort === "price_desc") xs.sort((a, b) => sortPrice(b) - sortPrice(a) || b.sold - a.sold);
  return xs;
}

/** ค้นจากชื่อสินค้า รายละเอียด ชื่อลาย และรหัส SKU */
export function searchProducts(list: ShopProduct[], q: string) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  return list.filter((p) => {
    const hay = [p.name, p.description, p.material, ...p.designs.flatMap((d) => [d.name, d.sku])].join(" ").toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** สร้าง SKU ของลาย: รหัสลายของร้าน + ลำดับ 2 หลัก เช่น 33-01 */
export function makeSku(designCode: string, n: number) {
  const code = designCode.trim() || "A5";
  return `${code}-${String(n).padStart(2, "0")}`;
}

/** ลำดับถัดไปของ SKU ที่ขึ้นต้นด้วยรหัสลายนี้ */
export function nextSkuNumber(designCode: string, skus: string[]) {
  const code = (designCode.trim() || "A5").toLowerCase();
  let max = 0;
  for (const s of skus) {
    const m = /^(.*)-(\d+)$/.exec(s.toLowerCase());
    if (m && m[1] === code) max = Math.max(max, Number(m[2]));
  }
  return max + 1;
}
