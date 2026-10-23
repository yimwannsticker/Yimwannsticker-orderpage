import { requireStaff } from "@/lib/server/auth";
import { lineLoginEnabled, messagingEnabled } from "@/lib/server/line";
import { getSettings } from "@/lib/server/settings";
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
  return <SettingsForm initial={settings} env={env} bannerUrls={bannerUrls} />;
}
