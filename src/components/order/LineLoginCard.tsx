"use client";

import { useEffect, useState } from "react";

export function LineLoginCard() {
  const [state, setState] = useState<{ enabled: boolean; user: { name: string; picture?: string } | null } | null>(null);

  useEffect(() => {
    fetch("/api/line/me")
      .then((r) => r.json())
      .then(setState)
      .catch(() => setState(null));
  }, []);

  if (!state?.enabled) return null;
  if (state.user) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-[#06C755]/10 p-3">
        {state.user.picture && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state.user.picture} alt="" className="h-10 w-10 rounded-full" />
        )}
        <div className="flex-1 text-sm">
          <p className="font-semibold">เชื่อม LINE แล้ว: {state.user.name}</p>
          <p className="text-muted">จะแจ้งเลขพัสดุทาง LINE เมื่อส่งของ</p>
        </div>
        <button
          type="button"
          className="text-sm text-muted underline"
          onClick={async () => {
            await fetch("/api/line/logout", { method: "POST" });
            setState({ ...state, user: null });
          }}
        >
          ยกเลิก
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-line p-4">
      <p className="font-semibold">รับเลขพัสดุทาง LINE (ไม่บังคับ)</p>
      <p className="mt-1 text-sm text-muted">เข้าสู่ระบบด้วย LINE แล้วร้านจะส่งเลขพัสดุให้อัตโนมัติเมื่อจัดส่ง ถ้าไม่เข้าสู่ระบบ ดูเลขพัสดุได้ที่หน้าเช็คสถานะ</p>
      <a href="/api/line/login?back=%2F%3Fstep%3Daddress" className="btn mt-3 w-full bg-[#06C755] text-white hover:bg-[#05b34c]">
        เข้าสู่ระบบด้วย LINE
      </a>
    </div>
  );
}
