"use client";

import { useCallback } from "react";
import { ACCEPTED_EXT, fileExt } from "@/lib/constants";
import { processArtwork } from "@/lib/client/file-tools";
import type { DraftItem, PublicSettings } from "@/lib/types";

export function newItem(file: File, minQty: number): DraftItem {
  return {
    key: crypto.randomUUID(),
    uploadId: null,
    previewUploadId: null,
    previewUrl: null,
    fileName: file.name,
    fileSize: file.size,
    fileType: fileExt(file.name),
    status: "uploading",
    progress: 0,
    check: null,
    product: null,
    finish: "matte",
    qty: minQty,
    shape: null,
    widthMm: null,
    heightMm: null,
    acceptRisk: false,
    fixService: false,
  };
}

export function validateFile(file: File, settings: PublicSettings): string | null {
  const ext = fileExt(file.name);
  if (!(ACCEPTED_EXT as readonly string[]).includes(ext)) return `ไม่รองรับไฟล์ .${ext || "?"} (รับเฉพาะ JPG, PNG, PDF, AI, PSD)`;
  if (file.size > settings.maxFileMb * 1024 * 1024) return `ไฟล์ ${file.name} ใหญ่เกิน ${settings.maxFileMb}MB`;
  if (file.size === 0) return `ไฟล์ ${file.name} ว่างเปล่า`;
  return null;
}

/** เพิ่มไฟล์เข้าออเดอร์: อัปโหลด + ตรวจไฟล์ แล้วอัปเดตสถานะผ่าน update(key, patch) */
export function useArtworkUploader(
  settings: PublicSettings,
  add: (item: DraftItem) => void,
  update: (key: string, patch: Partial<DraftItem>) => void,
) {
  return useCallback(
    (files: FileList | File[], onError: (msg: string) => void) => {
      for (const file of Array.from(files)) {
        const err = validateFile(file, settings);
        if (err) {
          onError(err);
          continue;
        }
        const item = newItem(file, settings.minPerFile);
        add(item);
        processArtwork(file, (u) => {
          const patch: Partial<DraftItem> = {};
          if (u.progress !== undefined) patch.progress = u.progress;
          if (u.phase === "checking") patch.status = "checking";
          if (u.previewUrl) patch.previewUrl = u.previewUrl;
          update(item.key, patch);
        })
          .then((r) =>
            update(item.key, {
              status: "done",
              uploadId: r.uploadId,
              previewUploadId: r.previewUploadId,
              check: r.check,
              progress: 100,
            }),
          )
          .catch((e: Error) => update(item.key, { status: "error", error: e.message }));
      }
    },
    [settings, add, update],
  );
}
