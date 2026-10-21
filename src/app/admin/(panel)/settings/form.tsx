"use client";

import { useState, useTransition } from "react";
import { Spinner } from "@/components/ui";
import type { PriceTier, Settings } from "@/lib/types";
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
}: {
  initial: Settings;
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

      <Section title="ตรวจไฟล์และขนาดแผ่น">
        <div className="grid gap-4 sm:grid-cols-2">
          <Num label="พร้อมพิมพ์ (สีเขียว) ตั้งแต่" value={s.dpiGood} onChange={(v) => set("dpiGood", v)} suffix="DPI" />
          <Num label="พิมพ์ได้แต่ระวัง (สีเหลือง) ตั้งแต่" value={s.dpiMin} onChange={(v) => set("dpiMin", v)} suffix="DPI" hint="ต่ำกว่านี้ = สีแดง ต้องแก้ไฟล์" />
          <Text label="ชื่อขนาดแผ่น" value={s.sheetName} onChange={(v) => set("sheetName", v)} />
          <div className="grid grid-cols-2 gap-2">
            <Num label="กว้าง" value={s.sheetWidthMm} onChange={(v) => set("sheetWidthMm", v)} suffix="มม." />
            <Num label="ยาว" value={s.sheetHeightMm} onChange={(v) => set("sheetHeightMm", v)} suffix="มม." />
          </div>
          <Num label="ขนาดไฟล์สูงสุด" value={s.maxFileMb} onChange={(v) => set("maxFileMb", v)} suffix="MB" hint="Supabase แพ็กเกจฟรีรับได้ไฟล์ละ 50MB" />
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

      <Section title="ร้าน">
        <Text label="ชื่อร้าน" value={s.shopName} onChange={(v) => set("shopName", v)} />
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
