"use client";
import { useActionState } from "react";
import { savePreferences } from "@/actions/preferences";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Prefs } from "@/lib/preferences";

function Check({ name, label, hint, checked }: { name: string; label: string; hint?: string; checked: boolean }) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-1 h-4 w-4 accent-[#0E6B58]" />
      <span>
        <span className="font-medium text-[#10231F]">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

export function NotificationPreferencesForm({ prefs }: { prefs: Prefs }) {
  const [state, action, pending] = useActionState(savePreferences, undefined);

  return (
    <form action={action} className="space-y-6">
      <section className="space-y-3 rounded-2xl border bg-card p-5">
        <div>
          <h2 className="font-semibold text-[#10231F]">Appointment messages</h2>
          <p className="text-xs text-muted-foreground">
            Confirmations, changes, reminders, payments and refunds. In-app notifications are always on.
          </p>
        </div>
        <Check name="emailEnabled" label="Email" hint="Sent to your account email address." checked={prefs.emailEnabled} />
        <Check
          name="smsEnabled"
          label="SMS"
          hint="By turning this on, you agree to receive appointment SMS on the number below. You can turn it off at any time."
          checked={prefs.smsEnabled}
        />
        <div className="space-y-2">
          <Label htmlFor="phone">Mobile number</Label>
          <Input id="phone" name="phone" defaultValue={prefs.phone ?? ""} placeholder="9876543210" autoComplete="tel" />
          <FieldError messages={state?.fieldErrors?.phone} />
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-5">
        <div>
          <h2 className="font-semibold text-[#10231F]">Optional updates</h2>
          <p className="text-xs text-muted-foreground">Offers and health tips. Off unless you choose them.</p>
        </div>
        <Check name="promoEmail" label="Promotional email" checked={prefs.promoEmail} />
        <Check name="promoSms" label="Promotional SMS" hint="Needs SMS turned on above." checked={prefs.promoSms} />
      </section>

      {state?.error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} className="bg-[#0E6B58] text-white hover:bg-[#0B5646]">
          {pending ? "Saving..." : "Save preferences"}
        </Button>
        {state?.success && <span role="status" className="text-sm font-medium text-[#0E6B58]">Preferences saved</span>}
      </div>
    </form>
  );
}