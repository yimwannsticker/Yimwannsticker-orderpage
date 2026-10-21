"use client";

import { useState, useTransition } from "react";
import { Spinner } from "@/components/ui";
import { adjustPoints } from "../../actions";
import { ResultNote } from "../ui";

type Result = { ok: true; message?: string } | { ok: false; error: string };

export function PointsForm({ phone, adjustment, note }: { phone: string; adjustment: number; note: string }) {
  const [value, setValue] = useState(String(adjustment));
  const [text, setText] = useState(note);
  const [res, setRes] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-2 border-t border-line pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => setRes(await adjustPoints(phone, Number(value), text)));
      }}
    >
      <p className="text-sm text-muted">ปรับยอดสะสม (+/-) เช่น ยอดเก่าจากก่อนใช้ระบบ ใส่ 120 หรือหักออก -20</p>
      <div className="flex gap-2">
        <input className="input w-32" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d-]/g, ""))} />
        <input className="input" placeholder="หมายเหตุ" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <button className="btn-secondary btn-sm" disabled={pending}>
        {pending ? <Spinner className="h-4 w-4" /> : "บันทึกยอดปรับ"}
      </button>
      <ResultNote res={res} />
    </form>
  );
}
