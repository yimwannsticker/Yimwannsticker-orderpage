"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { guessZip, parseAddress, type ZipEntry } from "@/lib/address-parse";
import { addressKey, formatAddress, isValidPhone, normalizePhone, phoneProblem, thaiDate } from "@/lib/format";
import type { Address } from "@/lib/types";
import { Alert } from "../ui";

export interface CustomerForm {
  name: string;
  phone: string;
  address: Address;
  note: string;
}

export const EMPTY_CUSTOMER: CustomerForm = {
  name: "",
  phone: "",
  address: { line1: "", subdistrict: "", district: "", province: "", zipcode: "" },
  note: "",
};

export type AddressField = "name" | "phone" | "line1" | "zip" | "dist" | "prov";

/** ช่องที่ยังกรอกไม่ครบ/ไม่ถูกต้อง เรียงตามลำดับบนหน้าจอ */
export function addressErrors(v: CustomerForm): Partial<Record<AddressField, string>> {
  const e: Partial<Record<AddressField, string>> = {};
  if (!v.name.trim()) e.name = "กรุณากรอกชื่อผู้รับ";
  if (!v.phone.trim()) e.phone = "กรุณากรอกเบอร์โทร 10 หลัก";
  else if (phoneProblem(v.phone)) e.phone = phoneProblem(v.phone)!;
  if (!v.address.line1.trim()) e.line1 = "กรุณากรอกบ้านเลขที่ / ถนน";
  if (!/^\d{5}$/.test(v.address.zipcode)) e.zip = v.address.zipcode ? "รหัสไปรษณีย์ต้องมี 5 หลัก" : "กรุณากรอกรหัสไปรษณีย์";
  if (!v.address.district.trim()) e.dist = "กรุณากรอกอำเภอ / เขต";
  if (!v.address.province.trim()) e.prov = "กรุณากรอกจังหวัด";
  return e;
}

/** กรอบแดงสำหรับช่องที่กรอกผิด */
export const INVALID_INPUT = "!border-bad ring-2 ring-bad/20 bg-bad-bg/40";

function FieldError({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return (
    <p id={id} className="mt-1 text-sm font-medium text-bad">
      {msg}
    </p>
  );
}

interface SavedAddress {
  address: Address;
  date: string;
  times: number;
}

const sameAddress = (a: Address, b: Address) => addressKey(a) === addressKey(b);

const isEmptyAddress = (a: Address) => !a.line1.trim() && !a.zipcode && !a.district.trim() && !a.province.trim();

/** ลูกค้าเก่า: กรอกชื่อผู้รับ + เบอร์โทรเดิมแล้วดึงที่อยู่ที่เคยใช้มาให้เลือก */
function useSavedAddresses(name: string, phone: string) {
  const [list, setList] = useState<SavedAddress[]>([]);
  const [busy, setBusy] = useState(false);
  const lastKey = useRef("");
  const lookup = useCallback(async () => {
    const p = normalizePhone(phone);
    const n = name.trim();
    if (n.length < 2 || !isValidPhone(p)) return null;
    const key = `${n}|${p}`;
    if (key === lastKey.current) return null;
    lastKey.current = key;
    setBusy(true);
    try {
      const res = await fetch("/api/my-addresses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: n, phone: p }),
      });
      const found = res.ok ? ((await res.json()) as { addresses: SavedAddress[] }).addresses : [];
      setList(found);
      return found;
    } catch {
      lastKey.current = "";
      return null;
    } finally {
      setBusy(false);
    }
  }, [name, phone]);
  return { list, busy, lookup };
}

const zipCache = new Map<string, ZipEntry[]>();
async function loadZip(zip: string): Promise<ZipEntry[]> {
  if (zipCache.has(zip)) return zipCache.get(zip)!;
  const res = await fetch(`/api/address?zip=${zip}`);
  const json = (await res.json()) as { entries: ZipEntry[] };
  zipCache.set(zip, json.entries);
  return json.entries;
}

export function AddressForm({
  value,
  onChange,
  errors = {},
}: {
  value: CustomerForm;
  onChange: (v: CustomerForm) => void;
  /** ช่องที่ต้องไฮไลต์ (หลังกด "ถัดไป" แล้วยังไม่ครบ) */
  errors?: Partial<Record<AddressField, string>>;
}) {
  const [paste, setPaste] = useState("");
  const [zipData, setZipData] = useState<{ zip: string; entries: ZipEntry[] } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneError = phoneProblem(value.phone);
  const a = value.address;
  const setAddr = (p: Partial<Address>) => onChange({ ...value, address: { ...a, ...p } });
  const entries = zipData?.zip === a.zipcode ? zipData.entries : [];
  const saved = useSavedAddresses(value.name, value.phone);

  async function findSaved() {
    const found = await saved.lookup();
    // มีที่อยู่เดียวและยังไม่ได้กรอก → ใส่ให้เลย
    if (found?.length === 1 && isEmptyAddress(a)) onChange({ ...value, address: { ...found[0].address } });
  }

  // เบอร์ครบ 10 หลัก (หรือกรอกมาแล้วจากหน้าเลือกไฟล์เดิม) → หาที่อยู่เดิมทันที
  const phoneReady = isValidPhone(normalizePhone(value.phone));
  useEffect(() => {
    if (phoneReady) findSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneReady]);

  // รหัสไปรษณีย์ครบ 5 หลัก → ดึงตำบล/อำเภอ/จังหวัด
  useEffect(() => {
    let alive = true;
    if (!/^\d{5}$/.test(a.zipcode)) return;
    const zip = a.zipcode;
    loadZip(zip).then((list) => {
      if (!alive) return;
      setZipData({ zip, entries: list });
      if (!list.length) return;
      const match = list.find((e) => e[0] === a.subdistrict);
      if (match) {
        if (match[1] !== a.district || match[2] !== a.province) setAddr({ district: match[1], province: match[2] });
      } else if (list.length === 1) {
        setAddr({ subdistrict: list[0][0], district: list[0][1], province: list[0][2] });
      } else if (!a.province) {
        setAddr({ province: list[0][2], district: new Set(list.map((e) => e[1])).size === 1 ? list[0][1] : a.district });
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.zipcode]);

  async function doParse() {
    if (!paste.trim()) return;
    const zip = guessZip(paste);
    const list = zip ? await loadZip(zip) : null;
    const r = parseAddress(paste, list);
    onChange({
      ...value,
      name: r.name || value.name,
      phone: r.phone || value.phone,
      address: {
        line1: r.line1 || a.line1,
        subdistrict: r.subdistrict,
        district: r.district,
        province: r.province,
        zipcode: r.zipcode || a.zipcode,
      },
    });
    setMsg("แยกที่อยู่ให้แล้ว กรุณาตรวจสอบความถูกต้องอีกครั้ง");
  }

  const subOptions = entries.map((e) => e[0]);

  return (
    <div className="space-y-4">
      {saved.list.length === 0 && (
        <div className="flex gap-2 rounded-2xl border border-brand-200 bg-brand-50 p-3 text-sm">
          <span aria-hidden>💡</span>
          <p>
            <b>เคยสั่งกับร้านแล้ว?</b> กรอกแค่ชื่อผู้รับและเบอร์โทรเดิม ที่อยู่เก่าจะขึ้นมาให้กดเลือกเลย ไม่ต้องพิมพ์ใหม่
          </p>
        </div>
      )}
      <div>
        <label className="label" htmlFor="name">
          ชื่อผู้รับ
        </label>
        <input
          id="name"
          className={`input ${errors.name ? INVALID_INPUT : ""}`}
          aria-invalid={Boolean(errors.name)}
          autoComplete="name"
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          onBlur={findSaved}
        />
        <FieldError id="name-err" msg={errors.name} />
      </div>
      <div>
        <label className="label" htmlFor="phone">
          เบอร์โทร
        </label>
        <input
          id="phone"
          className={`input ${errors.phone || (phoneTouched && phoneError) ? INVALID_INPUT : ""}`}
          inputMode="tel"
          autoComplete="tel"
          placeholder="0812345678"
          maxLength={13}
          aria-invalid={Boolean(errors.phone || (phoneTouched && phoneError))}
          aria-describedby="phone-hint"
          value={value.phone}
          onChange={(e) => onChange({ ...value, phone: e.target.value.replace(/[^\d\s+-]/g, "") })}
          onBlur={() => {
            setPhoneTouched(true);
            findSaved();
          }}
        />
        {errors.phone || (phoneTouched && phoneError) ? (
          <p id="phone-hint" className="mt-1 text-sm font-medium text-bad">
            {errors.phone ?? phoneError}
          </p>
        ) : (
          <p id="phone-hint" className="mt-1 text-xs text-muted">
            เบอร์มือถือ 10 หลัก ใช้เช็คสถานะออเดอร์และนับยอดสะสมโปร
          </p>
        )}
      </div>
      {saved.busy && <p className="text-sm text-muted">กำลังหาที่อยู่ที่เคยใช้...</p>}
      {saved.list.length > 0 && (
        <div role="radiogroup" aria-label="ที่อยู่ที่เคยใช้" className="space-y-2">
          <p className="label mb-0">ที่อยู่ที่เคยใช้ {saved.list.length > 1 && <span className="font-normal text-muted">(แตะเพื่อเลือก)</span>}</p>
          {saved.list.map((s, i) => {
            const on = sameAddress(s.address, a);
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange({ ...value, address: { ...s.address } })}
                className={`flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left transition ${
                  on ? "border-brand-500 bg-brand-50" : "border-gray-200 bg-white hover:border-brand-200"
                }`}
              >
                <span
                  className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    on ? "border-brand-500 bg-brand-500 text-xs text-white" : "border-gray-300"
                  }`}
                >
                  {on && "✓"}
                </span>
                <span className="min-w-0">
                  <span className="block">{formatAddress(s.address)}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    ใช้ล่าสุด {thaiDate(s.date)}
                    {s.times > 1 && ` · ใช้ ${s.times} ครั้ง`}
                  </span>
                </span>
              </button>
            );
          })}
          {saved.list.some((s) => sameAddress(s.address, a)) && (
            <button
              type="button"
              className="text-sm text-brand-600 underline"
              onClick={() => onChange({ ...value, address: { ...EMPTY_CUSTOMER.address } })}
            >
              ส่งที่อยู่ใหม่ (ล้างช่องที่อยู่)
            </button>
          )}
        </div>
      )}
      {!saved.list.some((x) => sameAddress(x.address, a)) && (
        <div className="rounded-2xl bg-brand-50 p-3">
          <label htmlFor="paste" className="label">
            {saved.list.length ? "ส่งที่อยู่ใหม่? วางทั้งก้อนได้เลย" : "วางที่อยู่ทั้งก้อน"}{" "}
            <span className="font-normal text-muted">(ไม่บังคับ)</span>
          </label>
          <textarea
            id="paste"
            rows={3}
            className="input min-h-24 py-3"
            placeholder={"เช่น 99/1 ม.3 ต.สุเทพ อ.เมืองเชียงใหม่ จ.เชียงใหม่ 50200"}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <button type="button" className="btn-secondary mt-2 w-full" onClick={doParse} disabled={!paste.trim()}>
            แยกเป็นช่องให้อัตโนมัติ
          </button>
          {msg && <p className="mt-2 text-sm text-ok">{msg}</p>}
        </div>
      )}
      <div>
        <label className="label" htmlFor="line1">
          บ้านเลขที่ หมู่ ซอย ถนน
        </label>
        <input
          id="line1"
          className={`input ${errors.line1 ? INVALID_INPUT : ""}`}
          aria-invalid={Boolean(errors.line1)}
          autoComplete="street-address"
          value={a.line1}
          onChange={(e) => setAddr({ line1: e.target.value })}
        />
        <FieldError id="line1-err" msg={errors.line1} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="zip">
            รหัสไปรษณีย์
          </label>
          <input
            id="zip"
            className={`input ${errors.zip ? INVALID_INPUT : ""}`}
            aria-invalid={Boolean(errors.zip)}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            value={a.zipcode}
            onChange={(e) => setAddr({ zipcode: e.target.value.replace(/\D/g, "").slice(0, 5) })}
          />
          <FieldError id="zip-err" msg={errors.zip} />
        </div>
        <div>
          <label className="label" htmlFor="sub">
            ตำบล / แขวง
          </label>
          {subOptions.length > 1 ? (
            <select
              id="sub"
              className="input"
              value={a.subdistrict}
              onChange={(e) => {
                const m = entries.find((x) => x[0] === e.target.value);
                setAddr(m ? { subdistrict: m[0], district: m[1], province: m[2] } : { subdistrict: e.target.value });
              }}
            >
              <option value="">เลือก...</option>
              {subOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : (
            <input id="sub" className="input" value={a.subdistrict} onChange={(e) => setAddr({ subdistrict: e.target.value })} />
          )}
        </div>
        <div>
          <label className="label" htmlFor="dist">
            อำเภอ / เขต
          </label>
          <input
            id="dist"
            className={`input ${errors.dist ? INVALID_INPUT : ""}`}
            aria-invalid={Boolean(errors.dist)}
            value={a.district}
            onChange={(e) => setAddr({ district: e.target.value })}
          />
          <FieldError id="dist-err" msg={errors.dist} />
        </div>
        <div>
          <label className="label" htmlFor="prov">
            จังหวัด
          </label>
          <input
            id="prov"
            className={`input ${errors.prov ? INVALID_INPUT : ""}`}
            aria-invalid={Boolean(errors.prov)}
            value={a.province}
            onChange={(e) => setAddr({ province: e.target.value })}
          />
          <FieldError id="prov-err" msg={errors.prov} />
        </div>
      </div>
      {zipData?.zip === a.zipcode && entries.length === 0 && (
        <Alert tone="warn">ไม่พบรหัสไปรษณีย์นี้ในระบบ กรุณาตรวจสอบ หรือกรอกตำบล/อำเภอ/จังหวัดเอง</Alert>
      )}
      <div>
        <label className="label" htmlFor="note">
          หมายเหตุถึงร้าน (ไม่บังคับ)
        </label>
        <textarea id="note" rows={2} className="input min-h-20 py-3" value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })} />
      </div>
    </div>
  );
}
