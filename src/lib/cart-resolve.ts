import type { ShopCatalog, ShopDesign, ShopProduct, ShopSize } from "./shop-types";
import type { A5CartLine } from "./types";

export interface ResolvedLine {
  line: A5CartLine;
  product: ShopProduct | null;
  design: ShopDesign | null;
  size: ShopSize | null;
  /** เหตุผลที่สั่งไม่ได้ (null = สั่งได้) */
  problem: string | null;
}

/** จับคู่รายการในตะกร้ากับข้อมูลร้านล่าสุด (สินค้า/ลายอาจถูกปิดขายหรือลบไปแล้ว) */
export function resolveCart(lines: A5CartLine[], catalog: ShopCatalog): ResolvedLine[] {
  return lines.map((line) => {
    const product = catalog.products.find((p) => p.id === line.productId) ?? null;
    const design = product?.designs.find((d) => d.id === line.designId) ?? null;
    const size = product?.sizes.find((s) => s.id === line.sizeId) ?? null;
    let problem: string | null = null;
    if (!product || !design) problem = "สินค้านี้ปิดขายแล้ว";
    else if (!design.active) problem = "ลายนี้หมดชั่วคราว";
    else if (product.sizes.length && !size) problem = "ขนาดนี้ไม่มีแล้ว";
    return { line, product, design, size, problem };
  });
}
