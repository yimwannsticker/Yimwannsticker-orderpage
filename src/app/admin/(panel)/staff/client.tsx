"use client";

import { useState, useTransition } from "react";
import { Spinner } from "@/components/ui";
import { addStaff, removeStaff, updateStaffRole } from "../../actions";
import { ActionButton, ResultNote } from "../ui";

type Role = "admin" | "graphic";
type Result = { ok: true; message?: string } | { ok: false; error: string };

export function StaffManager({ me, staff }: { me: string; staff: { user_id: string; email: string; role: Role }[] }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("graphic");
  const [res, setRes] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">พนักงาน</h1>
      <div className="card space-y-2 text-sm">
        <p>
          <b>แอดมิน</b> เห็นและแก้ได้ทุกอย่าง · <b>กราฟิก</b> เห็นไฟล์และเปลี่ยนสถานะการผลิต ไม่เห็นยอดเงิน สลิป และการตั้งค่า
        </p>
      </div>
      <div className="card divide-y divide-line">
        {staff.map((s) => (
          <div key={s.user_id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="flex-1 text-sm font-medium">
              {s.email} {s.user_id === me && <span className="text-muted">(คุณ)</span>}
            </span>
            <select
              className="input !min-h-9 w-32 text-sm"
              value={s.role}
              disabled={s.user_id === me}
              onChange={(e) => start(async () => setRes(await updateStaffRole(s.user_id, e.target.value as Role)))}
            >
              <option value="admin">แอดมิน</option>
              <option value="graphic">กราฟิก</option>
            </select>
            {s.user_id !== me && (
              <ActionButton className="btn-ghost btn-sm" confirm={`ลบสิทธิ์ ${s.email}?`} action={() => removeStaff(s.user_id)}>
                ลบ
              </ActionButton>
            )}
          </div>
        ))}
      </div>
      <form
        className="card space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await addStaff(email, role, password);
            setRes(r);
            if (r.ok) {
              setEmail("");
              setPassword("");
            }
          });
        }}
      >
        <h2 className="font-bold">เพิ่มพนักงาน</h2>
        <input className="input" type="email" placeholder="อีเมล" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" type="text" placeholder="รหัสผ่านเริ่มต้น (อย่างน้อย 8 ตัว)" value={password} onChange={(e) => setPassword(e.target.value)} />
        <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="graphic">กราฟิก</option>
          <option value="admin">แอดมิน</option>
        </select>
        <button className="btn-primary" disabled={pending || !email || !password}>
          {pending ? <Spinner /> : "เพิ่ม"}
        </button>
        <ResultNote res={res} />
      </form>
    </div>
  );
}
