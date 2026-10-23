"use client";

import { Fragment, useLayoutEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui";

export interface SlipData {
  id: string;
  orderNo: string;
  date: string;
  /** QR code (SVG) ลิงก์หน้าออเดอร์ในหลังบ้าน */
  qr: string;
  name: string;
  phone: string;
  address: string;
  note: string | null;
  groups: { product: string; rows: { sku: string; label: string; qty: number; unit: string | null }[] }[];
  a3: { label: string; detail: string; qty: number; free: number }[];
  a5Sheets: number;
  /** การ์ด (ราคาคงที่) รวมกี่ใบ */
  fixedUnits: number;
  a3Sheets: number;
  freeSheets: number;
}

/** ขนาดใบ (มม.) และขอบ */
const W = 100;
const H = 150;
const PAD = 4;
/** ขนาดตัวอักษรที่ลอง (pt) ใหญ่สุดที่ใส่ได้ในใบเดียว ถ้าไม่พอใช้ 8pt แล้วขึ้นใบใหม่ (ไม่เล็กกว่า 7pt) */
const FONT_SIZES = [10, 9, 8, 7];
const MULTI_PAGE_FONT = 8;
const MM = 96 / 25.4;

type Row =
  | { kind: "group"; text: string }
  | { kind: "a5"; sku: string; label: string; qty: number; unit: string | null }
  | { kind: "a3"; label: string; detail: string; qty: number; free: number };

function rowsOf(s: SlipData): Row[] {
  const out: Row[] = [];
  for (const g of s.groups) {
    out.push({ kind: "group", text: g.product });
    for (const r of g.rows) out.push({ kind: "a5", ...r });
  }
  if (s.a3.length) out.push({ kind: "group", text: "งานพิมพ์ไฟล์" });
  for (const a of s.a3) out.push({ kind: "a3", ...a });
  return out;
}

// ---------- ชิ้นส่วนของใบ (ใช้ทั้งตอนวัดขนาดและตอนแสดงจริง ให้สูงเท่ากัน) ----------

function HeaderFull({ s, shopName, page, f }: { s: SlipData; shopName: string; page: string; f: number }) {
  return (
    <div className="flex items-start gap-2 border-b-2 border-black pb-1.5">
      <div className="min-w-0 flex-1">
        <p style={{ fontSize: `${f}pt` }} className="font-semibold leading-tight">
          {shopName}
        </p>
        <p style={{ fontSize: `${f + 8}pt` }} className="font-bold leading-tight tracking-wide">
          {s.orderNo}
        </p>
        <p style={{ fontSize: `${f - 1}pt` }} className="leading-tight">
          {s.date} · {page}
        </p>
      </div>
      <div className="h-[20mm] w-[20mm] shrink-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: s.qr }} />
    </div>
  );
}

function HeaderCont({ s, page, f }: { s: SlipData; page: string; f: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b-2 border-black pb-1" style={{ fontSize: `${f}pt` }}>
      <span style={{ fontSize: `${f + 4}pt` }} className="font-bold">
        {s.orderNo} <span className="font-normal">(ต่อ)</span>
      </span>
      <span className="truncate">{s.name}</span>
      <span className="shrink-0 font-semibold">{page}</span>
    </div>
  );
}

function Recipient({ s, f }: { s: SlipData; f: number }) {
  return (
    <div className="border-b border-black py-1.5">
      <p style={{ fontSize: `${f - 1}pt` }} className="leading-tight">
        ผู้รับ
      </p>
      <p style={{ fontSize: `${f + 3}pt` }} className="font-bold leading-snug">
        {s.name} · {s.phone}
      </p>
      <p style={{ fontSize: `${f + 1}pt` }} className="leading-snug">
        {s.address}
      </p>
      {s.note && (
        <p style={{ fontSize: `${f}pt` }} className="mt-0.5 leading-snug">
          หมายเหตุ: {s.note}
        </p>
      )}
    </div>
  );
}

function TableHead({ f }: { f: number }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] gap-x-2 border-b border-black py-0.5 font-semibold" style={{ fontSize: `${f - 1}pt` }}>
      <span className="w-[16mm]">SKU</span>
      <span>รายการ</span>
      <span className="text-right">จำนวน</span>
    </div>
  );
}

function RowView({ r, f }: { r: Row; f: number }) {
  if (r.kind === "group")
    return (
      <div className="pt-1 font-bold leading-snug" style={{ fontSize: `${f}pt` }}>
        {r.text}
      </div>
    );
  if (r.kind === "a5")
    return (
      <div className="grid grid-cols-[auto_1fr_auto] items-baseline gap-x-2 border-b border-dotted border-gray-400 py-0.5 leading-snug" style={{ fontSize: `${f}pt` }}>
        <span className="w-[16mm] font-mono font-semibold">{r.sku}</span>
        <span>{r.label}</span>
        <span className="text-right font-bold" style={{ fontSize: `${f + 2}pt` }}>
          ×{r.qty}
          {r.unit && <span style={{ fontSize: `${f}pt` }}> {r.unit}</span>}
        </span>
      </div>
    );
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-2 border-b border-dotted border-gray-400 py-0.5 leading-snug" style={{ fontSize: `${f}pt` }}>
      <span>
        {r.label}
        <span className="block" style={{ fontSize: `${f - 1}pt` }}>
          {r.detail}
        </span>
      </span>
      <span className="text-right font-bold" style={{ fontSize: `${f + 2}pt` }}>
        ×{r.qty}
        {r.free > 0 && <span className="block text-right font-semibold" style={{ fontSize: `${f - 1}pt` }}>+แถม {r.free}</span>}
      </span>
    </div>
  );
}

function Footer({ s, sheetName, f }: { s: SlipData; sheetName: string; f: number }) {
  const parts = [s.a5Sheets ? `A5 ${s.a5Sheets} แผ่น` : null, s.fixedUnits ? `การ์ด ${s.fixedUnits} ใบ` : null, s.a3Sheets ? `${sheetName} ${s.a3Sheets} แผ่น` : null, s.freeSheets ? `แถม ${s.freeSheets} แผ่น` : null];
  return (
    <div className="mt-1 border-t-2 border-black pt-1 font-bold" style={{ fontSize: `${f + 1}pt` }}>
      รวม {parts.filter(Boolean).join(" · ") || "-"}
    </div>
  );
}

// ---------- วัดขนาด + แบ่งหน้า ----------

interface Measure {
  headerFull: number;
  headerCont: number;
  recipient: number;
  tableHead: number;
  footer: number;
  rows: number[];
}

type Page = { first: boolean; rows: number[]; last: boolean };

function paginate(m: Measure, count: number): Page[] {
  const avail = (H - PAD * 2) * MM;
  const pages: Page[] = [];
  let cur: Page = { first: true, rows: [], last: false };
  let used = m.headerFull + m.recipient + m.tableHead;
  for (let i = 0; i < count; i++) {
    if (used + m.rows[i] > avail && cur.rows.length) {
      pages.push(cur);
      cur = { first: false, rows: [], last: false };
      used = m.headerCont + m.tableHead;
    }
    cur.rows.push(i);
    used += m.rows[i];
  }
  if (used + m.footer > avail) {
    pages.push(cur);
    cur = { first: false, rows: [], last: false };
  }
  cur.last = true;
  pages.push(cur);
  return pages;
}

function MeasureBox({ s, shopName, sheetName, f, onDone }: { s: SlipData; shopName: string; sheetName: string; f: number; onDone: (m: Measure) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const rows = rowsOf(s);
  useLayoutEffect(() => {
    const el = ref.current!;
    const h = (k: string) => (el.querySelector(`[data-k="${k}"]`) as HTMLElement).getBoundingClientRect().height;
    onDone({
      headerFull: h("hf"),
      headerCont: h("hc"),
      recipient: h("rc"),
      tableHead: h("th"),
      footer: h("ft"),
      rows: rows.map((_, i) => h(`r${i}`)),
    });
    // วัดครั้งเดียวต่อขนาดตัวอักษร
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute left-[-9999px] top-0 bg-white" style={{ width: `${W - PAD * 2}mm` }}>
      <div data-k="hf">
        <HeaderFull s={s} shopName={shopName} page="ใบที่ 1/1" f={f} />
      </div>
      <div data-k="hc">
        <HeaderCont s={s} page="ใบที่ 1/1" f={f} />
      </div>
      <div data-k="rc">
        <Recipient s={s} f={f} />
      </div>
      <div data-k="th">
        <TableHead f={f} />
      </div>
      {rows.map((r, i) => (
        <div key={i} data-k={`r${i}`}>
          <RowView r={r} f={f} />
        </div>
      ))}
      <div data-k="ft">
        <Footer s={s} sheetName={sheetName} f={f} />
      </div>
    </div>
  );
}

function SlipPages({ s, shopName, sheetName }: { s: SlipData; shopName: string; sheetName: string }) {
  const [meas, setMeas] = useState<Record<number, Measure>>({});
  const rows = rowsOf(s);
  const ready = FONT_SIZES.every((f) => meas[f]);
  if (!ready)
    return (
      <>
        {FONT_SIZES.map((f) => (
          <MeasureBox key={f} s={s} shopName={shopName} sheetName={sheetName} f={f} onDone={(m) => setMeas((x) => ({ ...x, [f]: m }))} />
        ))}
      </>
    );
  const f = FONT_SIZES.find((x) => paginate(meas[x], rows.length).length === 1) ?? MULTI_PAGE_FONT;
  const pages = paginate(meas[f], rows.length);
  return (
    <>
      {pages.map((p, i) => {
        const label = `ใบที่ ${i + 1}/${pages.length}`;
        return (
          <div key={i} className="slip-page relative overflow-hidden bg-white text-black shadow-md" style={{ width: `${W}mm`, height: `${H}mm`, padding: `${PAD}mm` }}>
            {p.first ? <HeaderFull s={s} shopName={shopName} page={label} f={f} /> : <HeaderCont s={s} page={label} f={f} />}
            {p.first && <Recipient s={s} f={f} />}
            {p.rows.length > 0 && <TableHead f={f} />}
            {p.rows.map((ri) => (
              <RowView key={ri} r={rows[ri]} f={f} />
            ))}
            {p.last && <Footer s={s} sheetName={sheetName} f={f} />}
          </div>
        );
      })}
    </>
  );
}

export function Slips({ slips, shopName, sheetName }: { slips: SlipData[]; shopName: string; sheetName: string }) {
  const [busy, setBusy] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  async function downloadPdf() {
    setBusy(true);
    try {
      const [{ jsPDF }, { toJpeg }] = await Promise.all([import("jspdf"), import("html-to-image")]);
      const pages = [...wrap.current!.querySelectorAll<HTMLElement>(".slip-page")];
      const pdf = new jsPDF({ unit: "mm", format: [W, H], orientation: "portrait" });
      for (const [i, el] of pages.entries()) {
        // 3 เท่า ≈ 290 DPI พอสำหรับเครื่องพิมพ์ความร้อน 203/300 DPI
        // JPEG ไฟล์เล็กกว่า PNG หลายเท่า (ตัวหนังสือขาวดำยังคมชัด)
        const img = await toJpeg(el, { pixelRatio: 3, backgroundColor: "#ffffff", quality: 0.9 });
        if (i) pdf.addPage([W, H], "portrait");
        pdf.addImage(img, "JPEG", 0, 0, W, H);
      }
      // ชื่อไฟล์ภาษาอังกฤษ (บางเครื่องตัดชื่อไทยทิ้ง)
      const name = slips.length === 1 ? slips[0].orderNo : `packing-${new Date().toISOString().slice(0, 10)}-${slips.length}-orders`;
      pdf.save(`${name}.pdf`);
    } catch (e) {
      alert(`สร้าง PDF ไม่สำเร็จ: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-200 print:bg-white">
      <style>{`@page { size: ${W}mm ${H}mm; margin: 0 } @media print { .slip-page { break-after: page; box-shadow: none !important; margin: 0 !important } }`}</style>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 bg-white px-4 py-3 shadow print:hidden">
        <p className="font-bold">ใบรายการสินค้า {slips.length} ออเดอร์</p>
        <span className="text-sm text-muted">ขนาด {W}×{H} มม.</span>
        <div className="flex-1" />
        <button type="button" className="btn-secondary btn-sm" onClick={() => window.print()}>
          🖨️ พิมพ์
        </button>
        <button type="button" className="btn-primary btn-sm" onClick={downloadPdf} disabled={busy}>
          {busy ? <Spinner /> : "ดาวน์โหลด PDF"}
        </button>
      </div>
      <div ref={wrap} className="flex flex-col items-center gap-4 py-4 print:block print:p-0">
        {slips.map((s) => (
          <Fragment key={s.id}>
            <SlipPages s={s} shopName={shopName} sheetName={sheetName} />
          </Fragment>
        ))}
      </div>
    </div>
  );
}
