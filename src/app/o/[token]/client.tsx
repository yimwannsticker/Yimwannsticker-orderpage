"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PaymentInfo, SlipUploader } from "@/components/order/PaymentBox";
import { validateFile } from "@/components/order/useArtworkUploader";
import { Alert, CheckBadge, CheckDetails, Spinner } from "@/components/ui";
import { processArtwork } from "@/lib/client/file-tools";
import { ACCEPT_ATTR } from "@/lib/constants";
import { applySize, type StickerSize } from "@/lib/sticker-size";
import type { CheckResult, PublicSettings } from "@/lib/types";

export function ReuploadButton({
  token,
  itemId,
  settings,
  size,
}: {
  token: string;
  itemId: string;
  settings: PublicSettings;
  size: StickerSize | null;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ phase: string; progress?: number } | null>(null);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File) {
    setError(null);
    setCheck(null);
    const err = validateFile(file, settings);
    if (err) return setError(err);
    setState({ phase: "uploading", progress: 0 });
    try {
      const r = await processArtwork(file, (u) =>
        setState((s) => ({ phase: u.phase ?? s?.phase ?? "uploading", progress: u.progress ?? s?.progress })),
      );
      // แสดงผลตรวจตามขนาดดวงของรายการนี้
      setCheck(applySize(r.check, size, settings));
      const res = await fetch(`/api/orders/${token}/reupload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, uploadId: r.uploadId, previewUploadId: r.previewUploadId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setState({ phase: "done" });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setState(null);
    }
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pick(f);
          e.target.value = "";
        }}
      />
      {state && state.phase !== "done" ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner className="h-4 w-4" />
          {state.phase === "checking" ? "กำลังตรวจไฟล์..." : `กำลังอัปโหลด ${state.progress ?? 0}%`}
        </p>
      ) : (
        <button type="button" className="btn-primary w-full" onClick={() => input.current?.click()}>
          อัปโหลดไฟล์ใหม่
        </button>
      )}
      {check && (
        <div className="mt-2">
          <CheckBadge level={check.level} title={check.title} />
          <CheckDetails check={check} />
        </div>
      )}
      {state?.phase === "done" && <p className="mt-2 text-sm text-ok">ส่งไฟล์ใหม่ให้ร้านแล้ว ✓</p>}
      {error && (
        <div className="mt-2">
          <Alert tone="bad">{error}</Alert>
        </div>
      )}
    </div>
  );
}

export function SlipReupload({ token, settings, amount }: { token: string; settings: PublicSettings; amount: number }) {
  const router = useRouter();
  const [slip, setSlip] = useState<{ uploadId: string; previewUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <PaymentInfo settings={settings} amount={amount} />
      <SlipUploader value={slip} onChange={setSlip} />
      {error && <Alert tone="bad">{error}</Alert>}
      <button
        type="button"
        className="btn-primary w-full"
        disabled={!slip || busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await fetch(`/api/orders/${token}/slip`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uploadId: slip!.uploadId }),
          });
          const json = await res.json();
          setBusy(false);
          if (!res.ok) return setError(json.error);
          router.refresh();
        }}
      >
        {busy ? <Spinner /> : "ส่งสลิปใหม่"}
      </button>
    </div>
  );
}
