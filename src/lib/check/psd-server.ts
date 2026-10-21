import "server-only";
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
export function readPsdHeader(buf: Buffer) {
  if (buf.length < 26 || buf.toString("latin1", 0, 4) !== "8BPS") return null;
  return {
    version: buf.readUInt16BE(4),
    height: buf.readUInt32BE(14),
    width: buf.readUInt32BE(18),
    depth: buf.readUInt16BE(22),
    colorMode: buf.readUInt16BE(24),
  };
}

export function checkPsd(buf: Buffer): CheckResult {
  const header = readPsdHeader(buf);
  if (!header) {
    return finalize([{ level: "red", message: "เปิดไฟล์ PSD ไม่ได้ ไฟล์อาจเสียหาย กรุณาบันทึกใหม่" }], { kind: "psd" }, "server");
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
  const result = rasterCheck(width, height, COLOR_MODES[mode] ?? `โหมด ${mode}`, "server", "psd");
  if (header.version === 2) result.info.kind = "psb";
  return result;
}
