export type ProductKey = "paper" | "pp";
export type Finish = "gloss" | "matte" | "clear";

export type CheckLevel = "green" | "yellow" | "red";

export interface CheckIssue {
  level: CheckLevel;
  message: string;
}

export interface CheckResult {
  level: CheckLevel;
  /** ข้อความสั้นบนป้าย */
  title: string;
  issues: CheckIssue[];
  /** ข้อมูลประกอบสำหรับกราฟิก */
  info: {
    kind?: string;
    widthPx?: number;
    heightPx?: number;
    dpi?: number;
    colorMode?: string;
    pageWidthMm?: number;
    pageHeightMm?: number;
    pages?: number;
    fonts?: string[];
    missingLinks?: string[];
    minImageDpi?: number;
    needsManualReview?: boolean;
  };
  checkedBy: "browser" | "server";
}

export interface PriceTier {
  /** จำนวนแผ่นรวมขั้นต่ำของขั้นนี้ */
  min: number;
  paper: number;
  pp: number;
}

export interface Settings {
  shopName: string;
  sheetName: string;
  sheetWidthMm: number;
  sheetHeightMm: number;
  tiers: PriceTier[];
  minPerFile: number;
  shippingFee: number;
  freeShippingMin: number;
  promo: { enabled: boolean; every: number; free: number };
  fixFileFee: number;
  dpiGood: number;
  dpiMin: number;
  promptpayId: string;
  promptpayName: string;
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
  /** ข้อความใน LINE ตอนแจ้งเลขแทร็ค ใช้ {orderNo} {trackingNo} {carrier} ได้ */
  lineTrackingMessage: string;
  /** ข้อความนำหน้าเวลาบอทตอบสถานะ */
  lineReplyFooter: string;
  fileRetentionDays: number;
  maxFileMb: number;
  slipVerify: { enabled: boolean; provider: "slipok" | "easyslip" };
  notifyEmail: string;
  contactLine: string;
}

/** ส่วนที่ส่งให้ฝั่งลูกค้าได้ (ไม่มีข้อมูลภายใน) */
export type PublicSettings = Omit<Settings, "notifyEmail" | "slipVerify" | "lineReplyFooter" | "lineTrackingMessage">;

export type OrderStatus = "pending_slip" | "paid" | "producing" | "shipped" | "cancelled";

export interface Address {
  line1: string;
  subdistrict: string;
  district: string;
  province: string;
  zipcode: string;
}

export interface DraftItem {
  /** id ภายใน browser */
  key: string;
  uploadId: string | null;
  previewUploadId: string | null;
  previewUrl: string | null;
  fileName: string;
  fileSize: number;
  fileType: string;
  status: "uploading" | "checking" | "done" | "error";
  progress: number;
  error?: string;
  check: CheckResult | null;
  product: ProductKey | null;
  finish: Finish;
  qty: number;
  acceptRisk: boolean;
  fixService: boolean;
}
