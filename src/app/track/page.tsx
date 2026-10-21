"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Alert, Spinner } from "@/components/ui";

export default function TrackPage() {
  return (
    <Suspense>
      <TrackForm />
    </Suspense>
  );
}

function TrackForm() {
  const router = useRouter();
  const reorder = useSearchParams().get("reorder") === "1";
  const [orderNo, setOrderNo] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNo, phone }),
      });
      const json = await res.json();
      if (!res.ok) return setError(json.error);
      router.push(reorder ? `/?reorder=${encodeURIComponent(json.token)}` : `/o/${json.token}`);
    } catch {
      setError("อินเทอร์เน็ตขัดข้อง กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <Link href="/" className="text-sm text-brand-600">
        ← กลับไปหน้าสั่งพิมพ์
      </Link>
      <h1 className="mt-3 text-2xl font-bold">{reorder ? "สั่งซ้ำจากออเดอร์เก่า" : "เช็คสถานะออเดอร์"}</h1>
      {reorder && (
        <p className="mt-1 text-sm text-muted">กรอกเลขออเดอร์เก่าและเบอร์โทร ระบบจะดึงไฟล์ ประเภท จำนวน และที่อยู่เดิมมาให้ แก้ไขได้ก่อนสั่ง</p>
      )}
      <form onSubmit={submit} className="card mt-4 space-y-4">
        <div>
          <label className="label" htmlFor="no">
            เลขออเดอร์
          </label>
          <input id="no" className="input uppercase" placeholder="เช่น YW1001" value={orderNo} onChange={(e) => setOrderNo(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="tel">
            เบอร์โทรที่ใช้สั่ง
          </label>
          <input id="tel" className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        {error && <Alert tone="bad">{error}</Alert>}
        <button className="btn-primary w-full" disabled={busy || !orderNo || !phone}>
          {busy ? <Spinner /> : reorder ? "ดึงรายการเดิม" : "ค้นหา"}
        </button>
      </form>
    </main>
  );
}
