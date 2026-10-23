"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { pickMessage } from "@/lib/greeting";
import { Alert } from "../ui";
import { LineLoginCard } from "../order/LineLoginCard";
import type { Me } from "../order/WelcomeBack";

/** หน้าแรก: ทักทายลูกค้าเก่า (เครื่องนี้จำไว้/เข้าด้วย LINE) หรือชวนเข้าสู่ระบบด้วย LINE */
export function HomeGreeting({ messages }: { messages: string[] }) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const line = new URLSearchParams(window.location.search).get("line");
    if (line) window.history.replaceState(null, "", "/");
    let alive = true;
    fetch("/api/me")
      .then((r) => r.json())
      .then(({ me }: { me: Me | null }) => {
        if (!alive) return;
        if (line)
          setNotice(
            line === "ok"
              ? "เข้าสู่ระบบด้วย LINE เรียบร้อย"
              : line === "new"
                ? "เชื่อมต่อ LINE เรียบร้อย สั่งครั้งแรกด้วย LINE นี้แล้ว ครั้งหน้าระบบจะจำได้ทุกเครื่อง"
                : "เชื่อมต่อ LINE ไม่สำเร็จ สั่งต่อได้ตามปกติ",
          );
        setMe(me);
        if (me) setGreeting(pickMessage(messages, me.name));
      })
      .catch(() => alive && setMe(null));
    return () => {
      alive = false;
    };
  }, [messages]);

  return (
    <>
      {notice && <Alert tone="ok">{notice}</Alert>}
      {me && (
        <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-brand-50 to-white p-3 ring-1 ring-brand-200">
          {me.picture && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.picture} alt="" className="h-11 w-11 shrink-0 rounded-full" />
          )}
          <div className="min-w-0 flex-1">
            {greeting && <p className="font-semibold leading-snug">{greeting}</p>}
            <p className="text-xs text-muted">ยอดสะสมงานพิมพ์ A3+ {me.points} แผ่น</p>
          </div>
          <Link href="/print" className="btn-secondary btn-sm shrink-0">
            สั่งไฟล์เดิม
          </Link>
        </div>
      )}
      {me === null && <LineLoginCard variant="signin" />}
    </>
  );
}
