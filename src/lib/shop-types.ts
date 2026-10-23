/** ข้อมูลร้านสติกเกอร์สำเร็จรูป A5 ที่ส่งให้หน้าเว็บ (รูปแปลงเป็นลิงก์แล้ว) */

export interface ShopCategory {
  id: string;
  name: string;
  iconUrl: string | null;
}

export interface ShopSize {
  id: string;
  name: string;
  surcharge: number;
}

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

export function sortProducts(list: ShopProduct[], sort: ShopSort) {
  const xs = [...list];
  if (sort === "best") xs.sort((a, b) => Number(b.badgeBest) - Number(a.badgeBest) || b.sold - a.sold || a.position - b.position);
  if (sort === "new") xs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (sort === "price_asc") xs.sort((a, b) => minSurcharge(a) - minSurcharge(b) || b.sold - a.sold);
  if (sort === "price_desc") xs.sort((a, b) => minSurcharge(b) - minSurcharge(a) || b.sold - a.sold);
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
