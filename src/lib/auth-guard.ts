import { redirect } from "next/navigation";
import { getSession } from "./session";

export async function requireUser() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function requireRole(role: "patient" | "doctor") {
  const s = await requireUser();
  if (s.role !== role) redirect(s.role === "doctor" ? "/doctor" : "/patient");
  return s;
}