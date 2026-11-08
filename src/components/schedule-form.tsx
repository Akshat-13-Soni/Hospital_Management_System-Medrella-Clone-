"use client";
import { useActionState, useState } from "react";
import { saveSchedule } from "@/actions/doctor";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DAYS, selectCls } from "@/lib/format";

export function ScheduleForm() {
  const [state, action, pending] = useActionState(saveSchedule, undefined);
  const [type, setType] = useState<"wave" | "stream">("wave");
  const [recurrence, setRecurrence] = useState<"weekly" | "date">("weekly");
  const fe = state?.fieldErrors;

  return (
    <form action={action} className="space-y-3 rounded-xl bg-[#EAF5F1]/50 p-4">
      <p className="text-sm font-medium text-[#10231F]">Add or update a wave or stream schedule</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <select id="type" name="type" className={selectCls} value={type} onChange={(e) => setType(e.target.value as "wave" | "stream")}>
            <option value="wave">Wave (slots, several patients each)</option>
            <option value="stream">Stream (one window, total capacity)</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="recurrence">Repeats</Label>
          <select id="recurrence" name="recurrence" className={selectCls} value={recurrence} onChange={(e) => setRecurrence(e.target.value as "weekly" | "date")}>
            <option value="weekly">Every week on a day</option>
            <option value="date">One specific date</option>
          </select>
        </div>
        {recurrence === "weekly" ? (
          <div className="space-y-2">
            <Label htmlFor="dayOfWeek">Day</Label>
            <select id="dayOfWeek" name="dayOfWeek" className={selectCls} defaultValue={1}>
              {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
            <FieldError messages={fe?.dayOfWeek} />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" name="date" type="date" required />
            <FieldError messages={fe?.date} />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="capacity">{type === "wave" ? "Patients per slot" : "Total patients"}</Label>
          <Input id="capacity" name="capacity" type="number" min={1} max={50} defaultValue={3} required />
          <FieldError messages={fe?.capacity} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="startTime">From</Label>
          <Input id="startTime" name="startTime" type="time" defaultValue="10:00" required />
          <FieldError messages={fe?.startTime} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endTime">To</Label>
          <Input id="endTime" name="endTime" type="time" defaultValue="12:00" required />
          <FieldError messages={fe?.endTime} />
        </div>
        {type === "wave" && (
          <div className="space-y-2">
            <Label htmlFor="slotMinutes">Appointment length</Label>
            <select id="slotMinutes" name="slotMinutes" className={selectCls} defaultValue={30}>
              {[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
            </select>
            <FieldError messages={fe?.slotMinutes} />
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} className="bg-[#0E6B58] text-white hover:bg-[#0B5646]">
          {pending ? "Saving..." : "Save schedule"}
        </Button>
        {state?.success && <span role="status" className="text-sm font-medium text-[#0E6B58]">Schedule saved</span>}
      </div>
    </form>
  );
}