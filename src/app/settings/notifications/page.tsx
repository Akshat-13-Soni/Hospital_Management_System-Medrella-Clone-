import { NotificationPreferencesForm } from "@/components/notification-preferences-form";
import { requireUser } from "@/lib/auth-guard";
import { getPrefs } from "@/lib/preferences";

export default async function NotificationSettingsPage() {
  const s = await requireUser();
  const prefs = await getPrefs(s.userId);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#10231F]">Notification settings</h1>
        <p className="text-sm text-muted-foreground">Choose how Medrella contacts you.</p>
      </div>
      <NotificationPreferencesForm prefs={prefs} />
    </div>
  );
}