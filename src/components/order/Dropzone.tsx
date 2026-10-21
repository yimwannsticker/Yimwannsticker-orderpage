"use client";

import { useRef, useState } from "react";
import { ACCEPT_ATTR } from "@/lib/constants";

export function Dropzone({
  onFiles,
  maxMb,
  compact = false,
}: {
  onFiles: (files: FileList) => void;
  maxMb: number;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const picker = (
    <input
      ref={input}
      type="file"
      multiple
      accept={ACCEPT_ATTR}
      className="hidden"
      onChange={(e) => {
        if (e.target.files?.length) onFiles(e.target.files);
        e.target.value = "";
      }}
    />
  );

  if (compact) {
    return (
      <>
        {picker}
        <button type="button" className="btn-secondary w-full border-dashed border-brand-200 text-brand-600" onClick={() => input.current?.click()}>
          + เพิ่มไฟล์
        </button>
      </>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-10 text-center transition ${
        over ? "border-brand-500 bg-brand-50" : "border-brand-200 bg-white hover:bg-brand-50/50"
      }`}
    >
      {picker}
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-3xl text-brand-600" aria-hidden>
        ⬆
      </div>
      <p className="text-lg font-semibold">แตะเพื่อเลือกไฟล์</p>
      <p className="mt-1 text-sm text-muted">หรือลากไฟล์มาวางตรงนี้ · เลือกได้หลายไฟล์</p>
      <p className="mt-3 text-xs text-muted">รองรับ JPG, PNG, PDF, AI, PSD · ไฟล์ละไม่เกิน {maxMb}MB · 1 ไฟล์ = 1 แบบ</p>
    </div>
  );
}
