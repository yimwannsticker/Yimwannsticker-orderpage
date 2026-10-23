import { requireStaff } from "@/lib/server/auth";
import { lineLoginEnabled, messagingEnabled } from "@/lib/server/line";
import { listBackups } from "@/lib/server/backup";
import { getSettings } from "@/lib/server/settings";
import * as storage from "@/lib/server/storage";
import { imageUrl } from "@/lib/server/storage";
import { SettingsForm } from "./form";

export default async function SettingsPage() {
  await requireStaff("admin");
  const settings = await getSettings();
  const env = {
    lineLogin: lineLoginEnabled(),
    lineMessaging: messagingEnabled(),
    smtp: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
    slipok: Boolean(process.env.SLIPOK_API_KEY),
    easyslip: Boolean(process.env.EASYSLIP_API_KEY),
  };
  const bannerUrls = Object.fromEntries(
    await Promise.all(settings.banners.map(async (b) => [b.path, (await imageUrl(b.path)) ?? ""] as const)),
  );
  const backups = await Promise.all(
    (await listBackups()).map(async (b) => ({
      id: b.id as string,
      at: b.created_at as string,
      size: Number(b.size_bytes),
      url: await storage.readUrl(b.path, 60 * 30, b.path.split("/").pop()),
    })),
  );
  return <SettingsForm initial={settings} env={env} bannerUrls={bannerUrls} backups={backups} />;
}
