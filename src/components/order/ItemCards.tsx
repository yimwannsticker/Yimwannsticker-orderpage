"use client";

import { useState } from "react";
import { PP_FINISHES, PRODUCTS, SHAPES } from "@/lib/constants";
import { baht, fileSizeText } from "@/lib/format";
import type { QuoteLine } from "@/lib/pricing";
import { applySize, cm, fileAspect, itemCheck, maxSharpText, perSheet } from "@/lib/sticker-size";
import type { CheckResult, DraftItem, ProductKey, PublicSettings, Shape } from "@/lib/types";
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

function StatusLine({ item, check = item.check }: { item: DraftItem; check?: CheckResult | null }) {
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
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {item.source && (
        <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">
          ↻ ไฟล์เดิมจาก {item.source.orderNo}
        </span>
      )}
      {check && <CheckBadge level={check.level} title={check.title} />}
    </div>
  );
}

/** การ์ดไฟล์ในขั้นอัปโหลด: เน้นผลตรวจไฟล์ */
export function UploadRow({ item, settings, onRemove }: { item: DraftItem; settings: PublicSettings; onRemove: () => void }) {
  const check = applySize(item.check, null, settings);
  const sharp = maxSharpText(item.check, settings);
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
          <StatusLine item={item} check={check} />
        </div>
      </div>
      {item.status === "done" && check && (
        <>
          <CheckDetails check={check} />
          <p className="mt-2 text-sm text-muted">
            {sharp ?? "ความคมชัดจะคำนวณตามขนาดดวงที่เลือกในขั้นถัดไป"}
          </p>
        </>
      )}
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

/** ช่องกรอกขนาดเป็นเซนติเมตร (เก็บค่าเป็นมิลลิเมตร) */
function CmInput({ id, label, mm, onChange }: { id: string; label: string; mm: number | null; onChange: (mm: number | null) => void }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <div className="min-w-0 flex-1">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className="input pr-12 text-lg font-semibold"
          inputMode="decimal"
          placeholder="0"
          value={text ?? (mm ? cm(mm) : "")}
          onFocus={() => setText(mm ? cm(mm) : "")}
          onChange={(e) => {
            const t = e.target.value.replace(/[^\d.]/g, "");
            setText(t);
            const v = parseFloat(t);
            onChange(Number.isFinite(v) && v > 0 ? Math.round(v * 10) : null);
          }}
          onBlur={() => setText(null)}
        />
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted">ซม.</span>
      </div>
    </div>
  );
}

const SHAPE_ICON: Record<Shape, React.ReactNode> = {
  rect: <span className="block h-6 w-6 rounded-[4px] border-2 border-current" />,
  circle: <span className="block h-6 w-6 rounded-full border-2 border-current" />,
  freeform: (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 3c2 3 6 2 7 5s-2 4-1 7-3 5-6 4-4 1-6-2 0-4-1-7 2-5 4-5 2-2 3-2Z" strokeLinejoin="round" />
    </svg>
  ),
};

/** เลือกทรงไดคัทและขนาดดวง */
function SizePicker({ item, settings, onChange }: { item: DraftItem; settings: PublicSettings; onChange: (p: Partial<DraftItem>) => void }) {
  const aspect = fileAspect(item.check);
  const [lock, setLock] = useState(Boolean(aspect));
  const circle = item.shape === "circle";
  const count = item.widthMm && item.heightMm ? perSheet(item.widthMm, item.heightMm, settings) : 0;
  const [want, setWant] = useState("");
  const sharp = maxSharpText(item.check, settings);

  const setW = (w: number | null) =>
    onChange(circle ? { widthMm: w, heightMm: w } : { widthMm: w, ...(lock && aspect && w ? { heightMm: Math.round(w / aspect) } : {}) });
  const setH = (h: number | null) => onChange({ heightMm: h, ...(lock && aspect && h ? { widthMm: Math.round(h * aspect) } : {}) });

  return (
    <div className="space-y-3 rounded-2xl bg-gray-50 p-3">
      <div>
        <p className="label">รูปทรงไดคัท</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="รูปทรงไดคัท">
          {SHAPES.map((x) => (
            <button
              key={x.key}
              type="button"
              role="radio"
              aria-checked={item.shape === x.key}
              onClick={() =>
                onChange(
                  x.key === "circle" && item.widthMm
                    ? { shape: x.key, heightMm: item.widthMm }
                    : { shape: x.key },
                )
              }
              className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border-2 text-sm font-semibold ${
                item.shape === x.key ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line bg-white text-ink"
              }`}
            >
              {SHAPE_ICON[x.key]}
              {x.label}
            </button>
          ))}
        </div>
        {item.shape && <p className="mt-1.5 text-xs text-muted">{SHAPES.find((x) => x.key === item.shape)?.hint}</p>}
        {item.shape === "freeform" && (
          <p className="mt-1 text-xs text-muted">แนะนำไฟล์ PNG พื้นหลังโปร่งใส หรือไฟล์ AI/PDF ที่มีเส้นไดคัท (ถ้าไม่มี กราฟิกจะทำเส้นตัดให้)</p>
        )}
      </div>

      {item.shape && (
        <div className="space-y-2">
          <p className="label !mb-0">ขนาดต่อดวง</p>
          <div className="flex items-end gap-2">
            {circle ? (
              <CmInput id={`w-${item.key}`} label="เส้นผ่านศูนย์กลาง" mm={item.widthMm} onChange={setW} />
            ) : (
              <>
                <CmInput id={`w-${item.key}`} label="กว้าง" mm={item.widthMm} onChange={setW} />
                <span className="pb-3 text-muted">×</span>
                <CmInput id={`h-${item.key}`} label="ยาว" mm={item.heightMm} onChange={setH} />
              </>
            )}
          </div>
          {!circle && aspect && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-500"
                checked={lock}
                onChange={(e) => {
                  setLock(e.target.checked);
                  if (e.target.checked && item.widthMm) onChange({ heightMm: Math.round(item.widthMm / aspect) });
                }}
              />
              ล็อกสัดส่วนตามไฟล์
            </label>
          )}
          {sharp && <p className="text-xs text-muted">{sharp}</p>}
          {count > 0 && (
            <div className="rounded-xl bg-white p-3 text-sm">
              <p>
                แผ่น {settings.sheetName} 1 แผ่น ได้ประมาณ <b>{count} ดวง</b>
                <span className="text-muted"> · {item.qty} แผ่น ≈ {(count * item.qty).toLocaleString("th-TH")} ดวง</span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label htmlFor={`want-${item.key}`} className="shrink-0 text-muted">
                  ต้องการกี่ดวง?
                </label>
                <input
                  id={`want-${item.key}`}
                  className="input !min-h-10 w-24 text-center"
                  inputMode="numeric"
                  value={want}
                  onChange={(e) => setWant(e.target.value.replace(/\D/g, ""))}
                />
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  disabled={!Number(want)}
                  onClick={() => onChange({ qty: Math.max(settings.minPerFile, Math.ceil(Number(want) / count)) })}
                >
                  คำนวณแผ่น
                </button>
              </div>
            </div>
          )}
          {item.widthMm && item.heightMm && count === 0 && <p className="text-sm text-bad">ขนาดดวงใหญ่เกินแผ่น {settings.sheetName}</p>}
        </div>
      )}
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
  const check = itemCheck(item, settings);
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
          <StatusLine item={item} check={check} />
        </div>
      </div>

      <SizePicker item={item} settings={settings} onChange={onChange} />

      {item.status === "done" && check && check.level !== "green" && (
        <CheckDetails check={check} defaultOpen={check.level === "red"} />
      )}
      {item.source?.prevApproved ? (
        <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-muted">
          {item.source.prevFixed
            ? "ครั้งก่อนร้านแก้ไฟล์นี้ให้แล้ว ร้านจะพิมพ์จากไฟล์ที่แก้แล้ว"
            : "ใช้ไฟล์เดียวกับครั้งก่อน พิมพ์ตามไฟล์เดิม"}
        </p>
      ) : (
        check?.level === "red" && <RedFileChoice item={item} fixFee={settings.fixFileFee} onChange={onChange} />
      )}

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

      <div>
        <p className="label">
          จำนวนแผ่น {settings.sheetName} (ขั้นต่ำ {settings.minPerFile} แผ่น)
        </p>
        <NumberStepper label="จำนวนแผ่น" value={item.qty} min={settings.minPerFile} onChange={(qty) => onChange({ qty })} />
        <p className="mt-1 text-xs text-muted">
          แผ่นขนาด {cm(settings.sheetWidthMm)} × {cm(settings.sheetHeightMm)} ซม. ร้านจัดเรียงดวงให้เต็มแผ่น
        </p>
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
