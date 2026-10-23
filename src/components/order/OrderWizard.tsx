"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { a5NudgeText, combineTotals, computeA5Quote } from "@/lib/a5-pricing";
import { resolveCart } from "@/lib/cart-resolve";
import { clearCart, getCart, useCart } from "@/lib/client/cart";
import type { ShopCatalog } from "@/lib/shop-types";
import { productLabel, shapeLabel } from "@/lib/constants";
import { itemCheck, perSheet, sizeText } from "@/lib/sticker-size";
import { baht, isValidPhone, normalizePhone } from "@/lib/format";
import { pickMessage } from "@/lib/greeting";
import { computeQuote, defaultFreeAllocation, itemProblem, nudgeText, validateItems } from "@/lib/pricing";
import type { DraftItem, PublicSettings } from "@/lib/types";
import { Alert, CopyButton, NumberStepper, Spinner, Stepper } from "../ui";
import { AddressForm, EMPTY_CUSTOMER, addressErrors, type CustomerForm } from "./AddressForm";
import { Dropzone } from "./Dropzone";
import { ItemCard, UploadRow } from "./ItemCards";
import { LineLoginCard } from "./LineLoginCard";
import { PastFilesPicker, type PastFile } from "./PastFilesPicker";
import { PaymentInfo, SlipUploader } from "./PaymentBox";
import { useArtworkUploader } from "./useArtworkUploader";
import { WelcomeBack, type Me } from "./WelcomeBack";

const STEPS = ["อัปโหลดไฟล์", "เลือกสติกเกอร์", "ที่อยู่จัดส่ง", "สรุปและชำระเงิน"];
const STEP_KEYS = ["upload", "items", "address", "summary"];
const DRAFT_KEY = "yw_draft_v1";
const STEP_ADDRESS = 2;

interface ReorderData {
  orderNo: string;
  customer: { name: string; phone: string; address: CustomerForm["address"] };
  items: {
    itemId: string;
    available: boolean;
    fileName: string;
    fileSize: number;
    fileType: string;
    previewUrl: string | null;
    check: DraftItem["check"];
    product: NonNullable<DraftItem["product"]>;
    finish: DraftItem["finish"];
    qty: number;
    shape: DraftItem["shape"];
    widthMm: number | null;
    heightMm: number | null;
    trim: DraftItem["trim"];
    prevApproved: boolean;
    prevFixed: boolean;
  }[];
}

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
    d.items = (d.items ?? []).filter((i) => i.status === "done" && (i.uploadId || i.source));
    return d;
  } catch {
    return null;
  }
}

function initialState() {
  const d = loadDraft();
  const params = new URLSearchParams(window.location.search);
  const line = params.get("line");
  const notice =
    line === "ok"
      ? "เข้าสู่ระบบด้วย LINE เรียบร้อย"
      : line === "new"
        ? "เชื่อมต่อ LINE เรียบร้อย ยังไม่เคยสั่งด้วย LINE นี้ สั่งครั้งนี้ หรือกด \"เลือกจากไฟล์ที่เคยสั่ง\" ยืนยันชื่อและเบอร์ แล้วครั้งหน้าเข้าด้วย LINE ระบบจะจำได้ทุกเครื่อง"
        : line === "failed"
          ? "เชื่อมต่อ LINE ไม่สำเร็จ สั่งต่อได้ตามปกติ"
          : null;
  const reorder = params.get("reorder");
  const want = STEP_KEYS.indexOf(params.get("step") ?? "");
  // มาจากตะกร้าที่มีแต่สติกเกอร์ A5: เริ่มที่ขั้นที่อยู่ได้เลย
  const hasA5 = getCart().length > 0;
  if (!d) return { items: [] as DraftItem[], customer: EMPTY_CUSTOMER, step: hasA5 && want >= STEP_ADDRESS ? want : 0, notice, reorder };
  const step = Math.min(want >= 0 ? want : d.step, d.items.length || hasA5 ? 3 : 0);
  return {
    items: d.items,
    customer: { ...EMPTY_CUSTOMER, ...d.customer, address: { ...EMPTY_CUSTOMER.address, ...d.customer?.address } },
    // ไม่มีไฟล์ A3+ ข้ามขั้นอัปโหลด/เลือกสติกเกอร์
    step: !d.items.length && hasA5 && step > 0 && step < STEP_ADDRESS ? STEP_ADDRESS : step,
    notice,
    reorder,
  };
}

/** หน้าสั่งพิมพ์ (render เฉพาะใน browser เพราะต้องอ่านร่างออเดอร์จาก localStorage) */
export function OrderWizard({ settings, catalog }: { settings: PublicSettings; catalog: ShopCatalog }) {
  const [init] = useState(initialState);
  const router = useRouter();
  // สติกเกอร์สำเร็จรูป A5 ในตะกร้า (สั่งรวมในออเดอร์เดียวกัน)
  const cartLines = useCart();
  const a5Resolved = useMemo(() => resolveCart(cartLines, catalog), [cartLines, catalog]);
  const a5Ok = a5Resolved.filter((r) => !r.problem);
  const a5Bad = a5Resolved.length - a5Ok.length;
  const a5q = useMemo(() => computeA5Quote(settings, a5Ok.map((r) => ({ qty: r.line.qty, surcharge: r.size?.surcharge ?? 0 }))), [settings, a5Ok]);
  const [items, setItems] = useState<DraftItem[]>(init.items);
  const [customer, setCustomer] = useState<CustomerForm>(init.customer);
  const [step, setStep] = useState(init.step);
  const [notice, setNotice] = useState<string | null>(init.notice);
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

  // ล้างพารามิเตอร์ออกจาก URL หลังอ่านแล้ว (ทำใน effect เพราะ initializer อาจถูกเรียกซ้ำ)
  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, "", "/print");
  }, []);

  // สั่งซ้ำแบบเดิม: โหลดรายการและที่อยู่จากออเดอร์เก่า
  useEffect(() => {
    if (!init.reorder) return;
    const token = init.reorder;
    fetch(`/api/orders/${encodeURIComponent(token)}/reorder`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: ReorderData) => {
        const list = d.items.filter((i) => i.available);
        setItems(
          list.map((i) => ({
            key: crypto.randomUUID(),
            uploadId: null,
            previewUploadId: null,
            previewUrl: i.previewUrl,
            fileName: i.fileName,
            fileSize: i.fileSize,
            fileType: i.fileType,
            status: "done",
            progress: 100,
            check: i.check,
            product: i.product,
            finish: i.finish,
            qty: Math.max(i.qty, settings.minPerFile),
            shape: i.shape,
            widthMm: i.widthMm,
            heightMm: i.heightMm,
            trim: i.trim,
            acceptRisk: false,
            fixService: false,
            source: { token, itemId: i.itemId, orderNo: d.orderNo, prevApproved: i.prevApproved, prevFixed: i.prevFixed },
          })),
        );
        setCustomer({ ...EMPTY_CUSTOMER, name: d.customer.name, phone: d.customer.phone, address: { ...EMPTY_CUSTOMER.address, ...d.customer.address } });
        setStep(list.length ? 1 : 0);
        const gone = d.items.length - list.length;
        setNotice(
          `ดึงรายการจากออเดอร์ ${d.orderNo} แล้ว ปรับจำนวน เพิ่มหรือลบไฟล์ได้` +
            (gone ? ` (มี ${gone} ไฟล์ที่ถูกลบออกจากระบบแล้ว กรุณาอัปโหลดใหม่)` : ""),
        );
      })
      .catch(() => setNotice("ดึงออเดอร์เดิมไม่สำเร็จ กรุณาอัปโหลดไฟล์ใหม่"));
  }, [init.reorder, settings.minPerFile]);

  const add = useCallback((item: DraftItem) => setItems((xs) => [...xs, item]), []);
  const update = useCallback(
    (key: string, patch: Partial<DraftItem>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x))),
    [],
  );
  const remove = (key: string) => setItems((xs) => xs.filter((x) => x.key !== key));
  const [picker, setPicker] = useState(false);

  // ลูกค้าที่เครื่องนี้จำไว้: ทักทาย ยอดสะสม ไฟล์เดิม และกรอกชื่อ/เบอร์/ที่อยู่ล่าสุดให้
  const [me, setMe] = useState<Me | null>(null);
  const [myFiles, setMyFiles] = useState<{ customer: { name: string; phone: string }; files: PastFile[] } | null>(null);
  useEffect(() => {
    let alive = true;
    const post = (url: string) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    fetch("/api/me")
      .then((r) => r.json())
      .then(async ({ me }: { me: Me | null }) => {
        if (!alive || !me) return;
        setMe(me);
        const [files, addrs] = await Promise.all([
          post("/api/my-files").then((r) => (r.ok ? r.json() : { customer: me, files: [] })),
          post("/api/my-addresses").then((r) => (r.ok ? r.json() : { addresses: [] })),
        ]);
        if (!alive) return;
        setMyFiles(files);
        const latest = (addrs.addresses as { address: CustomerForm["address"] }[])[0]?.address;
        setCustomer((c) => {
          if (c.name.trim() || c.phone.trim()) return c;
          const empty = !c.address.line1.trim() && !c.address.zipcode;
          return { ...c, name: me.name, phone: me.phone, address: empty && latest ? { ...latest } : c.address };
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function logout() {
    await fetch("/api/me", { method: "DELETE" }).catch(() => {});
    setMe(null);
    setMyFiles(null);
    setCustomer(EMPTY_CUSTOMER);
    // ไฟล์เดิมผูกกับเบอร์ของลูกค้าคนนั้น เอาออกด้วย
    setItems((xs) => xs.filter((x) => !x.source?.grant));
    setNotice("ออกจากระบบแล้ว เครื่องนี้จะไม่จำข้อมูลของคุณ");
  }

  function addPastFiles(files: PastFile[], who: { name: string; phone: string }) {
    setItems((xs) => [
      ...xs,
      ...files.map(
        (f): DraftItem => ({
          key: crypto.randomUUID(),
          uploadId: null,
          previewUploadId: null,
          previewUrl: f.previewUrl,
          fileName: f.fileName,
          fileSize: f.fileSize,
          fileType: f.fileType,
          status: "done",
          progress: 100,
          check: f.check,
          product: f.product,
          finish: f.finish,
          qty: Math.max(f.qty, settings.minPerFile),
          shape: f.shape,
          widthMm: f.widthMm,
          heightMm: f.heightMm,
          trim: f.trim,
          acceptRisk: false,
          fixService: false,
          source: { grant: f.grant, itemId: f.itemId, orderNo: f.orderNo, prevApproved: f.prevApproved, prevFixed: f.prevFixed },
        }),
      ),
    ]);
    setCustomer((c) => ({ ...c, name: c.name || who.name, phone: c.phone || who.phone }));
    setPicker(false);
    setNotice(`เพิ่มไฟล์ที่เคยสั่ง ${files.length} ไฟล์แล้ว ใช้ประเภทและจำนวนจากครั้งล่าสุด แก้ได้ในขั้นถัดไป`);
    // ยืนยันผ่านหน้าเลือกไฟล์แล้ว → เครื่องนี้จำลูกค้าไว้ (ทักทายครั้งหน้า)
    if (!me) fetch("/api/me").then((r) => r.json()).then((d) => d.me && setMe(d.me)).catch(() => {});
  }
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
  // ยอดรวมออเดอร์ = งาน A3+ (logic เดิม) + A5 ค่าส่งเก็บฝั่งที่แพงกว่า
  const totals = combineTotals(quote, a5q);
  // ออเดอร์มีแต่ A5: ซ่อนขั้นอัปโหลด/เลือกสติกเกอร์
  const a5Only = !items.length && a5Ok.length > 0 && step >= STEP_ADDRESS;

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

  const inCart = new Set(items.map((i) => i.source?.itemId).filter(Boolean) as string[]);
  const busy = items.some((i) => i.status === "uploading" || i.status === "checking");
  const doneItems = items.filter((i) => i.status === "done");

  function go(n: number) {
    setError(null);
    setShowItemErrors(false);
    setShowAddrErrors(false);
    setStep(n);
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  /** เลื่อนไปช่องแรกที่มีกรอบแดง แล้ววางเคอร์เซอร์ไว้ให้แก้ได้ทันที */
  function focusFirstInvalid() {
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]');
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const input = el.matches("input, select, textarea") ? el : el.querySelector<HTMLElement>("input, select, textarea, button");
      input?.focus({ preventScroll: true });
    });
  }

  // ไฮไลต์ช่องที่ยังไม่ครบ หลังกด "ถัดไป" (หายเองเมื่อแก้ถูก)
  const [showItemErrors, setShowItemErrors] = useState(false);
  const [showAddrErrors, setShowAddrErrors] = useState(false);
  const checkLevelOf = (i: DraftItem) => (i.source?.prevApproved ? null : itemCheck(i, settings)?.level);
  const itemProblems = showItemErrors
    ? Object.fromEntries(items.map((i) => [i.key, itemProblem(settings, { ...i, checkLevel: checkLevelOf(i) })]))
    : {};
  const addrErrors = showAddrErrors ? addressErrors(customer) : {};
  // แก้ครบแล้ว ซ่อนข้อความเตือนในแถบล่างได้เลย
  const fixedAll =
    (step === 1 && showItemErrors && !Object.values(itemProblems).some(Boolean)) ||
    (step === 2 && showAddrErrors && !Object.keys(addrErrors).length);
  const visibleError = fixedAll ? null : error;

  function next() {
    if (step === 0) {
      if (busy) return setError("กรุณารอให้อัปโหลดและตรวจไฟล์เสร็จก่อน");
      if (!doneItems.length && a5Ok.length) return go(STEP_ADDRESS);
      if (!doneItems.length) return setError("กรุณาอัปโหลดไฟล์อย่างน้อย 1 ไฟล์");
      setItems((xs) => xs.filter((x) => x.status === "done"));
      return go(1);
    }
    if (step === 1) {
      if (busy) return setError("กรุณารอให้อัปโหลดและตรวจไฟล์เสร็จก่อน");
      const v = validateItems(
        settings,
        doneItems.map((i) => ({ ...i, freeQty: 0, checkLevel: checkLevelOf(i) })),
        0,
      );
      if (!v.ok) {
        setShowItemErrors(true);
        focusFirstInvalid();
        const bad = doneItems.filter((i) => itemProblem(settings, { ...i, checkLevel: checkLevelOf(i) })).length;
        return setError(bad > 1 ? `ยังเลือกไม่ครบ ${bad} ไฟล์ ดูกรอบสีแดง` : v.message!);
      }
      setItems((xs) => xs.filter((x) => x.status === "done"));
      return go(2);
    }
    if (step === 2) {
      const errs = Object.values(addressErrors(customer));
      if (errs.length) {
        setShowAddrErrors(true);
        focusFirstInvalid();
        return setError(errs.length > 1 ? `กรอกไม่ครบ ${errs.length} ช่อง ดูกรอบสีแดง` : errs[0]!);
      }
      return go(3);
    }
  }

  async function submit() {
    setError(null);
    if (!items.length && !a5Ok.length) return setError("ยังไม่มีสินค้าในออเดอร์");
    if (a5Bad) return setError("มีสติกเกอร์ A5 ที่ปิดขายแล้ว กรุณาลบออกในตะกร้าก่อน");
    if (items.length) {
      const v = validateItems(
        settings,
        withFree.map((i) => ({ ...i, checkLevel: i.source?.prevApproved ? null : itemCheck(i, settings)?.level })),
        quote.freeSheets,
      );
      if (!v.ok) return setError(v.message!);
    }
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
            shape: i.shape,
            widthMm: i.widthMm,
            heightMm: i.heightMm,
            trim: i.trim ?? null,
            reorder: i.source
              ? i.source.grant
                ? { grant: i.source.grant }
                : { token: i.source.token, itemId: i.source.itemId }
              : null,
          })),
          a5: a5Ok.map((r) => ({ designId: r.line.designId, sizeId: r.line.sizeId, qty: r.line.qty })),
          customer: { ...customer, phone },
          slipUploadId: slip.uploadId,
          consent,
          expectedTotal: totals.total,
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
      clearCart();
      setDone(json);
      topRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch {
      setError("อินเทอร์เน็ตขัดข้อง กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  }

  if (picker)
    return (
      <PastFilesPicker
        initialName={customer.name}
        initialPhone={customer.phone}
        preloaded={myFiles}
        inCart={inCart}
        onAdd={addPastFiles}
        onClose={() => setPicker(false)}
      />
    );

  if (done)
    return (
      <DoneScreen
        orderNo={done.orderNo}
        token={done.token}
        contactLine={settings.contactLine}
        messages={settings.thankYouMessages}
        name={customer.name}
      />
    );

  return (
    <div ref={topRef} className="mx-auto max-w-xl scroll-mt-4 px-4 pb-40 pt-4">
      <header className="mb-4 flex items-center justify-between gap-2">
        <Link href="/" className="min-w-0">
          <p className="text-lg font-bold text-brand-600">‹ {settings.shopName}</p>
          <p className="text-sm text-muted">{a5Only ? "ชำระเงิน" : `สั่งพิมพ์สติกเกอร์ ${settings.sheetName}`}</p>
        </Link>
        <div className="flex shrink-0 gap-1">
          <Link href="/cart" className="btn-ghost btn-sm">
            🛒 ตะกร้า
          </Link>
          <Link href="/track" className="btn-ghost btn-sm">
            เช็คสถานะ
          </Link>
        </div>
      </header>
      <div className="mb-5">
        {a5Only ? <Stepper steps={["ตะกร้า", STEPS[2], STEPS[3]]} current={step - 1} /> : <Stepper steps={STEPS} current={step} />}
      </div>
      {a5Ok.length > 0 && step < STEP_ADDRESS && (
        <div className="mb-4">
          <Alert tone="info">
            ในตะกร้ามีสติกเกอร์สำเร็จรูป A5 {a5q.sheets} แผ่น จะรวมส่งในออเดอร์นี้ ·{" "}
            <Link href="/cart" className="font-semibold underline">
              ดูตะกร้า
            </Link>
          </Alert>
        </div>
      )}
      {notice && (
        <div className="mb-4">
          <Alert tone="ok">{notice}</Alert>
        </div>
      )}

      {step === 0 && (
        <section className="space-y-3">
          {me && (
            <WelcomeBack
              me={me}
              promo={settings.promo}
              messages={settings.welcomeMessages}
              files={myFiles?.files ?? null}
              inCart={inCart}
              onAdd={(f) => addPastFiles([f], myFiles?.customer ?? me)}
              onShowAll={() => setPicker(true)}
              onLogout={logout}
            />
          )}
          {!me && <LineLoginCard variant="signin" back="/print" />}
          <h1 className="text-xl font-bold">อัปโหลดไฟล์งาน</h1>
          <Dropzone onFiles={onFiles} maxMb={settings.maxFileMb} />
          <button type="button" className="btn-secondary w-full" onClick={() => setPicker(true)}>
            ↻ เลือกจากไฟล์ที่เคยสั่ง
          </button>
          {items.map((it) => (
            <UploadRow key={it.key} item={it} settings={settings} onRemove={() => remove(it.key)} />
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
              problem={itemProblems[it.key] ?? null}
              onChange={(p) => update(it.key, p)}
              onRemove={() => remove(it.key)}
            />
          ))}
          <div className="grid grid-cols-2 gap-2">
            <Dropzone compact onFiles={onFiles} maxMb={settings.maxFileMb} />
            <button type="button" className="btn-secondary w-full" onClick={() => setPicker(true)}>
              ↻ ไฟล์ที่เคยสั่ง
            </button>
          </div>
          <PriceTable settings={settings} total={quote.totalSheets} />
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <h1 className="text-xl font-bold">ที่อยู่จัดส่ง</h1>
          <div className="card">
            <AddressForm value={customer} onChange={setCustomer} errors={addrErrors} />
          </div>
          <LineLoginCard />
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <h1 className="text-xl font-bold">สรุปและชำระเงิน</h1>
          <div className="card space-y-3">
            {a5Ok.length > 0 && (
              <div className="space-y-2 border-b border-line pb-3">
                <p className="text-sm font-bold">
                  สติกเกอร์สำเร็จรูป A5 · {a5q.sheets} แผ่น × {baht(a5q.tier.price)}
                  <Link href="/cart" className="ml-2 text-xs font-normal text-brand-600 underline">
                    แก้ไข
                  </Link>
                </p>
                {a5Ok.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 text-sm">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                      {r.design?.thumbUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.design.thumbUrl} alt="" className="h-full w-full object-contain" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{r.product!.name}</p>
                      <p className="text-xs text-muted">
                        {r.design!.sku} {r.design!.name}
                        {r.size && ` · ${r.size.name}`}
                      </p>
                    </div>
                    <span className="shrink-0 text-muted">×{r.line.qty}</span>
                    <span className="w-16 shrink-0 text-right font-semibold">{baht(a5q.lines[idx]?.lineTotal ?? 0)}</span>
                  </div>
                ))}
              </div>
            )}
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
                    ไดคัท{shapeLabel(it.shape)} {sizeText(it)}
                    {it.widthMm && it.heightMm ? ` · แผ่นละ ~${perSheet(it.widthMm, it.heightMm, settings, it.shape)} ดวง` : ""}
                  </p>
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
              {a5q.sheets > 0 && <Row label={`สติกเกอร์ A5 ${a5q.sheets} แผ่น`} value={baht(a5q.subtotal)} />}
              {quote.totalSheets > 0 && <Row label={`งานพิมพ์ ${settings.sheetName} ${quote.totalSheets} แผ่น`} value={baht(quote.subtotal)} />}
              {quote.fixFeeTotal > 0 && <Row label="ค่าบริการแก้ไฟล์" value={baht(quote.fixFeeTotal)} />}
              <Row label="ค่าส่ง" value={totals.shipping ? baht(totals.shipping) : "ส่งฟรี"} />
              {quote.freeSheets > 0 && <Row label="แผ่นแถม" value={`${quote.freeSheets} แผ่น`} />}
              <div className="flex items-center justify-between pt-2 text-lg font-bold">
                <span>ยอดชำระ</span>
                <span className="text-brand-600">{baht(totals.total)}</span>
              </div>
            </div>
          </div>

          <PromoBox
            enabled={settings.promo.enabled && items.length > 0}
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
            <h2 className="font-bold">ชำระเงิน {baht(totals.total)}</h2>
            <PaymentInfo settings={settings} amount={totals.total} />
            <SlipUploader value={slip} onChange={setSlip} />
          </div>

          <label className="flex cursor-pointer items-start gap-3 px-1 text-sm">
            <input type="checkbox" className="mt-0.5 h-5 w-5 accent-brand-500" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              ยินยอมให้ร้านเก็บและใช้ชื่อ เบอร์โทร ที่อยู่ และไฟล์งาน เพื่อผลิตและจัดส่งสินค้า และให้เครื่องนี้จำข้อมูลไว้สั่งครั้งต่อไป
              (ออกจากระบบได้ทุกเมื่อ) ตาม{" "}
              <Link href="/privacy" target="_blank" className="font-medium text-brand-600 underline">
                นโยบายความเป็นส่วนตัว
              </Link>
            </span>
          </label>
        </section>
      )}


      {/* แถบล่าง: ยอดรวม + ปุ่มไปต่อ */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-xl px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          {/* ข้อความผิดพลาดอยู่ในแถบล่าง เห็นเสมอไม่ต้องเลื่อนหา */}
          {visibleError && (
            <p role="alert" className="mb-2 rounded-xl bg-bad-bg px-3 py-2 text-sm font-semibold text-bad">
              {visibleError}
            </p>
          )}
          {step >= 1 && (quote.totalSheets > 0 || a5q.sheets > 0) && (
            <div className="mb-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted">
                  {[quote.totalSheets ? `${settings.sheetName} ${quote.totalSheets} แผ่น` : null, a5q.sheets ? `A5 ${a5q.sheets} แผ่น` : null]
                    .filter(Boolean)
                    .join(" + ")}{" "}
                  {totals.shipping ? `· ค่าส่ง ${totals.shipping}` : "· ส่งฟรี"}
                </span>
                <span className="text-lg font-bold">{baht(totals.total)}</span>
              </div>
              {quote.nudge && <p className="text-sm font-medium text-brand-600">✨ {nudgeText(quote.nudge)}</p>}
              {a5q.nudge && step >= STEP_ADDRESS && <p className="text-sm font-medium text-brand-600">✨ {a5NudgeText(a5q.nudge)}</p>}
            </div>
          )}
          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => (step === STEP_ADDRESS && !items.length ? router.push("/cart") : go(step - 1))}
              >
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

function DoneScreen({
  orderNo,
  token,
  contactLine,
  messages,
  name,
}: {
  orderNo: string;
  token: string;
  contactLine: string;
  messages: string[];
  name: string;
}) {
  const [blessing] = useState(() => pickMessage(messages, name));
  const url = typeof window !== "undefined" ? `${window.location.origin}/o/${token}` : `/o/${token}`;
  return (
    <div className="mx-auto max-w-xl px-4 py-10 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-ok-bg text-4xl text-ok">✓</div>
      <h1 className="mt-4 text-2xl font-bold">ส่งออเดอร์เรียบร้อย</h1>
      <p className="mt-1 text-muted">ร้านจะตรวจสลิปและเริ่มผลิตให้เร็วที่สุด</p>
      {blessing && (
        <p className="mx-auto mt-4 max-w-md rounded-2xl bg-gradient-to-br from-brand-50 to-amber-50 px-4 py-3 text-lg font-semibold text-brand-700">
          {blessing}
        </p>
      )}
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
        <div className="flex items-center gap-2 rounded-xl bg-gray-50 p-2 pl-3">
          <p className="min-w-0 flex-1 break-all text-sm">{url}</p>
          <CopyButton text={url} label="คัดลอกลิงก์" className="shrink-0" />
        </div>
        <Link href={`/o/${token}`} className="btn-primary btn-sm w-full">
          ไปหน้าเช็คสถานะ
        </Link>
        <p className="text-sm text-muted">
          ดูสถานะได้อีกทางที่หน้า <Link href="/track" className="text-brand-600 underline">เช็คสถานะ</Link> ด้วยเลขออเดอร์ + เบอร์โทร
          {contactLine && <> หรือพิมพ์เลขออเดอร์ใน LINE {contactLine}</>}
        </p>
      </div>
    </div>
  );
}
