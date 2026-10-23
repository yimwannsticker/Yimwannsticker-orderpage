import writeXlsxFile, { type SheetData } from "write-excel-file/node";
import { getStaff } from "@/lib/server/auth";
import { bad } from "@/lib/server/http";
import { currentMonth, getA5Report } from "@/lib/server/reports";

const head = (labels: string[]) => labels.map((value) => ({ value, fontWeight: "bold" as const }));

/** ส่งออกรายงานยอดขาย A5 รายเดือนเป็น Excel (3 ชีต: สินค้า / ลาย / กราฟิก) */
export async function GET(req: Request) {
  const staff = await getStaff();
  if (staff?.role !== "admin") return bad("ไม่มีสิทธิ์", 403);
  const q = new URL(req.url).searchParams.get("month") ?? "";
  const month = /^\d{4}-\d{2}$/.test(q) ? q : currentMonth();
  const r = await getA5Report(month);

  const products: SheetData = [
    head(["สินค้า", "กราฟิก", "จำนวน (แผ่น/แพ็ค)", "ยอดขาย (บาท)", "จำนวนออเดอร์"]),
    ...r.byProduct.map((x) => [x.product, x.designer, x.sheets, x.revenue, x.orders]),
  ];
  const designs: SheetData = [
    head(["SKU", "สินค้า", "ลาย", "ขนาด", "กราฟิก", "จำนวน (แผ่น/แพ็ค)", "ยอดขาย (บาท)"]),
    ...r.byDesign.map((x) => [x.sku, x.product, x.design, x.size, x.designer, x.sheets, x.revenue]),
  ];
  const designers: SheetData = [
    head(["กราฟิก", "จำนวน (แผ่น/แพ็ค)", "ยอดขาย (บาท)", "จำนวนสินค้าที่ขายได้"]),
    ...r.byDesigner.map((x) => [x.designer, x.sheets, x.revenue, x.products]),
  ];
  const buf = await writeXlsxFile([
    { data: products, sheet: "ต่อสินค้า", columns: [{ width: 40 }, { width: 20 }, { width: 12 }, { width: 14 }, { width: 14 }], stickyRowsCount: 1 },
    { data: designs, sheet: "ต่อลาย", columns: [{ width: 12 }, { width: 36 }, { width: 28 }, { width: 14 }, { width: 20 }, { width: 12 }, { width: 14 }], stickyRowsCount: 1 },
    { data: designers, sheet: "ต่อกราฟิก", columns: [{ width: 24 }, { width: 12 }, { width: 14 }, { width: 20 }], stickyRowsCount: 1 },
  ]).toBuffer();
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`ยอดขาย-A5-${month}.xlsx`)}`,
    },
  });
}
