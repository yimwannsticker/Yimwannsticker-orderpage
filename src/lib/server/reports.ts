import "server-only";
import { db } from "../supabase/admin";

/** นับยอดเฉพาะออเดอร์ที่ชำระแล้ว (ไม่รวมรอตรวจสลิปและยกเลิก) */
export const REPORT_STATUSES = ["paid", "producing", "shipped"];

export interface A5Report {
  month: string;
  orders: number;
  sheets: number;
  revenue: number;
  byProduct: { product: string; designer: string; sheets: number; revenue: number; orders: number }[];
  byDesign: { sku: string; product: string; design: string; size: string; designer: string; sheets: number; revenue: number }[];
  byDesigner: { designer: string; sheets: number; revenue: number; products: number }[];
}

/** เดือน (YYYY-MM ตามเวลาไทย) → ช่วงเวลา */
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { start: `${month}-01T00:00:00+07:00`, end: `${next}-01T00:00:00+07:00` };
}

export function currentMonth() {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
}

type Row = {
  order_id: string;
  product_name: string;
  design_name: string;
  size_name: string | null;
  sku: string;
  designer_name: string | null;
  qty: number;
  line_total: number;
  pricing: string | null;
};

/** ยอดขายสติกเกอร์สำเร็จรูป A5 รายเดือน: ต่อสินค้า ต่อลาย ต่อกราฟิก (ใช้คิดค่าคอมมิชชั่น) */
export async function getA5Report(month: string): Promise<A5Report> {
  const { start, end } = monthRange(month);
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db()
      .from("order_a5_items")
      .select("order_id, product_name, design_name, size_name, sku, designer_name, qty, line_total, pricing, orders!inner(status, created_at)")
      .in("orders.status", REPORT_STATUSES)
      .gte("orders.created_at", start)
      .lt("orders.created_at", end)
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }

  const noDesigner = "ไม่ระบุ";
  const add = <T extends { sheets: number; revenue: number }>(m: Map<string, T>, key: string, init: () => T, r: Row) => {
    const cur = m.get(key) ?? init();
    cur.sheets += r.qty;
    cur.revenue += Number(r.line_total);
    m.set(key, cur);
    return cur;
  };
  const prod = new Map<string, A5Report["byProduct"][number] & { orderSet: Set<string> }>();
  const design = new Map<string, A5Report["byDesign"][number]>();
  const designer = new Map<string, A5Report["byDesigner"][number] & { productSet: Set<string> }>();
  for (const r of rows) {
    const who = r.designer_name || noDesigner;
    add(prod, r.product_name, () => ({ product: r.product_name, designer: who, sheets: 0, revenue: 0, orders: 0, orderSet: new Set() }), r).orderSet.add(r.order_id);
    add(design, `${r.sku}|${r.size_name ?? ""}`, () => ({ sku: r.sku, product: r.product_name, design: r.design_name, size: r.size_name ?? "", designer: who, sheets: 0, revenue: 0 }), r);
    add(designer, who, () => ({ designer: who, sheets: 0, revenue: 0, products: 0, productSet: new Set() }), r).productSet.add(r.product_name);
  }
  const bySheets = (a: { sheets: number }, b: { sheets: number }) => b.sheets - a.sheets;
  return {
    month,
    orders: new Set(rows.map((r) => r.order_id)).size,
    // แผ่น A5 จริง (ไม่รวมการ์ดที่ขายเป็นแพ็ค)
    sheets: rows.reduce((a, r) => a + (r.pricing === "fixed" ? 0 : r.qty), 0),
    revenue: rows.reduce((a, r) => a + Number(r.line_total), 0),
    byProduct: [...prod.values()].map(({ orderSet, ...x }) => ({ ...x, orders: orderSet.size })).sort(bySheets),
    byDesign: [...design.values()].sort((a, b) => a.sku.localeCompare(b.sku, "th", { numeric: true })),
    byDesigner: [...designer.values()].map(({ productSet, ...x }) => ({ ...x, products: productSet.size })).sort(bySheets),
  };
}
