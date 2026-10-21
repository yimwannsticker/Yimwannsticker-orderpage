"use client";

import { useEffect, useState, useTransition } from "react";
import { Spinner } from "@/components/ui";
import { CARRIERS, STATUS_LABEL } from "@/lib/constants";
import type { OrderStatus } from "@/lib/types";
import {
  cancelReupload,
  confirmPayment,
  fileDownloadUrl,
  markSeen,
  rejectSlip,
  requestReupload,
  saveAdminNote,
  saveTracking,
  setStatus,
} from "../../../actions";
import { ActionButton, ResultNote } from "../../ui";

type Result = { ok: true; message?: string } | { ok: false; error: string };

export function MarkSeen({ orderId }: { orderId: string }) {
  useEffect(() => {
    const t = setTimeout(() => markSeen(orderId), 1500);
    return () => clearTimeout(t);
  }, [orderId]);
  return null;
}

export function DownloadButton({ path, label }: { path: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn-secondary btn-sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const url = await fileDownloadUrl(path);
          if (url) window.location.href = url;
          else alert("ไม่พบไฟล์ หรือไม่มีสิทธิ์");
        })
      }
    >
      {pending ? <Spinner className="h-4 w-4" /> : `⬇ ${label}`}
    </button>
  );
}

export function ItemActions({ itemId, requested, reason }: { itemId: string; requested: boolean; reason: string | null }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(reason ?? "");
  const [res, setRes] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  if (requested)
    return (
      <ActionButton className="btn-ghost btn-sm" action={() => cancelReupload(itemId)}>
        ยกเลิกคำขอไฟล์ใหม่
      </ActionButton>
    );
  return (
    <div className="w-full sm:w-auto">
      {!open ? (
        <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(true)}>
          ขอไฟล์ใหม่
        </button>
      ) : (
        <div className="space-y-2 rounded-xl bg-warn-bg/50 p-2">
          <textarea
            className="input min-h-20 py-2 text-sm"
            placeholder="เหตุผล เช่น รูปความละเอียดต่ำ / ฟอนต์ยังไม่ได้ create outline"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={pending}
              onClick={() => start(async () => setRes(await requestReupload(itemId, text)))}
            >
              {pending ? <Spinner className="h-4 w-4" /> : "ส่งคำขอ"}
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>
              ยกเลิก
            </button>
          </div>
          <ResultNote res={res} />
        </div>
      )}
    </div>
  );
}

export function PaymentActions({ orderId }: { orderId: string }) {
  const [reject, setReject] = useState(false);
  const [reason, setReason] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2 border-t border-line pt-3">
      <div className="flex flex-wrap gap-2">
        <ActionButton action={() => confirmPayment(orderId)} confirm="ยืนยันว่าได้รับเงินถูกต้องแล้ว?">
          ✓ ยืนยันชำระเงิน
        </ActionButton>
        <button type="button" className="btn-secondary" onClick={() => setReject(!reject)}>
          สลิปไม่ถูกต้อง
        </button>
      </div>
      {reject && (
        <div className="space-y-2">
          <input
            className="input"
            placeholder="แจ้งลูกค้า เช่น ยอดโอนไม่ครบ / สลิปไม่ชัด"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            type="button"
            className="btn-secondary btn-sm"
            disabled={pending}
            onClick={() => start(async () => setRes(await rejectSlip(orderId, reason)))}
          >
            {pending ? <Spinner className="h-4 w-4" /> : "แจ้งลูกค้าส่งสลิปใหม่"}
          </button>
          <ResultNote res={res} />
        </div>
      )}
    </div>
  );
}

export function TrackingForm({ orderId, carrier, trackingNo }: { orderId: string; carrier: string | null; trackingNo: string | null }) {
  const [c, setC] = useState(carrier ?? "flash");
  const [t, setT] = useState(trackingNo ?? "");
  const [res, setRes] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => setRes(await saveTracking(orderId, c, t)));
      }}
    >
      <select className="input" value={c} onChange={(e) => setC(e.target.value)} aria-label="ขนส่ง">
        {CARRIERS.map((x) => (
          <option key={x.key} value={x.key}>
            {x.label}
          </option>
        ))}
      </select>
      <input className="input font-mono uppercase" placeholder="เลขแทร็ค" value={t} onChange={(e) => setT(e.target.value)} aria-label="เลขแทร็ค" />
      <button className="btn-primary w-full" disabled={pending || !t.trim()}>
        {pending ? <Spinner /> : trackingNo ? "แก้ไขเลขแทร็ค" : "บันทึก → จัดส่งแล้ว"}
      </button>
      <ResultNote res={res} />
    </form>
  );
}

export function StatusActions({ orderId, status, isAdmin }: { orderId: string; status: OrderStatus; isAdmin: boolean }) {
  const [res, setRes] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const run = (s: OrderStatus) => start(async () => setRes(await setStatus(orderId, s)));
  return (
    <div className="space-y-2">
      {status === "paid" && (
        <button type="button" className="btn-primary w-full" disabled={pending} onClick={() => run("producing")}>
          {pending ? <Spinner /> : "เริ่มผลิต"}
        </button>
      )}
      {status === "producing" && !isAdmin && (
        <button type="button" className="btn-secondary w-full" disabled={pending} onClick={() => run("paid")}>
          ย้อนกลับเป็น “ชำระแล้ว”
        </button>
      )}
      {isAdmin && (
        <label className="block text-sm">
          <span className="label">เปลี่ยนสถานะเอง</span>
          <select
            className="input"
            value={status}
            disabled={pending}
            onChange={(e) => {
              const s = e.target.value as OrderStatus;
              if (s === "cancelled" && !window.confirm("ยกเลิกออเดอร์นี้?")) return;
              run(s);
            }}
          >
            {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      )}
      <ResultNote res={res} />
    </div>
  );
}

export function AdminNote({ orderId, note }: { orderId: string; note: string }) {
  const [text, setText] = useState(note);
  const [res, setRes] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <textarea className="input min-h-20 py-2 text-sm" value={text} onChange={(e) => setText(e.target.value)} />
      <button
        type="button"
        className="btn-secondary btn-sm"
        disabled={pending || text === note}
        onClick={() => start(async () => setRes(await saveAdminNote(orderId, text)))}
      >
        บันทึกโน้ต
      </button>
      <ResultNote res={res} />
    </div>
  );
}
