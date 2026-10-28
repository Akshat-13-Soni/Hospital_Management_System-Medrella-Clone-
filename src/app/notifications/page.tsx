import { Bell } from "lucide-react";
import { markAllRead } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth-guard";
import { getNotifications } from "@/lib/queries";
import { cn } from "@/lib/utils";

export default async function NotificationsPage() {
  const s = await requireUser();
  const items = await getNotifications(s.userId);
  const hasUnread = items.some((n) => !n.read);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-[#10231F]">Notifications</h1>
        {hasUnread && (
          <form action={markAllRead}>
            <Button type="submit" variant="outline" size="sm">Mark all as read</Button>
          </form>
        )}
      </div>

      {items.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-10 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF5F1] text-[#0E6B58]">
            <Bell className="h-6 w-6" />
          </span>
          <p className="font-medium text-[#10231F]">You're all caught up</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Booking, reschedule and cancellation updates will appear here.
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {items.map((n) => (
          <li
            key={n.id}
            className={cn(
              "flex gap-3 rounded-xl border p-4 text-sm",
              n.read ? "bg-card text-muted-foreground" : "border-[#0E6B58]/30 bg-[#EAF5F1]/60 text-[#10231F]"
            )}
          >
            <span
              aria-hidden
              className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-[#0E6B58]")}
            />
            <div className="min-w-0">
              {!n.read && <span className="sr-only">Unread: </span>}
              <p className={n.read ? "" : "font-medium"}>{n.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {n.createdAt.toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}