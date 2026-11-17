import { redirect } from "next/navigation";
import { roleEnum } from "@/db/schema";
import { getSession } from "./session";

export type Role = (typeof roleEnum.enumValues)[number];

// Where each role lands after login, and where a wrong-role visitor is sent back to
export const HOME: Record<Role, string> = {
  patient: "/patient",
  doctor: "/doctor",
  receptionist: "/receptionist",
};

export async function requireUser() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function requireRole(role: Role) {
  const s = await requireUser();
  if (s.role !== role) redirect(HOME[s.role]);
  return s;
}