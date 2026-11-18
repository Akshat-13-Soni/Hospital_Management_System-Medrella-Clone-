"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth-guard";
import { checkInPatient, completeFromQueue, recordNoShow } from "@/lib/queue";

function refresh() {
  revalidatePath("/receptionist");
  revalidatePath("/doctor");
  revalidatePath("/patient");
}

export async function checkIn(appointmentId: string) {
  const s = await requireRole("receptionist");
  await checkInPatient(appointmentId, s.userId);
  refresh();
}

export async function noShow(appointmentId: string) {
  await requireRole("receptionist");
  await recordNoShow(appointmentId);
  refresh();
}

export async function completePatient(appointmentId: string) {
  await requireRole("receptionist");
  await completeFromQueue(appointmentId);
  refresh();
}