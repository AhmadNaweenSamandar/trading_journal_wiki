import { SettingsEditor } from "@/components/SettingsEditor";
import { PageHeader } from "@/components/ui";
import { getSettings, getTrades } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, trades] = await Promise.all([getSettings(), getTrades()]);

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="A journal only gets used if it matches how you actually trade. Everything below is yours to reshape."
      />
      <SettingsEditor initial={settings} tradeCount={trades.length} />
    </>
  );
}
