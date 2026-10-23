"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/constants";
import { baht, thaiDate } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";
import { Alert, Spinner } from "../ui";

interface MyOrder {
  token: string;
  orderNo: string;
  status: OrderStatus;
  total: number;
  a3Sheets: number;
  freeSheets: number;
  a5Sheets: number;
  files: number;
  createdAt: string;
  trackingNo: string | null;
}

type Data = { name: string; phone: string; orders: MyOrder[] };

async function load(body: object): Promise<{ data?: Data; error?: string; status: number }> {
  const res = await fetch("/api/my-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  return res.ok ? { data: json, status: res.status } : { error: json.error, status: res.status };
}

/** ออเดอร์ของฉัน: เครื่องที่จำไว้แสดงเลย ไม่งั้นยืนยันชื่อผู้รับ + เบอร์โทร */
export function MyOrders() {
  const [data, setData] = useState<Data | null>(null);
  const [checking, setChecking] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    load({})
      .then((r) => alive && r.data && setData(r.data))
      .finally(() => alive && setChecking(false));
    return () => {
      alive = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await load({ name, phone });
      if (r.data) setData(r.data);
      else setError(r.error ?? "ไม่พบข้อมูล");
    } catch {
      setError("อินเทอร์เน็ตขัดข้อง กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 px-4 pt-3">
      <h1 className="text-xl font-bold">ออเดอร์ของฉัน</h1>
      {checking ? (
        <div className="flex justify-center py-10 text-brand-500">
          <Spinner className="h-7 w-7" />
        </div>
      ) : !data ? (
        <form onSubmit={submit} className="card space-y-3">
          <p className="text-sm text-muted">กรอกชื่อผู้รับและเบอร์โทรที่ใช้ตอนสั่ง เพื่อดูออเดอร์ทั้งหมด (ครั้งต่อไปเครื่องนี้จะจำไว้)</p>
          <label className="block">
            <span className="label">ชื่อผู้รับ</span>
            <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">เบอร์โทร</span>
            <input className="input" inputMode="tel" autoComplete="tel" placeholder="0812345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          {error && <Alert tone="bad">{error}</Alert>}
          <button className="btn-primary w-full" disabled={busy || !name.trim() || !phone.trim()}>
            {busy ? <Spinner /> : "ดูออเดอร์"}
          </button>
          <p className="text-center text-xs text-muted">
            มีเลขออเดอร์? <Link href="/track" className="text-brand-600 underline">เช็คสถานะด้วยเลขออเดอร์</Link>
          </p>
        </form>
      ) : (
        <>
          <p className="text-sm text-muted">
            คุณ{data.name} · {data.phone.slice(0, 3)}-xxx-{data.phone.slice(6)}
          </p>
          {!data.orders.length && <p className="card text-center text-sm text-muted">ยังไม่มีออเดอร์</p>}
          <div className="space-y-2">
            {data.orders.map((o) => (
              <Link key={o.token} href={`/o/${o.token}`} className="card block !p-4 active:scale-[0.99]">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold">{o.orderNo}</p>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {[
                    o.a5Sheets ? `A5 ${o.a5Sheets} แผ่น` : null,
                    o.files ? `A3+ ${o.files} ไฟล์ ${o.a3Sheets} แผ่น${o.freeSheets ? ` +แถม ${o.freeSheets}` : ""}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-xs text-muted">{thaiDate(o.createdAt)}</span>
                  <span className="font-semibold">{baht(o.total)}</span>
                </div>
                {o.trackingNo && <p className="mt-1 text-xs text-ok">เลขพัสดุ {o.trackingNo}</p>}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
