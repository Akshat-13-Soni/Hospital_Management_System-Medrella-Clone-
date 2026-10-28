"use client";
import { useActionState } from "react";
import { saveAvailability } from "@/actions/doctor";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DAYS, selectCls } from "@/lib/format";

export function AvailabilityForm() {
  const [state, action, pending] = useActionState(saveAvailability, undefined);
  const fe = state?.fieldErrors;

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-4">
      <div className="space-y-2">
        <Label htmlFor="dayOfWeek">Day</Label>
        <select id="dayOfWeek" name="dayOfWeek" className={selectCls} defaultValue={1}>
          {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="startTime">From</Label>
        <Input id="startTime" name="startTime" type="time" defaultValue="09:00" required />
        <FieldError messages={fe?.startTime} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="endTime">To</Label>
        <Input id="endTime" name="endTime" type="time" defaultValue="17:00" required />
        <FieldError messages={fe?.endTime} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="slotMinutes">Slot length</Label>
        <select id="slotMinutes" name="slotMinutes" className={selectCls} defaultValue={30}>
          {[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
        </select>
      </div>
      <div className="flex items-center gap-3 sm:col-span-4">
        <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save day"}</Button>
        {state?.success && <span className="text-sm text-emerald-600">Availability saved</span>}
      </div>
    </form>
  );
}