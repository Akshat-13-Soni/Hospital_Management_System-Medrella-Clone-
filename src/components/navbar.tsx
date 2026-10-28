import Link from "next/link";
import { logout } from "@/actions/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { getUnreadCount } from "@/lib/queries";
import { getSession } from "@/lib/session";

export async function Navbar() {
  const s = await getSession();
  const unread = s ? await getUnreadCount(s.userId) : 0;

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight text-emerald-700">
          Medrella
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/doctors" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Find doctors
          </Link>
          {!s ? (
            <>
              <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>Log in</Link>
              <Link href="/signup" className={buttonVariants({ size: "sm" })}>Sign up</Link>
            </>
          ) : (
            <>
              <Link
                href={s.role === "doctor" ? "/doctor" : "/patient"}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                {s.role === "doctor" ? "Dashboard" : "My appointments"}
              </Link>
              <Link href="/notifications" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Notifications
                {unread > 0 && (
                  <span className="ml-1.5 rounded-full bg-red-600 px-1.5 text-xs font-medium text-white">
                    {unread}
                  </span>
                )}
              </Link>
              <span className="hidden px-2 text-muted-foreground sm:inline">{s.name}</span>
              <form action={logout}>
                <Button type="submit" variant="outline" size="sm">Log out</Button>
              </form>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}