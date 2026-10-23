"use client";

import { useState, useTransition } from "react";
import { Spinner } from "@/components/ui";
import { parseMessageLines } from "@/lib/greeting";
import { uploadImages } from "@/lib/client/catalog-upload";
import type { A5Tier, PriceTier, Settings } from "@/lib/types";
import { Sortable } from "../sortable";
import { updateSettings } from "../../actions";
import { ResultNote } from "../ui";

type Result = { ok: true; message?: string } | { ok: false; error: string };

function Num({
  label,
  value,
  onChange,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="flex items-center gap-2">
        <input
          className="input"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
        />
        {suffix && <span className="shrink-0 text-sm text-muted">{suffix}</span>}
      </div>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function Text({ label, value, onChange, hint, multiline }: { label: string; value: string; onChange: (s: string) => void; hint?: string; multiline?: boolean }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {multiline ? (
        <textarea className="input min-h-24 py-2" value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

/** รายการข้อความ แก้เป็นข้อความหลายบรรทัด (1 บรรทัด = 1 ข้อความ) */
function Lines({ label, value, onChange, hint }: { label: string; value: string[]; onChange: (v: string[]) => void; hint?: string }) {
  const [text, setText] = useState(value.join("\n"));
  return (
    <label className="block">
      <span className="label">{label}</span>
      <textarea
        className="input min-h-56 py-2 leading-relaxed"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseMessageLines(e.target.value));
        }}
      />
      <span className="mt-1 block text-xs text-muted">
        {value.length} ข้อความ{hint ? ` · ${hint}` : ""}
      </span>
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-4">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsForm({
  initial,
  env,
  bannerUrls,
}: {
  initial: Settings;
  /** ลิงก์รูปแบนเนอร์ที่บันทึกไว้แล้ว */
  bannerUrls: Record<string, string>;
  env: { lineLogin: boolean; lineMessaging: boolean; smtp: boolean; slipok: boolean; easyslip: boolean };
}) {
  const [s, setS] = useState<Settings>(initial);
  const [res, setRes] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((x) => ({ ...x, [k]: v }));
  const setTier = (i: number, p: Partial<PriceTier>) => set("tiers", s.tiers.map((t, idx) => (idx === i ? { ...t, ...p } : t)));

  return (
    <form
      className="space-y-4 pb-24"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => setRes(await updateSettings(s)));
      }}
    >
      <h1 className="text-xl font-bold">ตั้งค่า</h1>

      <Section title="ตารางราคาต่อแผ่น">
        <p className="text-sm text-muted">หาขั้นราคาจาก “จำนวนรวมทุกไฟล์ทุกประเภทในออเดอร์” แล้วคิดราคาตามประเภทของแต่ละไฟล์</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-1 font-medium">ตั้งแต่ (แผ่น)</th>
                <th className="font-medium">กระดาษขาวเงา (บาท)</th>
                <th className="font-medium">PP (บาท)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.tiers.map((t, i) => (
                <tr key={i}>
                  <td className="py-1 pr-2">
                    <input className="input" inputMode="numeric" value={t.min} onChange={(e) => setTier(i, { min: Number(e.target.value) })} />
                  </td>
                  <td className="pr-2">
                    <input className="input" inputMode="decimal" value={t.paper} onChange={(e) => setTier(i, { paper: Number(e.target.value) })} />
                  </td>
                  <td className="pr-2">
                    <input className="input" inputMode="decimal" value={t.pp} onChange={(e) => setTier(i, { pp: Number(e.target.value) })} />
                  </td>
                  <td>
                    <button type="button" className="btn-ghost btn-sm" onClick={() => set("tiers", s.tiers.filter((_, idx) => idx !== i))} disabled={s.tiers.length <= 1}>
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => {
            const last = s.tiers[s.tiers.length - 1];
            set("tiers", [...s.tiers, { min: (last?.min ?? 0) + 100, paper: last?.paper ?? 0, pp: last?.pp ?? 0 }]);
          }}
        >
          + เพิ่มขั้นราคา
        </button>
        <div className="grid gap-4 sm:grid-cols-2">
          <Num label="ขั้นต่ำต่อไฟล์" value={s.minPerFile} onChange={(v) => set("minPerFile", v)} suffix="แผ่น" />
          <Num label="ค่าบริการแก้ไฟล์ (ต่อไฟล์)" value={s.fixFileFee} onChange={(v) => set("fixFileFee", v)} suffix="บาท" />
        </div>
      </Section>

      <A5Section s={s} set={set} bannerUrls={bannerUrls} />

      <Section title="ค่าส่ง">
        <div className="grid gap-4 sm:grid-cols-2">
          <Num label="ค่าส่ง" value={s.shippingFee} onChange={(v) => set("shippingFee", v)} suffix="บาท" />
          <Num label="ส่งฟรีเมื่อสั่งรวมตั้งแต่" value={s.freeShippingMin} onChange={(v) => set("freeShippingMin", v)} suffix="แผ่น" />
        </div>
      </Section>

      <Section title="โปรสะสม">
        <label className="flex items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-brand-500" checked={s.promo.enabled} onChange={(e) => set("promo", { ...s.promo, enabled: e.target.checked })} />
          <span className="font-medium">เปิดใช้โปรสะสม</span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Num label="ทุกๆ ยอดสะสม" value={s.promo.every} onChange={(v) => set("promo", { ...s.promo, every: v })} suffix="แผ่น" />
          <Num label="แถมฟรี" value={s.promo.free} onChange={(v) => set("promo", { ...s.promo, free: v })} suffix="แผ่น" />
        </div>
        <p className="text-xs text-muted">นับเฉพาะแผ่นที่ชำระเงินแล้ว (ไม่นับแผ่นแถม) ยึดเบอร์โทรเป็นหลัก</p>
      </Section>

      <Section title="ตรวจไฟล์ ขนาดแผ่น และการจัดเรียงดวง">
        <p className="text-sm text-muted">ความคมชัดคำนวณจากขนาดพิกเซลของไฟล์เทียบกับขนาดดวงที่ลูกค้าเลือก</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Num label="พร้อมพิมพ์ (สีเขียว) ตั้งแต่" value={s.dpiGood} onChange={(v) => set("dpiGood", v)} suffix="DPI" />
          <Num label="พิมพ์ได้แต่ระวัง (สีเหลือง) ตั้งแต่" value={s.dpiMin} onChange={(v) => set("dpiMin", v)} suffix="DPI" hint="ต่ำกว่านี้ = สีแดง ต้องแก้ไฟล์" />
          <Text label="ชื่อขนาดแผ่น" value={s.sheetName} onChange={(v) => set("sheetName", v)} />
          <div className="grid grid-cols-2 gap-2">
            <Num label="กว้าง" value={s.sheetWidthMm} onChange={(v) => set("sheetWidthMm", v)} suffix="มม." />
            <Num label="ยาว" value={s.sheetHeightMm} onChange={(v) => set("sheetHeightMm", v)} suffix="มม." />
          </div>
          <Num label="ขอบแผ่นถึงเส้นแดง (ใช้ประมาณจำนวนดวงต่อแผ่น)" value={s.sheetMarginMm} onChange={(v) => set("sheetMarginMm", v)} suffix="มม." />
          <Num label="เว้นมุมสำหรับเครื่องหมายตัด" value={s.cornerMarkMm} onChange={(v) => set("cornerMarkMm", v)} suffix="มม." hint="ใส่ 0 ถ้าไม่ต้องเว้น" />
          <Num label="ระยะห่างระหว่างดวง" value={s.stickerGapMm} onChange={(v) => set("stickerGapMm", v)} suffix="มม." />
          <Num label="ขนาดดวงเล็กสุดที่รับ" value={s.minStickerMm} onChange={(v) => set("minStickerMm", v)} suffix="มม." />
          <Num label="ขนาดไฟล์สูงสุด" value={s.maxFileMb} onChange={(v) => set("maxFileMb", v)} suffix="MB" hint="สูงสุด 200MB" />
          <Num label="ลบไฟล์อัตโนมัติหลังส่งของ" value={s.fileRetentionDays} onChange={(v) => set("fileRetentionDays", v)} suffix="วัน" />
        </div>
      </Section>

      <Section title="การชำระเงิน">
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="พร้อมเพย์ (เบอร์โทร / เลขบัตรประชาชน)" value={s.promptpayId} onChange={(v) => set("promptpayId", v)} />
          <Text label="ชื่อบัญชีพร้อมเพย์" value={s.promptpayName} onChange={(v) => set("promptpayName", v)} />
          <Text label="ธนาคาร" value={s.bankName} onChange={(v) => set("bankName", v)} />
          <Text label="เลขบัญชี" value={s.bankAccountNo} onChange={(v) => set("bankAccountNo", v)} />
          <Text label="ชื่อบัญชี" value={s.bankAccountName} onChange={(v) => set("bankAccountName", v)} />
        </div>
        <div className="rounded-2xl bg-gray-50 p-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="h-5 w-5 accent-brand-500"
              checked={s.slipVerify.enabled}
              onChange={(e) => set("slipVerify", { ...s.slipVerify, enabled: e.target.checked })}
            />
            <span className="font-medium">ตรวจสลิปอัตโนมัติ (ถ้าผ่านจะเปลี่ยนเป็น “ชำระแล้ว” ทันที)</span>
          </label>
          <select
            className="input mt-2"
            value={s.slipVerify.provider}
            onChange={(e) => set("slipVerify", { ...s.slipVerify, provider: e.target.value as "slipok" | "easyslip" })}
          >
            <option value="slipok">SlipOK {env.slipok ? "(มี API key แล้ว)" : "(ยังไม่ได้ใส่ API key)"}</option>
            <option value="easyslip">EasySlip {env.easyslip ? "(มี API key แล้ว)" : "(ยังไม่ได้ใส่ API key)"}</option>
          </select>
        </div>
      </Section>

      <Section title="การแจ้งเตือน">
        <Text label="อีเมลร้านสำหรับแจ้งออเดอร์ใหม่ / สลิปใหม่" value={s.notifyEmail} onChange={(v) => set("notifyEmail", v)} hint={env.smtp ? "ตั้งค่า SMTP แล้ว" : "ยังไม่ได้ตั้งค่า SMTP ใน env จึงยังไม่ส่งอีเมล"} />
        <Text label="LINE OA ของร้าน (แสดงให้ลูกค้า เช่น @yimwann)" value={s.contactLine} onChange={(v) => set("contactLine", v)} />
        <Text
          label="ข้อความแจ้งเลขแทร็คทาง LINE"
          multiline
          value={s.lineTrackingMessage}
          onChange={(v) => set("lineTrackingMessage", v)}
          hint="ใช้ {orderNo} {trackingNo} {carrier} แทนค่าได้ · ส่ง 1 ข้อความต่อออเดอร์เท่านั้น"
        />
        <Text label="ข้อความท้ายเวลาบอทตอบสถานะ" value={s.lineReplyFooter} onChange={(v) => set("lineReplyFooter", v)} />
        <p className="text-xs text-muted">
          LINE Login: {env.lineLogin ? "✅ พร้อม" : "❌ ยังไม่ได้ตั้งค่า"} · LINE Messaging API: {env.lineMessaging ? "✅ พร้อม" : "❌ ยังไม่ได้ตั้งค่า"}
        </p>
      </Section>

      <Section title="ข้อความแบบสุ่ม">
        <p className="text-sm text-muted">
          พิมพ์ 1 บรรทัดต่อ 1 ข้อความ ระบบสุ่มขึ้นทีละข้อความ ใส่ {"{n}"} ตรงไหน จะแทนด้วยชื่อลูกค้า (เช่น คุณ{"{n}"} → คุณสมหญิง)
          ลบหมดทุกบรรทัด = ไม่แสดงข้อความ · บันทึกแล้วขึ้นหน้าเว็บทันที
        </p>
        <Lines label="ทักทายลูกค้าเก่า (หน้าสั่งพิมพ์)" value={s.welcomeMessages} onChange={(v) => set("welcomeMessages", v)} />
        <Lines label="ขอบคุณ / อวยพร (หน้าสั่งเสร็จ)" value={s.thankYouMessages} onChange={(v) => set("thankYouMessages", v)} />
      </Section>

      <Section title="ร้าน">
        <Text label="ชื่อร้าน" value={s.shopName} onChange={(v) => set("shopName", v)} />
      </Section>

      <Section title="สำรองข้อมูล">
        <p className="text-sm text-muted">
          ฐานข้อมูลแพ็กเกจฟรีไม่มีสำรองอัตโนมัติ แนะนำให้กดดาวน์โหลดเก็บไว้สัปดาห์ละครั้ง (ไฟล์งานลูกค้าเก็บแยกอยู่ใน Cloudflare R2)
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/admin/export?format=json" className="btn-secondary">
            ดาวน์โหลดข้อมูลทั้งหมด (สำหรับกู้คืน)
          </a>
          <a href="/api/admin/export?format=csv" className="btn-secondary">
            ดาวน์โหลดรายการออเดอร์ (Excel)
          </a>
        </div>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button className="btn-primary" disabled={pending}>
            {pending ? <Spinner /> : "บันทึกการตั้งค่า"}
          </button>
          <ResultNote res={res} />
        </div>
      </div>
    </form>
  );
}

/** ราคาส่ง A5 ค่าส่ง A5 และแบนเนอร์หน้าแรก */
function A5Section({
  s,
  set,
  bannerUrls,
}: {
  s: Settings;
  set: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  bannerUrls: Record<string, string>;
}) {
  const [urls, setUrls] = useState(bannerUrls);
  const [busy, setBusy] = useState(false);
  const setTier = (i: number, p: Partial<A5Tier>) => set("a5Tiers", s.a5Tiers.map((t, idx) => (idx === i ? { ...t, ...p } : t)));
  const tiers = [...s.a5Tiers].sort((a, b) => a.min - b.min);

  async function addBanners(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const up = await uploadImages([...files], { max: 1600, thumb: 800 });
      setUrls((u) => ({ ...u, ...Object.fromEntries(up.map((x) => [x.path, x.url])) }));
      set("banners", [...s.banners, ...up.map((x) => ({ path: x.path, link: "" }))]);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Section title="สติกเกอร์สำเร็จรูป A5: ราคาส่ง">
        <p className="text-sm text-muted">หาขั้นราคาจาก “จำนวนแผ่น A5 รวมทุกสินค้าทุกลายในตะกร้า” (คิดแยกจากงานพิมพ์ไฟล์ A3+) ส่วนต่างตามขนาดตั้งในหน้าสินค้า</p>
        <table className="w-full max-w-md text-sm">
          <thead className="text-left text-muted">
            <tr>
              <th className="py-1 font-medium">ตั้งแต่ (แผ่น)</th>
              <th className="font-medium">ราคา/แผ่น (บาท)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {s.a5Tiers.map((t, i) => (
              <tr key={i}>
                <td className="py-1 pr-2">
                  <input className="input" inputMode="numeric" value={t.min} onChange={(e) => setTier(i, { min: Number(e.target.value) })} />
                </td>
                <td className="pr-2">
                  <input className="input" inputMode="decimal" value={t.price} onChange={(e) => setTier(i, { price: Number(e.target.value) })} />
                </td>
                <td>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => set("a5Tiers", s.a5Tiers.filter((_, idx) => idx !== i))} disabled={s.a5Tiers.length <= 1}>
                    ลบ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          className="btn-secondary btn-sm"
          onClick={() => {
            const last = tiers[tiers.length - 1];
            set("a5Tiers", [...s.a5Tiers, { min: (last?.min ?? 0) + 50, price: last?.price ?? 0 }]);
          }}
        >
          + เพิ่มขั้นราคา
        </button>
        <div className="grid gap-4 sm:grid-cols-2">
          <Num label="ค่าส่ง A5" value={s.a5ShippingFee} onChange={(v) => set("a5ShippingFee", v)} suffix="บาท" />
          <Num label="A5 ส่งฟรีเมื่อรวมตั้งแต่" value={s.a5FreeShippingMin} onChange={(v) => set("a5FreeShippingMin", v)} suffix="แผ่น" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Num label="ค่าส่งสินค้าราคาคงที่ (การ์ด)" value={s.fixedShippingFee} onChange={(v) => set("fixedShippingFee", v)} suffix="บาท" />
          <Num label="การ์ดส่งฟรีเมื่อรวมตั้งแต่" value={s.fixedFreeShippingUnits} onChange={(v) => set("fixedFreeShippingUnits", v)} suffix="ใบ" />
        </div>
        <p className="text-xs text-muted">
          ออเดอร์ที่มีทั้ง A5 และ A3+: คิดค่าส่งตามเกณฑ์ของแต่ละฝั่ง แล้วเก็บอันที่แพงกว่า (ส่งกล่องเดียว) · การ์ดสั่งรวมกับรายการอื่นที่ถึงยอดส่งฟรีแล้ว ส่งฟรีทั้งกล่อง · โปรสะสมนับเฉพาะ A3+
        </p>
      </Section>

      <Section title="แบนเนอร์หน้าแรก">
        <p className="text-sm text-muted">แนะนำรูปแนวนอนสัดส่วน 2:1 (เช่น 1200×600) เลื่อนอัตโนมัติ ลากหรือกด ↑↓ เพื่อเรียง</p>
        <Sortable items={s.banners} getKey={(b) => b.path} onChange={(xs) => set("banners", xs)}>
          {(b, i, handle) => (
            <div className="flex items-center gap-2 rounded-2xl border border-line p-2">
              {handle}
              <div className="h-16 w-32 shrink-0 overflow-hidden rounded-xl bg-gray-50">
                {urls[b.path] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urls[b.path]} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <input
                className="input"
                placeholder="ลิงก์เมื่อกด (ไม่บังคับ) เช่น /p/รหัสสินค้า"
                value={b.link}
                aria-label={`ลิงก์แบนเนอร์ ${i + 1}`}
                onChange={(e) => set("banners", s.banners.map((x) => (x.path === b.path ? { ...x, link: e.target.value } : x)))}
              />
              <button type="button" className="btn-ghost btn-sm text-bad" onClick={() => set("banners", s.banners.filter((x) => x.path !== b.path))}>
                ลบ
              </button>
            </div>
          )}
        </Sortable>
        <label className="btn-secondary btn-sm cursor-pointer">
          {busy ? <Spinner /> : "+ เพิ่มแบนเนอร์"}
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => addBanners(e.target.files)} />
        </label>
        <p className="text-xs text-muted">แก้แล้วกด &quot;บันทึกการตั้งค่า&quot; ด้านล่าง</p>
      </Section>
    </>
  );
}
