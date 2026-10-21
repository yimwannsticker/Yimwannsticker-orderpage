// ตรวจไฟล์ PSD ใช้ได้ทั้งใน browser และ server
import { readPsd } from "ag-psd";
import type { CheckResult } from "../types";
import { finalize, rasterCheck } from "./rules";

const COLOR_MODES: Record<number, string> = {
  0: "Bitmap",
  1: "Grayscale",
  2: "Indexed",
  3: "RGB",
  4: "CMYK",
  7: "Multichannel",
  8: "Duotone",
  9: "Lab",
};

/** อ่าน header ของ PSD/PSB ตรงๆ (ใช้สำรองถ้า ag-psd อ่านไม่ได้) */
export function readPsdHeader(buf: Uint8Array) {
  if (buf.length < 26 || String.fromCharCode(...buf.subarray(0, 4)) !== "8BPS") return null;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return {
    version: dv.getUint16(4),
    height: dv.getUint32(14),
    width: dv.getUint32(18),
    depth: dv.getUint16(22),
    colorMode: dv.getUint16(24),
  };
}

export function checkPsd(buf: Uint8Array, checkedBy: CheckResult["checkedBy"] = "server"): CheckResult {
  const header = readPsdHeader(buf);
  if (!header) {
    return finalize([{ level: "red", message: "เปิดไฟล์ PSD ไม่ได้ ไฟล์อาจเสียหาย กรุณาบันทึกใหม่" }], { kind: "psd" }, checkedBy);
  }
  let width = header.width;
  let height = header.height;
  let mode = header.colorMode;
  try {
    const psd = readPsd(buf, {
      skipLayerImageData: true,
      skipCompositeImageData: true,
      skipThumbnail: true,
      skipLinkedFilesData: true,
    });
    width = psd.width;
    height = psd.height;
    mode = psd.colorMode ?? mode;
  } catch {
    // ใช้ค่าจาก header
  }
  const result = rasterCheck(width, height, COLOR_MODES[mode] ?? `โหมด ${mode}`, checkedBy, "psd");
  if (header.version === 2) result.info.kind = "psb";
  return result;
}
