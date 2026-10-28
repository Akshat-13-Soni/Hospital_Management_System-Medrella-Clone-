import bcrypt from "bcryptjs";
import { db } from "../src/db";
import { availability, doctors, users } from "../src/db/schema";

const docs = [
  { name: "Dr. Ananya Rao", email: "ananya@demo.com", spec: "Cardiology", exp: 12, fee: 800 },
  { name: "Dr. Rahul Mehta", email: "rahul@demo.com", spec: "Dermatology", exp: 8, fee: 600 },
  { name: "Dr. Priya Nair", email: "priya@demo.com", spec: "Pediatrics", exp: 10, fee: 500 },
];

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);
  for (const d of docs) {
    const [u] = await db.insert(users)
      .values({ name: d.name, email: d.email, passwordHash, role: "doctor" })
      .onConflictDoNothing().returning();
    if (!u) continue;
    const [doc] = await db.insert(doctors)
      .values({ userId: u.id, specialization: d.spec, experienceYears: d.exp, fee: d.fee, clinicAddress: "Bengaluru" })
      .returning();
    for (let day = 1; day <= 5; day++) {
      await db.insert(availability).values({ doctorId: doc.id, dayOfWeek: day, startTime: "09:00", endTime: "17:00", slotMinutes: 30 });
    }
  }
  console.log("Seeded. Doctor logins: <email above> / password123");
}
main();