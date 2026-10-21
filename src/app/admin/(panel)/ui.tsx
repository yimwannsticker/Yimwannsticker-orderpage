"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Alert, Spinner } from "@/components/ui";

/** รีเฟรชข้อมูลหลังบ้านเป็นระยะ เพื่อให้เห็นออเดอร์/สลิปใหม่ */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}

type Result = { ok: true; message?: string } | { ok: false; error: string };

/** ปุ่มเรียก server action พร้อมแสดงผล */
export function ActionButton({
  action,
  children,
  className = "btn-primary",
  confirm,
}: {
  action: () => Promise<Result>;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
}) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<Result | null>(null);
  return (
    <div>
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => setRes(await action()));
        }}
      >
        {pending ? <Spinner /> : children}
      </button>
      {res && !res.ok && (
        <div className="mt-2">
          <Alert tone="bad">{res.error}</Alert>
        </div>
      )}
      {res?.ok && res.message && <p className="mt-2 text-sm text-ok">{res.message}</p>}
    </div>
  );
}

export function ResultNote({ res }: { res: Result | null }) {
  if (!res) return null;
  if (!res.ok) return <Alert tone="bad">{res.error}</Alert>;
  return res.message ? <p className="text-sm text-ok">{res.message}</p> : null;
}
