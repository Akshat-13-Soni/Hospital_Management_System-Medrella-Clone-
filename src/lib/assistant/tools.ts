import { z } from "zod";
import { bookAppointment, cancelAppointment, rescheduleAppointment } from "@/actions/appointments";
import { listLeaveDays } from "@/lib/leave";
import type { CheckoutInfo } from "@/lib/payment-types";
import {
  getAvailability, getAvailableSlots, getDoctor, getDoctorAppointments, getDoctorByUserId, getOutsideHours,
  getPaidAmounts, getPatientAppointment, getPatientAppointments, getPatientPayments, getSchedules, listDoctors,
} from "@/lib/queries";
import { refundFor } from "@/lib/refund-policy";
import { istNow } from "@/lib/slots";
import { addDays, closestFirst, findOverlaps } from "./slot-suggest";

export type Role = "patient" | "doctor";
export type Ctx = { userId: string; role: Role; name: string };
export type ExecResult = { ok: boolean; message: string; checkout?: CheckoutInfo | null };
export type Tool = {
  name: string;
  description: string;
  roles: Role[];
  schema: z.ZodTypeAny;
  parameters: Record<string, unknown>; // JSON schema shown to the model
  run: (ctx: Ctx, args: any) => Promise<unknown>;
  // Write tools only: run() validates and returns { summary }; execute() runs after the user confirms
  execute?: (ctx: Ctx, args: any) => Promise<ExecResult>;
};

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const uuid = z.string().uuid();
const params = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required });
const str = (description: string) => ({ type: "string", description });
const optStr = (description: string) => ({ type: ["string", "null"], description});
const rs = (paise: number) => `Rs ${paise / 100}`;

async function myDoctor(ctx: Ctx) {
  const d = await getDoctorByUserId(ctx.userId);
  if (!d) throw new Error("Doctor profile not found");
  return d;
}

// The next few open slots, nearest to the preferred time first
async function suggest(doctorId: string, fromDate: string, preferred?: string, exclude?: { date: string; startTime: string }) {
  const out: { date: string; start: string; end: string; seatsLeft: number }[] = [];
  for (let i = 0; i < 7 && out.length < 5; i++) {
    const d = addDays(fromDate, i);
    for (const s of closestFirst(await getAvailableSlots(doctorId, d), i === 0 ? preferred : undefined)) {
      if (exclude && exclude.date === d && exclude.startTime === s.startTime) continue;
      out.push({ date: d, start: s.startTime, end: s.endTime, seatsLeft: s.seatsLeft });
      if (out.length >= 5) break;
    }
  }
  return out;
}

// ---------- Patient: read ----------

const myAppointments: Tool = {
  name: "my_appointments",
  description: "List the patient's own appointments: upcoming, past or all.",
  roles: ["patient"],
  schema: z.object({ when: z.enum(["upcoming", "past", "all"]).nullish() }),
  parameters: params({ when: { type: ["string", "null"], enum: ["upcoming", "past", "all", null] } }),
  run: async (ctx, a) => {
    const when = a.when ?? "upcoming";
    const { today } = istNow();
    const rows = await getPatientAppointments(ctx.userId);
    const isUpcoming = (a: (typeof rows)[number]) => (a.status === "booked" || a.status === "pending_payment") && a.date >= today;
    return rows
      .filter((a) => (when === "all" ? true : when === "upcoming" ? isUpcoming(a) : !isUpcoming(a)))
      .slice(0, 20)
      .map((a) => ({ id: a.id, doctor: a.doctorName, specialization: a.specialization, date: a.date, start: a.startTime, end: a.endTime, status: a.status }));
  },
};

const searchDoctors: Tool = {
  name: "search_doctors",
  description: "Find doctors by name or specialization. Leave query empty to list doctors.",
  roles: ["patient"],
  schema: z.object({ query: z.string().trim().max(80).nullish() }),
  parameters: params({ query: optStr("Name or specialization") }),
  run: async (_ctx, { query }) =>
    (await listDoctors(query)).slice(0, 10).map((d) => ({
      id: d.id, name: d.name, specialization: d.specialization, experienceYears: d.experienceYears, feeRupees: d.fee,
    })),
};

const getSlots: Tool = {
  name: "get_slots",
  description: "Available appointment slots for a doctor on a date.",
  roles: ["patient"],
  schema: z.object({ doctorId: uuid, date }),
  parameters: params({ doctorId: str("Doctor id from search_doctors"), date: str("YYYY-MM-DD") }, ["doctorId", "date"]),
  run: async (_ctx, { doctorId, date }) =>
    (await getAvailableSlots(doctorId, date)).map((s) => ({ start: s.startTime, end: s.endTime, seatsLeft: s.seatsLeft })),
};

const suggestSlots: Tool = {
  name: "suggest_slots",
  description: "Suggest alternative open slots when the requested time is unavailable. Searches the next 7 days.",
  roles: ["patient"],
  schema: z.object({ doctorId: uuid, date, preferredTime: hhmm.nullish() }),
  parameters: params(
    { doctorId: str("Doctor id"), date: str("YYYY-MM-DD to start from"), preferredTime: optStr("HH:MM the patient wanted") },
    ["doctorId", "date"]
  ),
  run: async (_ctx, { doctorId, date, preferredTime }) => suggest(doctorId, date, preferredTime),
};

const myPayments: Tool = {
  name: "my_payments",
  description: "The patient's payment history with refund status.",
  roles: ["patient"],
  schema: z.object({}),
  parameters: params({}),
  run: async (ctx) =>
    (await getPatientPayments(ctx.userId)).slice(0, 15).map((p) => ({
      doctor: p.doctorName, date: p.date, amount: rs(p.amountPaise), status: p.status,
      refunds: p.refunds.map((r) => ({ amount: rs(r.amountPaise), status: r.status })),
    })),
};

// ---------- Patient: write (propose, then confirm) ----------

const bookTool: Tool = {
  name: "book_appointment",
  description: "Propose booking a slot. The patient must confirm before anything is booked.",
  roles: ["patient"],
  schema: z.object({ doctorId: uuid, date, startTime: hhmm, reason: z.string().trim().max(500).nullish() }),
  parameters: params(
    { doctorId: str("Doctor id"), date: str("YYYY-MM-DD"), startTime: str("HH:MM, from get_slots"), reason: optStr("Optional reason for visit") },
    ["doctorId", "date", "startTime"]
  ),
  run: async (_ctx, { doctorId, date, startTime }) => {
    const doc = await getDoctor(doctorId);
    if (!doc) return { error: "Doctor not found" };
    const slot = (await getAvailableSlots(doctorId, date)).find((s) => s.startTime === startTime);
    if (!slot) return { error: "That slot is not available. Use suggest_slots for alternatives." };
    const fee = doc.fee > 0 ? `The fee is Rs ${doc.fee}, payable after you confirm.` : "This consultation is free.";
    return { summary: `Book ${doc.name} on ${date}, ${slot.startTime} to ${slot.endTime}. ${fee}` };
  },
  execute: async (_ctx, a) => {
    const res = await bookAppointment({ doctorId: a.doctorId, date: a.date, startTime: a.startTime, reason: a.reason ?? undefined });
    if (!res.ok) return { ok: false, message: res.error };
    return res.checkout
      ? { ok: true, message: "The slot is held. Complete the payment to confirm your booking.", checkout: res.checkout }
      : { ok: true, message: "Your appointment is booked." };
  },
};

const rescheduleTool: Tool = {
  name: "reschedule_appointment",
  description: "Propose moving one of the patient's booked appointments. The patient must confirm.",
  roles: ["patient"],
  schema: z.object({ appointmentId: uuid, date, startTime: hhmm }),
  parameters: params(
    { appointmentId: str("Appointment id from my_appointments"), date: str("YYYY-MM-DD"), startTime: str("HH:MM") },
    ["appointmentId", "date", "startTime"]
  ),
  run: async (ctx, { appointmentId, date, startTime }) => {
    const a = await getPatientAppointment(appointmentId, ctx.userId); // ownership check
    if (!a) return { error: "Appointment not found" };
    if (a.status !== "booked") return { error: "Only booked appointments can be rescheduled" };
    const slot = (await getAvailableSlots(a.doctorId, date)).find((s) => s.startTime === startTime);
    if (!slot) return { error: "That slot is not available. Use suggest_slots for alternatives." };
    return { summary: `Move your appointment with ${a.doctorName} from ${a.date} ${a.startTime} to ${date}, ${slot.startTime} to ${slot.endTime}.` };
  },
  execute: async (_ctx, a) => {
    const res = await rescheduleAppointment({ appointmentId: a.appointmentId, date: a.date, startTime: a.startTime });
    return res.ok ? { ok: true, message: "Your appointment has been rescheduled." } : { ok: false, message: res.error };
  },
};

const cancelTool: Tool = {
  name: "cancel_appointment",
  description: "Propose cancelling one of the patient's booked appointments. The patient must confirm.",
  roles: ["patient"],
  schema: z.object({ appointmentId: uuid }),
  parameters: params({ appointmentId: str("Appointment id from my_appointments") }, ["appointmentId"]),
  run: async (ctx, { appointmentId }) => {
    const a = await getPatientAppointment(appointmentId, ctx.userId);
    if (!a) return { error: "Appointment not found" };
    if (a.status !== "booked") return { error: "Only booked appointments can be cancelled" };
    const paid = (await getPaidAmounts(ctx.userId)).get(a.id);
    let refund = "No payment was made, so no refund applies.";
    if (paid) {
      const r = refundFor({ date: a.date, startTime: a.startTime, cancelledBy: "patient", amountPaise: paid });
      refund = r.amountPaise > 0 ? `You will get ${rs(r.amountPaise)} back (${r.percent}%).` : "No refund applies under the cancellation policy.";
    }
    return { summary: `Cancel your appointment with ${a.doctorName} on ${a.date} at ${a.startTime}. ${refund}` };
  },
  execute: async (ctx, { appointmentId }) => {
    try {
      await cancelAppointment(appointmentId);
    } catch {
      return { ok: false, message: "Could not cancel the appointment." };
    }
    const a = await getPatientAppointment(appointmentId, ctx.userId);
    return a?.status === "cancelled"
      ? { ok: true, message: "Your appointment is cancelled." }
      : { ok: false, message: "The appointment could not be cancelled. It may have already changed." };
  },
};

// ---------- Doctor: read only ----------

const appointmentsOnDate: Tool = {
  name: "appointments_on_date",
  description: "The doctor's appointments on a date (today if no date is given).",
  roles: ["doctor"],
  schema: z.object({ date: date.nullish() }),
  parameters:params({ date: optStr("YYYY-MM-DD, default today") }),
  run: async (ctx, { date }) => {
    const day = date ?? istNow().today;
    return (await getDoctorAppointments(ctx.userId))
      .filter((a) => a.date === day)
      .map((a) => ({ id: a.id, patient: a.patientName, start: a.startTime, end: a.endTime, status: a.status }));
  },
};

const appointmentStats: Tool = {
  name: "appointment_stats",
  description: "Counts of the doctor's appointments by status, optionally within a date range.",
  roles: ["doctor"],
  schema: z.object({ from: date.nullish(), to: date.nullish() }),
  parameters: params({ from: optStr("YYYY-MM-DD"), to: optStr("YYYY-MM-DD") }),
  run: async (ctx, { from, to }) => {
    const rows = (await getDoctorAppointments(ctx.userId)).filter((a) => (!from || a.date >= from) && (!to || a.date <= to));
    const count = (s: string) => rows.filter((a) => a.status === s).length;
    return { total: rows.length, booked: count("booked"), completed: count("completed"), cancelled: count("cancelled") };
  },
};

const mySchedule: Tool = {
  name: "my_schedule",
  description: "The doctor's working hours, wave and stream schedules, and upcoming leave days.",
  roles: ["doctor"],
  schema: z.object({}),
  parameters: params({}),
  run: async (ctx) => {
    const doc = await myDoctor(ctx);
    const [hours, scheds, leaves] = await Promise.all([getAvailability(doc.id), getSchedules(doc.id), listLeaveDays(doc.id)]);
    return {
      workingHours: hours.map((h) => ({ dayOfWeek: h.dayOfWeek, start: h.startTime, end: h.endTime, slotMinutes: h.slotMinutes })),
      schedules: scheds.map((s) => ({
        type: s.type, dayOfWeek: s.dayOfWeek, date: s.date, start: s.startTime, end: s.endTime, slotMinutes: s.slotMinutes, capacity: s.capacity,
      })),
      upcomingLeaveDays: leaves,
    };
  },
};

const findConflicts: Tool = {
  name: "find_conflicts",
  description: "Scheduling problems: overlapping appointments, appointments outside current hours, appointments on leave days.",
  roles: ["doctor"],
  schema: z.object({ date: date.nullish() }),
  parameters: params({ date: optStr("YYYY-MM-DD, optional") }),
  run: async (ctx, { date }) => {
    const doc = await myDoctor(ctx);
    const { today } = istNow();
    const booked = (await getDoctorAppointments(ctx.userId)).filter(
      (a) => a.status === "booked" && a.date >= today && (!date || a.date === date)
    );
    const days = [...new Set(booked.map((a) => a.date))];
    const overlaps = days.flatMap((d) =>
      findOverlaps(booked.filter((a) => a.date === d)).map(([a, b]) => ({
        date: d, first: `${a.patientName} ${a.startTime}-${a.endTime}`, second: `${b.patientName} ${b.startTime}-${b.endTime}`,
      }))
    );
    const outside = (await getOutsideHours(doc.id))
      .filter((a) => !date || a.date === date)
      .map((a) => ({ date: a.date, patient: a.patientName, start: a.startTime, end: a.endTime }));
    const leaves = new Set(await listLeaveDays(doc.id));
    const onLeave = booked.filter((a) => leaves.has(a.date)).map((a) => ({ date: a.date, patient: a.patientName, start: a.startTime }));
    return { overlaps, outsideWorkingHours: outside, onLeaveDays: onLeave };
  },
};

const suggestReschedule: Tool = {
  name: "suggest_reschedule_slots",
  description: "Suggest open slots to move one of the doctor's appointments to. This only suggests; it changes nothing.",
  roles: ["doctor"],
  schema: z.object({ appointmentId: uuid }),
  parameters: params({ appointmentId: str("Appointment id from appointments_on_date") }, ["appointmentId"]),
  run: async (ctx, { appointmentId }) => {
    const doc = await myDoctor(ctx);
    const a = (await getDoctorAppointments(ctx.userId)).find((x) => x.id === appointmentId); // ownership check
    if (!a) return { error: "Appointment not found" };
    return suggest(doc.id, a.date, a.startTime, { date: a.date, startTime: a.startTime });
  },
};

const nextAvailable: Tool = {
  name: "next_available_slot",
  description: "The doctor's next open slot, searching up to 14 days ahead.",
  roles: ["doctor"],
  schema: z.object({ fromDate: date.nullish() }),
  parameters: params({ fromDate: optStr("YYYY-MM-DD, default today") }),
  run: async (ctx, { fromDate }) => {
    const doc = await myDoctor(ctx);
    const start = fromDate ?? istNow().today;
    for (let i = 0; i < 14; i++) {
      const d = addDays(start, i);
      const slots = await getAvailableSlots(doc.id, d);
      if (slots.length) return { date: d, start: slots[0].startTime, end: slots[0].endTime };
    }
    return { error: "No open slot in the next 14 days" };
  },
};

export const TOOLS: Tool[] = [
  myAppointments, searchDoctors, getSlots, suggestSlots, myPayments, bookTool, rescheduleTool, cancelTool,
  appointmentsOnDate, appointmentStats, mySchedule, findConflicts, suggestReschedule, nextAvailable,
];

export const toolsFor = (role: Role) => TOOLS.filter((t) => t.roles.includes(role));
export const getTool = (name: string, role: Role) => toolsFor(role).find((t) => t.name === name);