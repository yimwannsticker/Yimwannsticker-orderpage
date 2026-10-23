import { baht } from "@/lib/format";
import { requireStaff } from "@/lib/server/auth";
import { currentMonth, getA5Report } from "@/lib/server/reports";

export const dynamic = "force-dynamic";

const n = (v: number) => v.toLocaleString("th-TH");

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireStaff("admin");
  const q = (await searchParams).month ?? "";
  const month = /^\d{4}-\d{2}$/.test(q) ? q : currentMonth();
  const r = await getA5Report(month);
  const monthLabel = new Date(`${month}-15T00:00:00+07:00`).toLocaleDateString("th-TH", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">รายงานยอดขาย สติกเกอร์สำเร็จรูป A5</h1>
          <p className="text-sm text-muted">นับเฉพาะออเดอร์ที่ชำระแล้ว (ไม่รวมรอตรวจสลิปและยกเลิก) ตามวันที่สั่ง ยอดขายไม่รวมค่าส่ง</p>
        </div>
        <form className="flex items-end gap-2" action="/admin/reports">
          <label className="block">
            <span className="label">เดือน</span>
            <input type="month" name="month" defaultValue={month} className="input" />
          </label>
          <button className="btn-secondary">ดู</button>
          <a href={`/api/admin/report?month=${month}`} className="btn-primary">
            ส่งออก Excel
          </a>
        </form>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          ["ออเดอร์", n(r.orders)],
          ["แผ่น A5", n(r.sheets)],
          ["ยอดขาย", baht(r.revenue)],
        ].map(([label, value]) => (
          <div key={label} className="card !p-3 text-center">
            <p className="text-xs text-muted">{label}</p>
            <p className="text-xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <Table
        title={`ต่อนักออกแบบ · ${monthLabel}`}
        head={["นักออกแบบ", "แผ่น", "ยอดขาย", "สินค้าที่ขายได้"]}
        rows={r.byDesigner.map((x) => [x.designer, n(x.sheets), baht(x.revenue), n(x.products)])}
      />
      <Table
        title="ต่อสินค้า"
        head={["สินค้า", "นักออกแบบ", "แผ่น", "ยอดขาย", "ออเดอร์"]}
        rows={r.byProduct.map((x) => [x.product, x.designer, n(x.sheets), baht(x.revenue), n(x.orders)])}
      />
      <Table
        title="ต่อลาย"
        head={["SKU", "สินค้า / ลาย", "นักออกแบบ", "แผ่น", "ยอดขาย"]}
        rows={r.byDesign.map((x) => [x.sku, `${x.product} · ${x.design}${x.size ? ` · ${x.size}` : ""}`, x.designer, n(x.sheets), baht(x.revenue)])}
      />
    </div>
  );
}

function Table({ title, head, rows }: { title: string; head: string[]; rows: string[][] }) {
  return (
    <section className="card !p-0">
      <h2 className="px-4 pb-2 pt-3 font-bold">{title}</h2>
      {!rows.length ? (
        <p className="px-4 pb-4 text-sm text-muted">ยังไม่มียอดขายในเดือนนี้</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-gray-50 text-left text-muted">
              <tr>
                {head.map((h, i) => (
                  <th key={h} className={`px-4 py-2 font-medium ${i > 0 && i >= head.length - 3 ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-t border-line">
                  {row.map((c, i) => (
                    <td key={i} className={`px-4 py-2 ${i > 0 && i >= head.length - 3 ? "text-right tabular-nums" : ""}`}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
