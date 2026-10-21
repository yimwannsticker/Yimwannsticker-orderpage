"use client";

import { useEffect, useState } from "react";
import { guessZip, parseAddress, type ZipEntry } from "@/lib/address-parse";
import { phoneProblem } from "@/lib/format";
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

const zipCache = new Map<string, ZipEntry[]>();
async function loadZip(zip: string): Promise<ZipEntry[]> {
  if (zipCache.has(zip)) return zipCache.get(zip)!;
  const res = await fetch(`/api/address?zip=${zip}`);
  const json = (await res.json()) as { entries: ZipEntry[] };
  zipCache.set(zip, json.entries);
  return json.entries;
}

export function AddressForm({ value, onChange }: { value: CustomerForm; onChange: (v: CustomerForm) => void }) {
  const [paste, setPaste] = useState("");
  const [zipData, setZipData] = useState<{ zip: string; entries: ZipEntry[] } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneError = phoneProblem(value.phone);
  const a = value.address;
  const setAddr = (p: Partial<Address>) => onChange({ ...value, address: { ...a, ...p } });
  const entries = zipData?.zip === a.zipcode ? zipData.entries : [];

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
      <div className="rounded-2xl bg-brand-50 p-3">
        <label htmlFor="paste" className="label">
          วางที่อยู่ทั้งก้อน (ไม่บังคับ)
        </label>
        <textarea
          id="paste"
          rows={3}
          className="input min-h-24 py-3"
          placeholder={"เช่น สมหญิง ใจดี 0812345678\n99/1 ม.3 ต.สุเทพ อ.เมืองเชียงใหม่ จ.เชียงใหม่ 50200"}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
        />
        <button type="button" className="btn-secondary mt-2 w-full" onClick={doParse} disabled={!paste.trim()}>
          แยกเป็นช่องให้อัตโนมัติ
        </button>
        {msg && <p className="mt-2 text-sm text-ok">{msg}</p>}
      </div>

      <div>
        <label className="label" htmlFor="name">
          ชื่อผู้รับ
        </label>
        <input id="name" className="input" autoComplete="name" value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
      </div>
      <div>
        <label className="label" htmlFor="phone">
          เบอร์โทร
        </label>
        <input
          id="phone"
          className="input"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0812345678"
          maxLength={13}
          aria-invalid={Boolean(phoneError)}
          aria-describedby="phone-hint"
          value={value.phone}
          onChange={(e) => onChange({ ...value, phone: e.target.value.replace(/[^\d\s+-]/g, "") })}
          onBlur={() => setPhoneTouched(true)}
        />
        {phoneTouched && phoneError ? (
          <p id="phone-hint" className="mt-1 text-sm font-medium text-bad">
            {phoneError}
          </p>
        ) : (
          <p id="phone-hint" className="mt-1 text-xs text-muted">
            เบอร์มือถือ 10 หลัก ใช้เช็คสถานะออเดอร์และนับยอดสะสมโปร
          </p>
        )}
      </div>
      <div>
        <label className="label" htmlFor="line1">
          บ้านเลขที่ หมู่ ซอย ถนน
        </label>
        <input
          id="line1"
          className="input"
          autoComplete="street-address"
          value={a.line1}
          onChange={(e) => setAddr({ line1: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="zip">
            รหัสไปรษณีย์
          </label>
          <input
            id="zip"
            className="input"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            value={a.zipcode}
            onChange={(e) => setAddr({ zipcode: e.target.value.replace(/\D/g, "").slice(0, 5) })}
          />
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
          <input id="dist" className="input" value={a.district} onChange={(e) => setAddr({ district: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="prov">
            จังหวัด
          </label>
          <input id="prov" className="input" value={a.province} onChange={(e) => setAddr({ province: e.target.value })} />
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
