import "server-only";
import { cache } from "react";
import { DEFAULT_SETTINGS } from "../constants";
import { db } from "../supabase/admin";
import type { PublicSettings, Settings } from "../types";

export function mergeSettings(data: Partial<Settings> | null | undefined): Settings {
  const d = data ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...d,
    promo: { ...DEFAULT_SETTINGS.promo, ...(d.promo ?? {}) },
    slipVerify: { ...DEFAULT_SETTINGS.slipVerify, ...(d.slipVerify ?? {}) },
    lineNotify: { ...DEFAULT_SETTINGS.lineNotify, ...(d.lineNotify ?? {}) },
    tiers: d.tiers?.length ? d.tiers : DEFAULT_SETTINGS.tiers,
    a5Tiers: d.a5Tiers?.length ? d.a5Tiers : DEFAULT_SETTINGS.a5Tiers,
  };
}

/** อ่านการตั้งค่า (ใช้ซ้ำในคำขอเดียวกันได้ ไม่ query ซ้ำ) */
export const getSettings = cache(async function getSettings(): Promise<Settings> {
  const { data, error } = await db().from("settings").select("data").eq("id", 1).maybeSingle();
  if (error) throw error;
  return mergeSettings(data?.data as Partial<Settings>);
});

export async function saveSettings(s: Settings) {
  const { error } = await db()
    .from("settings")
    .upsert({ id: 1, data: s, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export function toPublic(s: Settings): PublicSettings {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { notifyEmail, slipVerify, lineReplyFooter, lineTrackingMessage, lineNotify, ...pub } = s;
  return pub;
}
