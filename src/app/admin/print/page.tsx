import QRCode from "qrcode";
import { formatAddress, thaiDate } from "@/lib/format";
import { productLabel, shapeLabel } from "@/lib/constants";
import { requireStaff } from "@/lib/server/auth";
import { siteUrl } from "@/lib/server/email";
import type { A5ItemRow, ItemRow, OrderRow } from "@/lib/server/orders";
import { getSettings } from "@/lib/server/settings";
import { sizeText } from "@/lib/sticker-size";
import { db } from "@/lib/supabase/admin";
import { Slips, type SlipData } from "./slips";

export const dynamic = "force-dynamic";
export const metadata = { title: "ใบรายการสินค้า", robots: { index: false } };

/** ใบรายการสินค้า 100×150 มม. (พิมพ์ได้หลายออเดอร์ในไฟล์เดียว) */
export default async function PrintSlipsPage({ searchParams }: { searchParams: Promise<{ ids?: string | string[] }> }) {
  await requireStaff();
  const raw = (await searchParams).ids;
  const ids = (Array.isArray(raw) ? raw : (raw ?? "").split(","))
    .map((s) => s.trim())
    .filter((s) => /^[0-9a-f-]{36}$/i.test(s))
    .slice(0, 100);
  if (!ids.length) return <p className="p-6 text-center">ยังไม่ได้เลือกออเดอร์</p>;

  const [settings, { data: orders }, { data: items }, { data: a5 }] = await Promise.all([
    getSettings(),
    db().from("orders").select("*").in("id", ids),
    db().from("order_items").select("*").in("order_id", ids).order("position"),
    db().from("order_a5_items").select("*").in("order_id", ids),
  ]);
  const byId = new Map(((orders ?? []) as OrderRow[]).map((o) => [o.id, o]));

  const slips: SlipData[] = await Promise.all(
    ids
      .filter((id) => byId.has(id))
      .map(async (id) => {
        const o = byId.get(id)!;
        const a3 = ((items ?? []) as ItemRow[]).filter((i) => i.order_id === id);
        const a5Rows = ((a5 ?? []) as A5ItemRow[])
          .filter((i) => i.order_id === id)
          .sort((x, y) => x.sku.localeCompare(y.sku, "th", { numeric: true }));
        // จัดกลุ่ม A5 ตามสินค้า (เรียงตาม SKU ตัวแรกของกลุ่ม)
        const groups = new Map<string, A5ItemRow[]>();
        for (const r of a5Rows) groups.set(r.product_name, [...(groups.get(r.product_name) ?? []), r]);
        return {
          id,
          orderNo: o.order_no,
          date: thaiDate(o.created_at),
          qr: await QRCode.toString(`${siteUrl()}/admin/orders/${id}`, { type: "svg", margin: 0, errorCorrectionLevel: "M" }),
          name: o.customer_name,
          phone: o.customer_phone,
          address: formatAddress(o.address),
          note: o.customer_note,
          groups: [...groups.entries()].map(([product, rows]) => ({
            product,
            rows: rows.map((r) => ({
              sku: r.sku,
              label: [r.design_name, r.size_name].filter(Boolean).join(" · "),
              qty: r.qty,
              unit: r.pricing === "fixed" ? (r.unit_label ?? "ชิ้น") : null,
            })),
          })),
          a3: a3.map((i) => ({
            label: `${settings.sheetName} ไฟล์ ${i.position}: ${i.file_name}`,
            detail: [productLabel(i.product, i.finish), i.shape ? `ไดคัท${shapeLabel(i.shape)} ${sizeText({ shape: i.shape, widthMm: Number(i.width_mm), heightMm: Number(i.height_mm) })}` : null]
              .filter(Boolean)
              .join(" · "),
            qty: i.qty,
            free: i.free_qty,
          })),
          a5Sheets: a5Rows.reduce((s, r) => s + (r.pricing === "fixed" ? 0 : r.qty), 0),
          fixedUnits: a5Rows.reduce((s, r) => s + (r.pricing === "fixed" ? r.qty * (r.units ?? 1) : 0), 0),
          a3Sheets: o.total_sheets,
          freeSheets: o.free_sheets,
        };
      }),
  );

  return <Slips slips={slips} shopName={settings.shopName} sheetName={settings.sheetName} />;
}
