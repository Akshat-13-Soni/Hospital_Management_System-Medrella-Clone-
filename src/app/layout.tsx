import type { Metadata } from "next";
import "./globals.css";
import { AssistantWidget } from "@/components/assistant-widget";
import { Navbar } from "@/components/navbar";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Medrella: book doctor appointments",
  description: "Find a doctor, pick a slot, and book in seconds.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        {session && <AssistantWidget role={session.role} />}
      </body>
    </html>
  );
}