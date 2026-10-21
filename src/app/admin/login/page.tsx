"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Spinner } from "@/components/ui";
import { browserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "bad" | "ok"; text: string } | null>(null);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await browserClient().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setMsg({ tone: "bad", text: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
    router.replace("/admin");
    router.refresh();
  }

  async function magicLink() {
    if (!email) return setMsg({ tone: "bad", text: "กรุณากรอกอีเมล" });
    setBusy(true);
    const { error } = await browserClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/admin/auth/callback` },
    });
    setBusy(false);
    setMsg(error ? { tone: "bad", text: "ส่งลิงก์ไม่สำเร็จ: " + error.message } : { tone: "ok", text: "ส่งลิงก์เข้าสู่ระบบไปที่อีเมลแล้ว" });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="text-center text-2xl font-bold text-brand-600">Yimwann หลังบ้าน</h1>
      <form onSubmit={login} className="card mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="email">
            อีเมล
          </label>
          <input id="email" type="email" className="input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="pw">
            รหัสผ่าน
          </label>
          <input id="pw" type="password" className="input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <button className="btn-primary w-full" disabled={busy || !email || !password}>
          {busy ? <Spinner /> : "เข้าสู่ระบบ"}
        </button>
        <button type="button" className="btn-ghost w-full" onClick={magicLink} disabled={busy}>
          ส่งลิงก์เข้าสู่ระบบทางอีเมลแทน
        </button>
      </form>
    </main>
  );
}
