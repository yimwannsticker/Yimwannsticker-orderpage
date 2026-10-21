"use client";

import { PP_FINISHES, PRODUCTS } from "@/lib/constants";
import { baht, fileSizeText } from "@/lib/format";
import type { QuoteLine } from "@/lib/pricing";
import type { DraftItem, ProductKey, PublicSettings } from "@/lib/types";
import { CheckBadge, CheckDetails, FileIcon, NumberStepper, Spinner } from "../ui";

function Thumb({ item, size = "h-20 w-20" }: { item: DraftItem; size?: string }) {
  return (
    <div className={`${size} shrink-0 overflow-hidden rounded-2xl border border-line bg-gray-50`}>
      {item.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.previewUrl} alt={`ตัวอย่าง ${item.fileName}`} className="h-full w-full object-contain" />
      ) : (
        <FileIcon ext={item.fileType} />
      )}
    </div>
  );
}

function StatusLine({ item }: { item: DraftItem }) {
  if (item.status === "uploading")
    return (
      <div className="mt-2">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Spinner className="h-4 w-4" /> กำลังอัปโหลด {item.progress}%
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${item.progress}%` }} />
        </div>
      </div>
    );
  if (item.status === "checking")
    return (
      <div className="mt-2 flex items-center gap-2 text-sm text-muted">
        <Spinner className="h-4 w-4" /> กำลังตรวจไฟล์...
      </div>
    );
  if (item.status === "error") return <p className="mt-2 text-sm font-medium text-bad">{item.error}</p>;
  return item.check ? (
    <div className="mt-2">
      <CheckBadge level={item.check.level} title={item.check.title} />
    </div>
  ) : null;
}

/** การ์ดไฟล์ในขั้นอัปโหลด: เน้นผลตรวจไฟล์ */
export function UploadRow({ item, onRemove }: { item: DraftItem; onRemove: () => void }) {
  return (
    <div className="card">
      <div className="flex gap-3">
        <Thumb item={item} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-medium" title={item.fileName}>
              {item.fileName}
            </p>
            <button type="button" onClick={onRemove} className="shrink-0 text-sm text-muted underline" aria-label={`ลบ ${item.fileName}`}>
              ลบ
            </button>
          </div>
          <p className="text-xs text-muted">{fileSizeText(item.fileSize)}</p>
          <StatusLine item={item} />
        </div>
      </div>
      {item.status === "done" && item.check && <CheckDetails check={item.check} />}
    </div>
  );
}

export function RedFileChoice({
  item,
  fixFee,
  onChange,
}: {
  item: DraftItem;
  fixFee: number;
  onChange: (p: Partial<DraftItem>) => void;
}) {
  return (
    <div className="mt-3 space-y-2 rounded-2xl bg-bad-bg/60 p-3">
      <p className="text-sm font-semibold text-bad">ไฟล์นี้ต้องแก้ไข เลือกอย่างใดอย่างหนึ่งเพื่อไปต่อ</p>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white p-3">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 accent-brand-500"
          checked={item.fixService}
          onChange={(e) => onChange({ fixService: e.target.checked, acceptRisk: e.target.checked ? false : item.acceptRisk })}
        />
        <span className="text-sm">
          <b>ให้ร้านช่วยแก้ไฟล์</b> {fixFee > 0 ? `(+${baht(fixFee)})` : "(ฟรี)"}
          <br />
          <span className="text-muted">กราฟิกจะแก้ไฟล์ให้ก่อนพิมพ์ ถ้าแก้ไม่ได้จะติดต่อกลับ</span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white p-3">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 accent-brand-500"
          checked={item.acceptRisk}
          onChange={(e) => onChange({ acceptRisk: e.target.checked, fixService: e.target.checked ? false : item.fixService })}
        />
        <span className="text-sm">
          <b>ยอมรับว่าไฟล์อาจพิมพ์ไม่คมชัด</b>
          <br />
          <span className="text-muted">พิมพ์ตามไฟล์ที่ส่งมา ไม่รับเคลมเรื่องความคมชัด</span>
        </span>
      </label>
    </div>
  );
}

function ProductPicker({ value, onChange }: { value: ProductKey | null; onChange: (p: ProductKey) => void }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="ประเภทสติกเกอร์">
      {(Object.keys(PRODUCTS) as ProductKey[]).map((k) => {
        const active = value === k;
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(k)}
            className={`rounded-2xl border-2 p-4 text-left transition ${
              active ? "border-brand-500 bg-brand-50" : "border-line bg-white hover:border-brand-200"
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  active ? "border-brand-500" : "border-gray-300"
                }`}
              >
                {active && <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />}
              </span>
              <span className="font-semibold">{PRODUCTS[k].label}</span>
            </span>
            <span className="mt-1 block pl-7 text-sm leading-relaxed text-muted">{PRODUCTS[k].description}</span>
          </button>
        );
      })}
    </div>
  );
}

/** การ์ดไฟล์ในขั้นเลือกสินค้า */
export function ItemCard({
  item,
  index,
  line,
  settings,
  onChange,
  onRemove,
}: {
  item: DraftItem;
  index: number;
  line: QuoteLine | undefined;
  settings: PublicSettings;
  onChange: (p: Partial<DraftItem>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="card space-y-4">
      <div className="flex gap-3">
        <Thumb item={item} size="h-24 w-24" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-brand-600">ไฟล์ที่ {index + 1}</p>
            <button type="button" onClick={onRemove} className="text-sm text-muted underline">
              ลบ
            </button>
          </div>
          <p className="truncate font-medium" title={item.fileName}>
            {item.fileName}
          </p>
          <StatusLine item={item} />
        </div>
      </div>

      {item.status === "done" && item.check && item.check.level !== "green" && (
        <CheckDetails check={item.check} defaultOpen={item.check.level === "red"} />
      )}
      {item.check?.level === "red" && <RedFileChoice item={item} fixFee={settings.fixFileFee} onChange={onChange} />}

      <div>
        <p className="label">ประเภทสติกเกอร์</p>
        <ProductPicker value={item.product} onChange={(product) => onChange({ product })} />
      </div>

      {item.product === "pp" && (
        <div>
          <p className="label">ผิวสติกเกอร์ PP (ราคาเท่ากัน)</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="ผิวสติกเกอร์ PP">
            {PP_FINISHES.map((f) => (
              <button
                key={f.key}
                type="button"
                role="radio"
                aria-checked={item.finish === f.key}
                onClick={() => onChange({ finish: f.key })}
                className={`min-h-12 rounded-xl border-2 text-sm font-semibold ${
                  item.finish === f.key ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line bg-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">ขนาดแผ่น</p>
          <p className="flex min-h-12 items-center rounded-xl bg-gray-50 px-4 font-semibold">
            {settings.sheetName} <span className="ml-1 text-sm font-normal text-muted">({settings.sheetWidthMm}×{settings.sheetHeightMm} มม.)</span>
          </p>
        </div>
        <div>
          <p className="label">จำนวนแผ่น (ขั้นต่ำ {settings.minPerFile})</p>
          <NumberStepper label="จำนวนแผ่น" value={item.qty} min={settings.minPerFile} onChange={(qty) => onChange({ qty })} />
        </div>
      </div>

      {item.product && line && (
        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 text-sm">
          <span className="text-muted">
            {item.qty} แผ่น × {baht(line.unitPrice)}
            {line.fixFee > 0 && ` + แก้ไฟล์ ${baht(line.fixFee)}`}
          </span>
          <span className="font-semibold">{baht(line.lineTotal + line.fixFee)}</span>
        </div>
      )}
    </div>
  );
}
