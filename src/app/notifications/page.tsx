import { markAllRead } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth-guard";
import { getNotifications } from "@/lib/queries";

export default async function NotificationsPage() {
  const s = await requireUser();
  const items = await getNotifications(s.userId);
  const hasUnread = items.some((n) => !n.read);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        {hasUnread && (
          <form action={markAllRead}>
            <Button type="submit" variant="outline" size="sm">Mark all as read</Button>
          </form>
        )}
      </div>

      {items.length === 0 && <p className="text-sm text-muted-foreground">You're all caught up.</p>}
      {items.map((n) => (
        <Card key={n.id} className={n.read ? "opacity-70" : "border-emerald-500"}>
          <CardContent className="py-3 text-sm">
            <p>{n.message}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {n.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}