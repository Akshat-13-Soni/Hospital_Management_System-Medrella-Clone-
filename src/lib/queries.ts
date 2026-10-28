import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { appointments, availability, doctors, notifications, users } from "@/db/schema";
import { generateSlots, istNow, toMin, weekdayOf } from "./slots";

export async function listDoctors(q?: string) {
  const base = db
    .select({
      id: doctors.id,
      name: users.name,
      specialization: doctors.specialization,
      experienceYears: doctors.experienceYears,
      fee: doctors.fee,
      bio: doctors.bio,
      clinicAddress: doctors.clinicAddress,
    })
    .from(doctors)
    .innerJoin(users, eq(users.id, doctors.userId));

  if (!q?.trim()) return base.orderBy(asc(users.name));
  const like = `%${q.trim()}%`;
  return base.where(or(ilike(users.name, like), ilike(doctors.specialization, like))).orderBy(asc(users.name));
}

export async function getDoctor(id: string) {
  const [row] = await listDoctorsById(id);
  return row ?? null;
}
function listDoctorsById(id: string) {
  return db
    .select({
      id: doctors.id,
      name: users.name,
      specialization: doctors.specialization,
      experienceYears: doctors.experienceYears,
      fee: doctors.fee,
      bio: doctors.bio,
      clinicAddress: doctors.clinicAddress,
    })
    .from(doctors)
    .innerJoin(users, eq(users.id, doctors.userId))
    .where(eq(doctors.id, id));
}

export async function getDoctorByUserId(userId: string) {
  const [row] = await db.select().from(doctors).where(eq(doctors.userId, userId));
  return row ?? null;
}

export async function getAvailability(doctorId: string) {
  return db.select().from(availability).where(eq(availability.doctorId, doctorId)).orderBy(asc(availability.dayOfWeek));
}

export async function getAvailableSlots(doctorId: string, date: string) {
  const { today, nowMin } = istNow();
  if (date < today) return [];

  const [av] = await db
    .select()
    .from(availability)
    .where(and(eq(availability.doctorId, doctorId), eq(availability.dayOfWeek, weekdayOf(date))));
  if (!av) return [];

  const booked = await db
    .select({ startTime: appointments.startTime })
    .from(appointments)
    .where(and(eq(appointments.doctorId, doctorId), eq(appointments.date, date), eq(appointments.status, "booked")));
  const taken = new Set(booked.map((b) => b.startTime));

  return generateSlots(av.startTime, av.endTime, av.slotMinutes).filter(
    (s) => !taken.has(s.startTime) && (date > today || toMin(s.startTime) > nowMin)
  );
}

export async function getDoctorAppointments(doctorUserId: string) {
  return db
    .select({
      id: appointments.id,
      date: appointments.date,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      status: appointments.status,
      reason: appointments.reason,
      patientName: users.name,
      patientEmail: users.email,
    })
    .from(appointments)
    .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
    .innerJoin(users, eq(users.id, appointments.patientId))
    .where(eq(doctors.userId, doctorUserId))
    .orderBy(asc(appointments.date), asc(appointments.startTime));
}

export async function getPatientAppointments(patientId: string) {
  return db
    .select({
      id: appointments.id,
      date: appointments.date,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      status: appointments.status,
      reason: appointments.reason,
      doctorName: users.name,
      specialization: doctors.specialization,
    })
    .from(appointments)
    .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
    .innerJoin(users, eq(users.id, doctors.userId))
    .where(eq(appointments.patientId, patientId))
    .orderBy(asc(appointments.date), asc(appointments.startTime));
}

export async function getNotifications(userId: string) {
  return db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(30);
}

export async function getUnreadCount(userId: string) {
  const [r] = await db.select({ n: count() }).from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  return r?.n ?? 0;
}

export async function getPatientAppointment(id: string, patientId: string) {
  const [row] = await db
    .select({
      id: appointments.id,
      doctorId: appointments.doctorId,
      date: appointments.date,
      startTime: appointments.startTime,
      status: appointments.status,
      doctorName: users.name,
      specialization: doctors.specialization,
    })
    .from(appointments)
    .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
    .innerJoin(users, eq(users.id, doctors.userId))
    .where(and(eq(appointments.id, id), eq(appointments.patientId, patientId)));
  return row ?? null;
}