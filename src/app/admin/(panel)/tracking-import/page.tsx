"use client";

import Papa from "papaparse";
import { useRef, useState, useTransition } from "react";
import { Alert, Spinner } from "@/components/ui";
import { CARRIERS, STATUS_LABEL, carrierInfo } from "@/lib/constants";
import type { OrderStatus } from "@/lib/types";
import { applyTracking, matchTracking, type TrackingMatch, type TrackingRow } from "../../actions";

type Cell = string | number | boolean | Date | null | unknown;

const REF_HEADERS = /เลขออเดอร์|ออเดอร์|order|เบอร์|โทร|phone|tel|อ้างอิง|ref/i;
const TRACK_HEADERS = /แทร็ค|แทรค|tracking|เลขพัสดุ|พัสดุ|track/i;
const CARRIER_HEADERS = /ขนส่ง|carrier|courier|บริษัท/i;

/** หาคอลัมน์จากหัวตาราง ถ้าไม่มีหัวตาราง ใช้คอลัมน์ 1 = อ้างอิง, 2 = เลขแทร็ค, 3 = ขนส่ง */
function toRows(table: Cell[][], defaultCarrier: string): TrackingRow[] {
  const rows = table.map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c).trim())));
  const header = rows[0] ?? [];
  let ref = header.findIndex((h) => REF_HEADERS.test(h));
  let track = header.findIndex((h) => TRACK_HEADERS.test(h));
  const carrier = header.findIndex((h) => CARRIER_HEADERS.test(h));
  const hasHeader = ref >= 0 || track >= 0;
  if (ref < 0) ref = 0;
  if (track < 0) track = ref === 0 ? 1 : 0;
  return rows
    .slice(hasHeader ? 1 : 0)
    .filter((r) => r.some(Boolean))
    .map((r) => ({
      // เบอร์โทรใน Excel มักหาย 0 ข้างหน้า
      ref: /^\d{9}$/.test(r[ref] ?? "") ? `0${r[ref]}` : (r[ref] ?? ""),
      trackingNo: r[track] ?? "",
      carrier: (carrier >= 0 && r[carrier]) || defaultCarrier,
    }));
}

export default function TrackingImportPage() {
  const input = useRef<HTMLInputElement>(null);
  const [carrier, setCarrier] = useState("flash");
  const [matches, setMatches] = useState<TrackingMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function readFile(file: File) {
    setError(null);
    setResult(null);
    setMatches(null);
    try {
      let table: Cell[][];
      if (/\.xlsx$/i.test(file.name)) {
        const { readSheet } = await import("read-excel-file/browser");
        table = (await readSheet(file)) as Cell[][];
      } else if (/\.(csv|txt)$/i.test(file.name)) {
        const text = await file.text();
        table = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: true }).data;
      } else {
        return setError("รองรับไฟล์ .csv และ .xlsx (ถ้าเป็น .xls ให้บันทึกเป็น .xlsx ก่อน)");
      }
      const rows = toRows(table, carrier);
      if (!rows.length) return setError("ไม่พบข้อมูลในไฟล์");
      start(async () => setMatches(await matchTracking(rows)));
    } catch (e) {
      setError("อ่านไฟล์ไม่สำเร็จ: " + (e as Error).message);
    }
  }

  const ready = matches?.filter((m) => m.orderId) ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">นำเข้าเลขแทร็คหลายออเดอร์</h1>
      <div className="card space-y-3 text-sm">
        <p>
          อัปโหลดไฟล์ CSV หรือ Excel (.xlsx) ที่มีคอลัมน์ <b>เลขออเดอร์ หรือ เบอร์โทร</b> และ <b>เลขแทร็ค</b> (มีคอลัมน์
          <b> ขนส่ง</b> ด้วยก็ได้) ระบบจะจับคู่ให้และแสดงตัวอย่างก่อนยืนยัน
        </p>
        <div className="overflow-x-auto rounded-xl bg-gray-50 p-3 font-mono text-xs">
          เลขออเดอร์,เลขแทร็ค,ขนส่ง
          <br />
          YW1001,TH0123456789A,Flash
          <br />
          0812345678,JT1234567890,J&amp;T
        </div>
        <label className="block">
          <span className="label">ขนส่งเริ่มต้น (ใช้เมื่อไฟล์ไม่มีคอลัมน์ขนส่ง)</span>
          <select className="input" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
            {CARRIERS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <input
          ref={input}
          type="file"
          accept=".csv,.xlsx,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) readFile(f);
            e.target.value = "";
          }}
        />
        <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => input.current?.click()} disabled={pending}>
          {pending ? <Spinner /> : "เลือกไฟล์ CSV / Excel"}
        </button>
        {error && <Alert tone="bad">{error}</Alert>}
        {result && <Alert tone="ok">{result}</Alert>}
      </div>

      {matches && (
        <div className="card space-y-3">
          <p className="font-semibold">
            ตัวอย่าง: จับคู่ได้ {ready.length} / {matches.length} แถว
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-1.5">อ้างอิงในไฟล์</th>
                  <th>ออเดอร์</th>
                  <th>เลขแทร็ค</th>
                  <th>ขนส่ง</th>
                  <th>ผล</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, i) => (
                  <tr key={i} className={`border-t border-line ${m.orderId ? "" : "bg-bad-bg/40"}`}>
                    <td className="py-1.5">{m.ref}</td>
                    <td>
                      {m.orderNo ? (
                        <>
                          <b>{m.orderNo}</b> {m.customerName}
                          <span className="block text-xs text-muted">{m.status && STATUS_LABEL[m.status as OrderStatus]}</span>
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="font-mono">{m.trackingNo}</td>
                    <td>{carrierInfo(m.carrier)?.label ?? m.carrier}</td>
                    <td className={m.orderId ? "text-ok" : "text-bad"}>
                      {m.problem ?? (m.status === "shipped" ? "✓ (แก้เลขเดิม)" : "✓ พร้อมบันทึก")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="btn-primary w-full sm:w-auto"
            disabled={!ready.length || pending}
            onClick={() =>
              start(async () => {
                const r = await applyTracking(ready.map((m) => ({ orderId: m.orderId!, carrier: m.carrier, trackingNo: m.trackingNo })));
                setMatches(null);
                setResult(
                  `บันทึกแล้ว ${r.ok} ออเดอร์ (แจ้ง LINE ${r.lineSent} ราย)${r.failed.length ? ` · ไม่สำเร็จ: ${r.failed.join(", ")}` : ""}`,
                );
              })
            }
          >
            {pending ? <Spinner /> : `ยืนยันบันทึก ${ready.length} ออเดอร์ → จัดส่งแล้ว`}
          </button>
        </div>
      )}
    </div>
  );
}
