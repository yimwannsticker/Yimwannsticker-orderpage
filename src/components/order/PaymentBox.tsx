"use client";

import { useRef, useState } from "react";
import { uploadFile } from "@/lib/client/file-tools";
import { baht } from "@/lib/format";
import type { PublicSettings } from "@/lib/types";
import { CopyButton, Spinner } from "../ui";

export function PaymentInfo({ settings, amount }: { settings: PublicSettings; amount: number }) {
  const qrSrc = `/api/promptpay?amount=${amount.toFixed(2)}`;
  return (
    <div className="space-y-3">
      {settings.promptpayId && (
        <div className="rounded-2xl border border-line p-4 text-center">
          <p className="font-semibold">สแกนจ่ายด้วยพร้อมเพย์</p>
          <p className="text-sm text-muted">ยอดเงินใส่ให้อัตโนมัติ {baht(amount)}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrSrc} alt={`QR พร้อมเพย์ ${baht(amount)}`} className="mx-auto my-3 h-56 w-56" />
          {settings.promptpayName && <p className="text-sm">ชื่อบัญชี: {settings.promptpayName}</p>}
          <a href={qrSrc} download={`promptpay-${amount}.png`} className="btn-secondary btn-sm mt-2">
            บันทึกรูป QR
          </a>
        </div>
      )}
      {settings.bankAccountNo && (
        <div className="rounded-2xl border border-line p-4">
          <p className="font-semibold">หรือโอนเข้าบัญชีธนาคาร</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="text-sm">
              <p>{settings.bankName}</p>
              <p className="text-lg font-bold tracking-wide">{settings.bankAccountNo}</p>
              <p className="text-muted">{settings.bankAccountName}</p>
            </div>
            <CopyButton text={settings.bankAccountNo.replace(/\D/g, "")} label="คัดลอกเลขบัญชี" />
          </div>
        </div>
      )}
      {!settings.promptpayId && !settings.bankAccountNo && (
        <p className="text-sm text-bad">ร้านยังไม่ได้ตั้งค่าช่องทางชำระเงิน กรุณาติดต่อร้าน</p>
      )}
    </div>
  );
}

export function SlipUploader({
  value,
  onChange,
}: {
  value: { uploadId: string; previewUrl: string } | null;
  onChange: (v: { uploadId: string; previewUrl: string } | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(file: File) {
    setErr(null);
    if (!/^image\//.test(file.type)) {
      setErr("กรุณาเลือกรูปภาพสลิป");
      return;
    }
    setBusy(true);
    try {
      const uploadId = await uploadFile(file, file.name || "slip.jpg", "slip");
      onChange({ uploadId, previewUrl: URL.createObjectURL(file) });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = "";
        }}
      />
      {value ? (
        <div className="flex items-center gap-3 rounded-2xl border border-ok/30 bg-ok-bg p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.previewUrl} alt="สลิป" className="h-20 w-16 rounded-lg object-cover" />
          <div className="flex-1">
            <p className="font-semibold text-ok">แนบสลิปแล้ว ✓</p>
            <button type="button" className="text-sm text-muted underline" onClick={() => input.current?.click()}>
              เปลี่ยนรูป
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-secondary w-full border-dashed" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? (
            <>
              <Spinner /> กำลังอัปโหลด...
            </>
          ) : (
            "แนบสลิปการโอนเงิน"
          )}
        </button>
      )}
      {err && <p className="mt-2 text-sm text-bad">{err}</p>}
    </div>
  );
}
