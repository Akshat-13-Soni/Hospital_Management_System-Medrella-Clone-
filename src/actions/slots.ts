"use server";
import { z } from "zod";
import { getAvailableSlots } from "@/lib/queries";

export async function fetchSlots(doctorId: string, date: string) {
  const ok = z.string().uuid().safeParse(doctorId).success && /^\d{4}-\d{2}-\d{2}$/.test(date);
  if (!ok) return [];
  return getAvailableSlots(doctorId, date);
}