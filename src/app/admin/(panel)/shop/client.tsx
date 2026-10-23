"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, Spinner } from "@/components/ui";
import { uploadImages } from "@/lib/client/catalog-upload";
import {
  deleteCategory,
  deleteDesigner,
  reorderCategories,
  reorderProducts,
  saveCategory,
  saveDesigner,
  setProductActive,
} from "../../shop-actions";
import { Sortable } from "../sortable";

type Result = { ok: true; message?: string } | { ok: false; error: string };

function useAction() {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<Result | null>(null);
  const router = useRouter();
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setRes(r);
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });
  return { pending, res, run };
}

function Note({ res }: { res: Result | null }) {
  if (!res) return null;
  if (!res.ok) return <Alert tone="bad">{res.error}</Alert>;
  return res.message ? <p className="text-sm text-ok">{res.message}</p> : null;
}

/** สวิตช์เปิด/ปิด */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? "bg-ok" : "bg-gray-300"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

// ---------- รายการสินค้า ----------

interface ProductRow {
  id: string;
  name: string;
  categoryId: string | null;
  coverUrl: string | null;
  designs: number;
  activeDesigns: number;
  badgeBest: boolean;
  badgeNew: boolean;
  active: boolean;
  sold: number;
}

export function ProductList({ products, categories }: { products: ProductRow[]; categories: { id: string; name: string }[] }) {
  const [list, setList] = useState(products);
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const { pending, res, run } = useAction();
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "ไม่มีหมวด";
  const filtered = cat === "all" && !q;
  const shown = list.filter((p) => (cat === "all" || (p.categoryId ?? "none") === cat) && (!q || p.name.toLowerCase().includes(q.toLowerCase())));

  const row = (p: ProductRow, handle?: React.ReactNode) => (
    <div className={`card flex items-center gap-3 !p-3 ${p.active ? "" : "opacity-60"}`}>
      {handle}
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-50">
        {p.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.coverUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <Link href={`/admin/shop/${p.id}`} className="min-w-0 flex-1">
        <p className="truncate font-semibold hover:underline">{p.name}</p>
        <p className="text-xs text-muted">
          {catName(p.categoryId)} · {p.activeDesigns}/{p.designs} ลายเปิดขาย · ขายแล้ว {p.sold} แผ่น
        </p>
        <p className="mt-0.5 flex gap-1">
          {p.badgeBest && <span className="rounded-full bg-brand-500 px-2 text-[11px] font-bold text-white">ขายดี</span>}
          {p.badgeNew && <span className="rounded-full bg-amber-400 px-2 text-[11px] font-bold text-white">ใหม่</span>}
          {!p.activeDesigns && <span className="rounded-full bg-gray-100 px-2 text-[11px] text-muted">ยังไม่มีลายเปิดขาย ไม่แสดงหน้าร้าน</span>}
        </p>
      </Link>
      <Toggle
        on={p.active}
        label={`เปิดขาย ${p.name}`}
        onChange={(v) => {
          setList((xs) => xs.map((x) => (x.id === p.id ? { ...x, active: v } : x)));
          run(() => setProductActive(p.id, v));
        }}
      />
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input className="input max-w-xs" placeholder="ค้นชื่อสินค้า" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input max-w-xs" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="all">ทุกหมวด</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="none">ไม่มีหมวด</option>
        </select>
        {pending && <Spinner />}
      </div>
      <Note res={res} />
      {!list.length && <p className="card text-center text-muted">ยังไม่มีสินค้า กด &quot;+ เพิ่มสินค้า&quot; เพื่อเริ่ม</p>}
      {filtered ? (
        <>
          <p className="text-xs text-muted">ลำดับนี้ใช้เป็นลำดับเริ่มต้นในหน้าร้าน ลากหรือกด ↑↓ เพื่อเรียง</p>
          <Sortable
            items={list}
            getKey={(p) => p.id}
            onChange={(xs) => {
              setList(xs);
              run(() => reorderProducts(xs.map((x) => x.id)));
            }}
          >
            {(p, _i, handle) => row(p, handle)}
          </Sortable>
        </>
      ) : (
        <div className="space-y-2">{shown.map((p) => <div key={p.id}>{row(p)}</div>)}</div>
      )}
    </div>
  );
}

// ---------- หมวดหมู่ ----------

interface Cat {
  id: string;
  name: string;
  iconPath: string | null;
  iconUrl: string | null;
}

function IconPicker({ url, onPick, busy }: { url: string | null; onPick: (f: File) => void; busy?: boolean }) {
  return (
    <label className="relative flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-brand-50 text-xs text-brand-600 ring-1 ring-line">
      {busy ? (
        <Spinner />
      ) : url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        "ไอคอน"
      )}
      <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} />
    </label>
  );
}

export function CategoryManager({ initial, counts }: { initial: Cat[]; counts: Record<string, number> }) {
  const [list, setList] = useState(initial);
  const [draft, setDraft] = useState<Cat>({ id: "", name: "", iconPath: null, iconUrl: null });
  const [uploading, setUploading] = useState<string | null>(null);
  const { pending, res, run } = useAction();

  async function pickIcon(f: File, apply: (p: { iconPath: string; iconUrl: string }) => void, key: string) {
    setUploading(key);
    try {
      const [img] = await uploadImages([f], { max: 256, thumb: 128 });
      apply({ iconPath: img.path, iconUrl: img.url });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="card space-y-3">
        <p className="font-semibold">เพิ่มหมวดหมู่</p>
        <div className="flex items-center gap-3">
          <IconPicker url={draft.iconUrl} busy={uploading === "new"} onPick={(f) => pickIcon(f, (p) => setDraft((d) => ({ ...d, ...p })), "new")} />
          <input className="input" placeholder="ชื่อหมวดหมู่ เช่น ร้านกาแฟ" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <button
            type="button"
            className="btn-primary shrink-0"
            disabled={pending || !draft.name.trim()}
            onClick={() => run(() => saveCategory({ name: draft.name, iconPath: draft.iconPath }), () => setDraft({ id: "", name: "", iconPath: null, iconUrl: null }))}
          >
            เพิ่ม
          </button>
        </div>
      </div>
      <Note res={res} />
      <p className="text-xs text-muted">ลำดับนี้ใช้กับปุ่มหมวดหมู่หน้าแรก ลากหรือกด ↑↓ เพื่อเรียง</p>
      <Sortable
        items={list}
        getKey={(c) => c.id}
        onChange={(xs) => {
          setList(xs);
          run(() => reorderCategories(xs.map((x) => x.id)));
        }}
      >
        {(c, i, handle) => (
          <div className="card flex items-center gap-3 !p-3">
            {handle}
            <IconPicker
              url={c.iconUrl}
              busy={uploading === c.id}
              onPick={(f) =>
                pickIcon(
                  f,
                  (p) => {
                    setList((xs) => xs.map((x) => (x.id === c.id ? { ...x, ...p } : x)));
                    run(() => saveCategory({ id: c.id, name: c.name, iconPath: p.iconPath }));
                  },
                  c.id,
                )
              }
            />
            <input
              className="input"
              value={c.name}
              aria-label={`ชื่อหมวด ${i + 1}`}
              onChange={(e) => setList((xs) => xs.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))}
              onBlur={() => initial.find((x) => x.id === c.id)?.name !== c.name && run(() => saveCategory({ id: c.id, name: c.name, iconPath: c.iconPath }))}
            />
            <span className="hidden shrink-0 text-xs text-muted sm:inline">{counts[c.id] ?? 0} สินค้า</span>
            <button
              type="button"
              className="btn-ghost btn-sm shrink-0 text-bad"
              onClick={() => {
                if (!confirm(`ลบหมวด "${c.name}"? สินค้าในหมวดนี้จะย้ายไป "ไม่มีหมวด"`)) return;
                setList((xs) => xs.filter((x) => x.id !== c.id));
                run(() => deleteCategory(c.id));
              }}
            >
              ลบ
            </button>
          </div>
        )}
      </Sortable>
    </div>
  );
}

// ---------- นักออกแบบ ----------

export function DesignerManager({ initial, counts }: { initial: { id: string; name: string; active: boolean }[]; counts: Record<string, number> }) {
  const [list, setList] = useState(initial);
  const [name, setName] = useState("");
  const { pending, res, run } = useAction();
  return (
    <div className="space-y-3">
      <div className="card flex gap-2">
        <input className="input" placeholder="ชื่อนักออกแบบ" value={name} onChange={(e) => setName(e.target.value)} />
        <button
          type="button"
          className="btn-primary shrink-0"
          disabled={pending || !name.trim()}
          onClick={() => run(() => saveDesigner({ name, active: true }), () => setName(""))}
        >
          เพิ่ม
        </button>
      </div>
      <Note res={res} />
      <p className="text-xs text-muted">ใช้เลือกในหน้าสินค้า และแยกยอดในรายงานเพื่อคิดค่าคอมมิชชั่น ปิดใช้งาน = ไม่แสดงให้เลือกในสินค้าใหม่</p>
      {list.map((d) => (
        <div key={d.id} className="card flex items-center gap-3 !p-3">
          <input
            className="input"
            value={d.name}
            onChange={(e) => setList((xs) => xs.map((x) => (x.id === d.id ? { ...x, name: e.target.value } : x)))}
            onBlur={() => initial.find((x) => x.id === d.id)?.name !== d.name && run(() => saveDesigner(d))}
          />
          <span className="shrink-0 text-xs text-muted">{counts[d.id] ?? 0} สินค้า</span>
          <Toggle
            on={d.active}
            label={`ใช้งาน ${d.name}`}
            onChange={(v) => {
              setList((xs) => xs.map((x) => (x.id === d.id ? { ...x, active: v } : x)));
              run(() => saveDesigner({ ...d, active: v }));
            }}
          />
          <button
            type="button"
            className="btn-ghost btn-sm shrink-0 text-bad"
            onClick={() => {
              if (!confirm(`ลบ "${d.name}"?`)) return;
              setList((xs) => xs.filter((x) => x.id !== d.id));
              run(() => deleteDesigner(d.id));
            }}
          >
            ลบ
          </button>
        </div>
      ))}
    </div>
  );
}
