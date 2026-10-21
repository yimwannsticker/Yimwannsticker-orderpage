"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { productLabel } from "@/lib/constants";
import { baht, isValidPhone, normalizePhone } from "@/lib/format";
import { computeQuote, defaultFreeAllocation, nudgeText, validateItems } from "@/lib/pricing";
import type { DraftItem, PublicSettings } from "@/lib/types";
import { Alert, CopyButton, NumberStepper, Spinner, Stepper } from "../ui";
import { AddressForm, EMPTY_CUSTOMER, type CustomerForm } from "./AddressForm";
import { Dropzone } from "./Dropzone";
import { ItemCard, UploadRow } from "./ItemCards";
import { LineLoginCard } from "./LineLoginCard";
import { PaymentInfo, SlipUploader } from "./PaymentBox";
import { useArtworkUploader } from "./useArtworkUploader";

const STEPS = ["อัปโหลดไฟล์", "เลือกสติกเกอร์", "ที่อยู่จัดส่ง", "สรุปและชำระเงิน"];
const STEP_KEYS = ["upload", "items", "address", "summary"];
const DRAFT_KEY = "yw_draft_v1";

interface Draft {
  items: DraftItem[];
  customer: CustomerForm;
  step: number;
}

function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    // ไฟล์ที่อัปโหลดค้างไว้ใช้ต่อไม่ได้
    d.items = (d.items ?? []).filter((i) => i.status === "done" && i.uploadId);
    return d;
  } catch {
    return null;
  }
}

function initialState() {
  const d = loadDraft();
  const params = new URLSearchParams(window.location.search);
  const line = params.get("line");
  const notice = line === "ok" ? "เชื่อมต่อ LINE เรียบร้อย" : line === "failed" ? "เชื่อมต่อ LINE ไม่สำเร็จ สั่งต่อได้ตามปกติ" : null;
  if (params.has("line") || params.has("step")) window.history.replaceState(null, "", "/");
  if (!d) return { items: [] as DraftItem[], customer: EMPTY_CUSTOMER, step: 0, notice };
  const want = STEP_KEYS.indexOf(params.get("step") ?? "");
  return {
    items: d.items,
    customer: { ...EMPTY_CUSTOMER, ...d.customer, address: { ...EMPTY_CUSTOMER.address, ...d.customer?.address } },
    step: Math.min(want >= 0 ? want : d.step, d.items.length ? 3 : 0),
    notice,
  };
}

/** หน้าสั่งพิมพ์ (render เฉพาะใน browser เพราะต้องอ่านร่างออเดอร์จาก localStorage) */
export function OrderWizard({ settings }: { settings: PublicSettings }) {
  const [init] = useState(initialState);
  const [items, setItems] = useState<DraftItem[]>(init.items);
  const [customer, setCustomer] = useState<CustomerForm>(init.customer);
  const [step, setStep] = useState(init.step);
  const [notice] = useState<string | null>(init.notice);
  const [error, setError] = useState<string | null>(null);
  const [points, setPoints] = useState<{ points: number; pending: number } | null>(null);
  const [freeAlloc, setFreeAlloc] = useState<Record<string, number>>({});
  const [slip, setSlip] = useState<{ uploadId: string; previewUrl: string } | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ orderNo: string; token: string } | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (done) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ items, customer, step }));
    } catch {
      // พื้นที่เต็ม/โหมดส่วนตัว ไม่เป็นไร
    }
  }, [items, customer, step, done]);

  const add = useCallback((item: DraftItem) => setItems((xs) => [...xs, item]), []);
  const update = useCallback(
    (key: string, patch: Partial<DraftItem>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x))),
    [],
  );
  const remove = (key: string) => setItems((xs) => xs.filter((x) => x.key !== key));
  const addFiles = useArtworkUploader(settings, add, update);
  const onFiles = (files: FileList) => {
    setError(null);
    addFiles(files, (m) => setError(m));
  };

  const phone = normalizePhone(customer.phone);
  useEffect(() => {
    if (step !== 3 || !isValidPhone(phone)) return;
    let alive = true;
    fetch(`/api/points?phone=${phone}`)
      .then((r) => r.json())
      .then((p) => alive && setPoints(p))
      .catch(() => alive && setPoints({ points: 0, pending: 0 }));
    return () => {
      alive = false;
    };
  }, [step, phone]);

  const prevPoints = (points?.points ?? 0) + (points?.pending ?? 0);
  const quote = useMemo(() => computeQuote(settings, items, step === 3 ? prevPoints : 0), [settings, items, step, prevPoints]);

  // แผ่นแถม: ใช้ค่าที่ลูกค้าแบ่งเองถ้ายังรวมได้ครบ ไม่งั้นใช้ค่าเริ่มต้น
  const allocation = useMemo(() => {
    const custom = items.map((i) => freeAlloc[i.key]);
    const sum = custom.reduce((a: number, b) => a + (b ?? 0), 0);
    if (custom.every((v) => v !== undefined) && sum <= quote.freeSheets) return custom as number[];
    return defaultFreeAllocation(items.map((i) => i.qty), quote.freeSheets);
  }, [items, freeAlloc, quote.freeSheets]);
  const withFree = items.map((i, idx) => ({ ...i, freeQty: allocation[idx] ?? 0 }));
  const setFree = (key: string, qty: number) =>
    setFreeAlloc(Object.fromEntries(withFree.map((i) => [i.key, i.key === key ? qty : i.freeQty])));

  const busy = items.some((i) => i.status === "uploading" || i.status === "checking");
  const doneItems = items.filter((i) => i.status === "done");

  function go(n: number) {
    setError(null);
    setStep(n);
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function next() {
    if (step === 0) {
      if (busy) return setError("กรุณารอให้อัปโหลดและตรวจไฟล์เสร็จก่อน");
      if (!doneItems.length) return setError("กรุณาอัปโหลดไฟล์อย่างน้อย 1 ไฟล์");
      setItems((xs) => xs.filter((x) => x.status === "done"));
      return go(1);
    }
    if (step === 1) {
      if (busy) return setError("กรุณารอให้อัปโหลดและตรวจไฟล์เสร็จก่อน");
      const v = validateItems(
        settings,
        doneItems.map((i) => ({ ...i, freeQty: 0, checkLevel: i.check?.level })),
        0,
      );
      if (!v.ok) return setError(v.message!);
      setItems((xs) => xs.filter((x) => x.status === "done"));
      return go(2);
    }
    if (step === 2) {
      const a = customer.address;
      if (!customer.name.trim()) return setError("กรุณากรอกชื่อผู้รับ");
      if (!isValidPhone(phone)) return setError("กรุณากรอกเบอร์โทรให้ถูกต้อง (10 หลัก)");
      if (!a.line1.trim()) return setError("กรุณากรอกบ้านเลขที่ / ถนน");
      if (!/^\d{5}$/.test(a.zipcode)) return setError("กรุณากรอกรหัสไปรษณีย์ 5 หลัก");
      if (!a.district.trim() || !a.province.trim()) return setError("กรุณากรอกอำเภอและจังหวัด");
      return go(3);
    }
  }

  async function submit() {
    setError(null);
    const v = validateItems(settings, withFree.map((i) => ({ ...i, checkLevel: i.check?.level })), quote.freeSheets);
    if (!v.ok) return setError(v.message!);
    if (!slip) return setError("กรุณาแนบสลิปการโอนเงิน");
    if (!consent) return setError("กรุณาติ๊กยอมรับนโยบายความเป็นส่วนตัว");
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: withFree.map((i) => ({
            uploadId: i.uploadId,
            previewUploadId: i.previewUploadId,
            product: i.product,
            finish: i.finish,
            qty: i.qty,
            freeQty: i.freeQty,
            acceptRisk: i.acceptRisk,
            fixService: i.fixService,
          })),
          customer: { ...customer, phone },
          slipUploadId: slip.uploadId,
          consent,
          expectedTotal: quote.total,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 409 && json.quote) {
          // ราคา/ยอดสะสมเปลี่ยน ให้ลูกค้าดูยอดใหม่
          const p = await fetch(`/api/points?phone=${phone}`).then((r) => r.json());
          setPoints(p);
        }
        setError(json.error || "ส่งออเดอร์ไม่สำเร็จ");
        return;
      }
      localStorage.removeItem(DRAFT_KEY);
      setDone(json);
      topRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch {
      setError("อินเทอร์เน็ตขัดข้อง กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) return <DoneScreen orderNo={done.orderNo} token={done.token} contactLine={settings.contactLine} />;

  return (
    <div ref={topRef} className="mx-auto max-w-xl scroll-mt-4 px-4 pb-40 pt-4">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-lg font-bold text-brand-600">{settings.shopName}</p>
          <p className="text-sm text-muted">สั่งพิมพ์สติกเกอร์ {settings.sheetName}</p>
        </div>
        <Link href="/track" className="btn-ghost btn-sm">
          เช็คสถานะ
        </Link>
      </header>
      <div className="mb-5">
        <Stepper steps={STEPS} current={step} />
      </div>
      {notice && (
        <div className="mb-4">
          <Alert tone="ok">{notice}</Alert>
        </div>
      )}

      {step === 0 && (
        <section className="space-y-3">
          <h1 className="text-xl font-bold">อัปโหลดไฟล์งาน</h1>
          <Dropzone onFiles={onFiles} maxMb={settings.maxFileMb} />
          {items.map((it) => (
            <UploadRow key={it.key} item={it} onRemove={() => remove(it.key)} />
          ))}
        </section>
      )}

      {step === 1 && (
        <section className="space-y-3">
          <h1 className="text-xl font-bold">เลือกสติกเกอร์และจำนวน</h1>
          {items.map((it, idx) => (
            <ItemCard
              key={it.key}
              item={it}
              index={idx}
              line={quote.lines[idx]}
              settings={settings}
              onChange={(p) => update(it.key, p)}
              onRemove={() => remove(it.key)}
            />
          ))}
          <Dropzone compact onFiles={onFiles} maxMb={settings.maxFileMb} />
          <PriceTable settings={settings} total={quote.totalSheets} />
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <h1 className="text-xl font-bold">ที่อยู่จัดส่ง</h1>
          <div className="card">
            <AddressForm value={customer} onChange={setCustomer} />
          </div>
          <LineLoginCard />
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <h1 className="text-xl font-bold">สรุปและชำระเงิน</h1>
          <div className="card space-y-3">
            {withFree.map((it, idx) => (
              <div key={it.key} className="flex gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-50">
                  {it.previewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.previewUrl} alt="" className="h-full w-full object-contain" />
                  )}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-medium">{it.fileName}</p>
                  <p className="text-muted">{it.product && productLabel(it.product, it.finish)}</p>
                  <p className="text-muted">
                    {it.qty} แผ่น × {baht(quote.lines[idx]?.unitPrice ?? 0)}
                    {it.freeQty > 0 && <span className="font-semibold text-ok"> + แถม {it.freeQty} แผ่น</span>}
                  </p>
                  {it.fixService && <p className="text-muted">ค่าแก้ไฟล์ {baht(settings.fixFileFee)}</p>}
                </div>
                <p className="text-sm font-semibold">{baht((quote.lines[idx]?.lineTotal ?? 0) + (quote.lines[idx]?.fixFee ?? 0))}</p>
              </div>
            ))}
            <div className="space-y-1 border-t border-line pt-3 text-sm">
              <Row label={`รวม ${quote.totalSheets} แผ่น`} value={baht(quote.subtotal)} />
              {quote.fixFeeTotal > 0 && <Row label="ค่าบริการแก้ไฟล์" value={baht(quote.fixFeeTotal)} />}
              <Row label="ค่าส่ง" value={quote.shipping ? baht(quote.shipping) : "ส่งฟรี"} />
              {quote.freeSheets > 0 && <Row label="แผ่นแถม" value={`${quote.freeSheets} แผ่น`} />}
              <div className="flex items-center justify-between pt-2 text-lg font-bold">
                <span>ยอดชำระ</span>
                <span className="text-brand-600">{baht(quote.total)}</span>
              </div>
            </div>
          </div>

          <PromoBox
            enabled={settings.promo.enabled}
            loading={!points}
            points={points?.points ?? 0}
            free={quote.freeSheets}
            toNext={quote.toNextFree}
            every={settings.promo.every}
            freePer={settings.promo.free}
            items={withFree}
            onAlloc={setFree}
          />

          <div className="card space-y-3">
            <h2 className="font-bold">ชำระเงิน {baht(quote.total)}</h2>
            <PaymentInfo settings={settings} amount={quote.total} />
            <SlipUploader value={slip} onChange={setSlip} />
          </div>

          <label className="flex cursor-pointer items-start gap-3 px-1 text-sm">
            <input type="checkbox" className="mt-0.5 h-5 w-5 accent-brand-500" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              ยินยอมให้ร้านเก็บและใช้ชื่อ เบอร์โทร ที่อยู่ และไฟล์งาน เพื่อผลิตและจัดส่งสินค้า ตาม{" "}
              <Link href="/privacy" target="_blank" className="font-medium text-brand-600 underline">
                นโยบายความเป็นส่วนตัว
              </Link>
            </span>
          </label>
        </section>
      )}

      {error && (
        <div className="mt-4">
          <Alert tone="bad">{error}</Alert>
        </div>
      )}

      {/* แถบล่าง: ยอดรวม + ปุ่มไปต่อ */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-xl px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          {step >= 1 && quote.totalSheets > 0 && (
            <div className="mb-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted">
                  รวม {quote.totalSheets} แผ่น {quote.shipping ? `· ค่าส่ง ${quote.shipping}` : "· ส่งฟรี"}
                </span>
                <span className="text-lg font-bold">{baht(quote.total)}</span>
              </div>
              {quote.nudge && <p className="text-sm font-medium text-brand-600">✨ {nudgeText(quote.nudge)}</p>}
            </div>
          )}
          <div className="flex gap-2">
            {step > 0 && (
              <button type="button" className="btn-secondary" onClick={() => go(step - 1)}>
                ย้อนกลับ
              </button>
            )}
            {step < 3 ? (
              <button type="button" className="btn-primary flex-1" onClick={next} disabled={busy && step === 0}>
                {busy && step === 0 ? (
                  <>
                    <Spinner /> กำลังตรวจไฟล์...
                  </>
                ) : (
                  `ถัดไป: ${STEPS[step + 1]}`
                )}
              </button>
            ) : (
              <button type="button" className="btn-primary flex-1" onClick={submit} disabled={submitting}>
                {submitting ? (
                  <>
                    <Spinner /> กำลังส่งออเดอร์...
                  </>
                ) : (
                  "ยืนยันสั่งซื้อ"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function PriceTable({ settings, total }: { settings: PublicSettings; total: number }) {
  const tiers = [...settings.tiers].sort((a, b) => a.min - b.min);
  return (
    <details className="card text-sm">
      <summary className="cursor-pointer font-semibold">ตารางราคาต่อแผ่น (คิดจากจำนวนรวมทุกไฟล์)</summary>
      <table className="mt-3 w-full text-left">
        <thead className="text-muted">
          <tr>
            <th className="py-1 font-medium">จำนวนรวม</th>
            <th className="py-1 font-medium">กระดาษขาวเงา</th>
            <th className="py-1 font-medium">PP</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((t, i) => {
            const nextMin = tiers[i + 1]?.min;
            const active = total >= t.min && (!nextMin || total < nextMin);
            return (
              <tr key={t.min} className={active ? "bg-brand-50 font-semibold text-brand-700" : ""}>
                <td className="py-1.5 pl-1">{nextMin ? `${t.min}–${nextMin - 1}` : `${t.min} ขึ้นไป`}</td>
                <td>{t.paper} บาท</td>
                <td>{t.pp} บาท</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-muted">
        ค่าส่ง {settings.shippingFee} บาท · สั่งรวม {settings.freeShippingMin} แผ่นขึ้นไปส่งฟรี
      </p>
    </details>
  );
}

function PromoBox(props: {
  enabled: boolean;
  loading: boolean;
  points: number;
  free: number;
  toNext: number;
  every: number;
  freePer: number;
  items: (DraftItem & { freeQty: number })[];
  onAlloc: (key: string, qty: number) => void;
}) {
  if (!props.enabled) return null;
  const allocated = props.items.reduce((a, i) => a + i.freeQty, 0);
  return (
    <div className="card space-y-2 border-brand-200 bg-brand-50/50">
      <p className="font-bold">
        🎁 โปรสะสม {props.every} แผ่น แถม {props.freePer}
      </p>
      {props.loading ? (
        <p className="text-sm text-muted">กำลังตรวจยอดสะสม...</p>
      ) : (
        <>
          <p className="text-sm text-muted">ยอดสะสมก่อนออเดอร์นี้: {props.points} แผ่น</p>
          {props.free > 0 ? (
            <>
              <p className="text-lg font-bold text-ok">ได้รับฟรี {props.free} แผ่น!</p>
              <p className="text-sm">เลือกว่าจะเอาแผ่นแถมไปพิมพ์ไฟล์ไหน (แบ่งได้)</p>
              {props.items.map((it) => (
                <div key={it.key} className="flex items-center justify-between gap-2 rounded-xl bg-white p-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{it.fileName}</span>
                  <NumberStepper
                    label={`แผ่นแถม ${it.fileName}`}
                    value={it.freeQty}
                    min={0}
                    max={it.freeQty + (props.free - allocated)}
                    onChange={(v) => props.onAlloc(it.key, v)}
                  />
                </div>
              ))}
              {allocated !== props.free && (
                <p className="text-sm font-medium text-bad">
                  แบ่งแล้ว {allocated} / {props.free} แผ่น
                </p>
              )}
            </>
          ) : (
            <p className="text-sm font-semibold text-brand-700">
              สะสมอีก {props.toNext} แผ่น รับฟรี {props.freePer} แผ่น
            </p>
          )}
        </>
      )}
    </div>
  );
}

function DoneScreen({ orderNo, token, contactLine }: { orderNo: string; token: string; contactLine: string }) {
  const url = typeof window !== "undefined" ? `${window.location.origin}/o/${token}` : `/o/${token}`;
  return (
    <div className="mx-auto max-w-xl px-4 py-10 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-ok-bg text-4xl text-ok">✓</div>
      <h1 className="mt-4 text-2xl font-bold">ส่งออเดอร์เรียบร้อย</h1>
      <p className="mt-1 text-muted">ร้านจะตรวจสลิปและเริ่มผลิตให้เร็วที่สุด</p>
      <div className="card mt-6 space-y-3 text-left">
        <div>
          <p className="text-sm text-muted">เลขออเดอร์</p>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold tracking-wide">{orderNo}</p>
            <CopyButton text={orderNo} />
          </div>
        </div>
        <Alert tone="warn">
          <b>บันทึกลิงก์นี้ไว้</b> เพื่อเช็คสถานะและเลขพัสดุ (หรือแคปหน้าจอนี้ไว้)
        </Alert>
        <p className="break-all rounded-xl bg-gray-50 p-3 text-sm">{url}</p>
        <div className="flex gap-2">
          <CopyButton text={url} label="คัดลอกลิงก์" className="flex-1" />
          <Link href={`/o/${token}`} className="btn-primary btn-sm flex-1">
            ไปหน้าเช็คสถานะ
          </Link>
        </div>
        <p className="text-sm text-muted">
          ดูสถานะได้อีกทางที่หน้า <Link href="/track" className="text-brand-600 underline">เช็คสถานะ</Link> ด้วยเลขออเดอร์ + เบอร์โทร
          {contactLine && <> หรือพิมพ์เลขออเดอร์ใน LINE {contactLine}</>}
        </p>
      </div>
    </div>
  );
}
