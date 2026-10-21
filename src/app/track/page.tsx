"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Spinner } from "@/components/ui";

export default function TrackPage() {
  const router = useRouter();
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
      router.push(`/o/${json.token}`);
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
      <h1 className="mt-3 text-2xl font-bold">เช็คสถานะออเดอร์</h1>
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
          {busy ? <Spinner /> : "ค้นหา"}
        </button>
      </form>
    </main>
  );
}
