import { getStaff } from "@/lib/server/auth";
import { formatAddress } from "@/lib/format";
import { db } from "@/lib/supabase/admin";
import type { Address } from "@/lib/types";

async function all(table: string) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from(table).select("*").range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * สำรองข้อมูล (แอดมินเท่านั้น)
 * ?format=json ทุกตาราง สำหรับกู้คืน · ?format=csv รายการออเดอร์ เปิดใน Excel ได้
 */
export async function GET(req: Request) {
  const staff = await getStaff();
  if (staff?.role !== "admin") return new Response("forbidden", { status: 403 });
  const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const orders = (await all("orders")).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const head = ["เลขออเดอร์", "วันที่สั่ง", "สถานะ", "ชื่อ", "เบอร์", "ที่อยู่", "แผ่น", "แถม", "ค่าส่ง", "ยอดรวม", "ขนส่ง", "เลขแทร็ค"];
    const lines = orders.map((o) =>
      [
        o.order_no,
        o.created_at,
        o.status,
        o.customer_name,
        o.customer_phone,
        formatAddress(o.address as Address),
        o.total_sheets,
        o.free_sheets,
        o.shipping_fee,
        o.total,
        o.carrier,
        o.tracking_no,
      ]
        .map(csvCell)
        .join(","),
    );
    // BOM ให้ Excel อ่านภาษาไทยถูก
    return new Response("﻿" + [head.join(","), ...lines].join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="yimwann-orders-${stamp}.csv"`,
      },
    });
  }

  const [orders, items, customers, settings] = await Promise.all([all("orders"), all("order_items"), all("customers"), all("settings")]);
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), orders, order_items: items, customers, settings }, null, 1), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="yimwann-backup-${stamp}.json"`,
    },
  });
}
