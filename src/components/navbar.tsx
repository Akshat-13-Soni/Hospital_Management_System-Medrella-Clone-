import Link from "next/link";
import { logout } from "@/actions/auth";
import { NavLink } from "@/components/nav-link";
import { Button, buttonVariants } from "@/components/ui/button";
import { getUnreadCount } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export async function Navbar() {
  const s = await getSession();
  const unread = s ? await getUnreadCount(s.userId) : 0;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0E6B58] text-sm font-bold text-white">
            M
          </span>
          <span className="text-lg font-semibold tracking-tight text-[#10231F]">Medrella</span>
        </Link>

        <nav className="flex flex-wrap items-center justify-end gap-1">
          <NavLink href="/doctors">Find doctors</NavLink>
          {!s ? (
            <>
              <NavLink href="/login">Log in</NavLink>
              <Link
                href="/signup"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "ml-1 bg-[#0E6B58] text-white hover:bg-[#0B5646]"
                )}
              >
                Sign up
              </Link>
            </>
          ) : (
            <>
              <NavLink href={s.role === "doctor" ? "/doctor" : "/patient"}>
                {s.role === "doctor" ? "Dashboard" : "My appointments"}
              </NavLink>
              <NavLink href="/notifications">
                Notifications
                {unread > 0 && (
                  <span className="ml-1.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white">
                    {unread}
                  </span>
                )}
              </NavLink>
              <span className="ml-1 hidden items-center gap-2 border-l pl-3 sm:flex">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EAF5F1] text-xs font-semibold text-[#0E6B58]">
                  {s.name.charAt(0).toUpperCase()}
                </span>
                <span className="text-sm text-muted-foreground">{s.name}</span>
              </span>
              <form action={logout} className="ml-1">
                <Button type="submit" variant="outline" size="sm">
                  Log out
                </Button>
              </form>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}