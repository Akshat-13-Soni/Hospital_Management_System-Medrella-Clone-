import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: "booked" | "cancelled" | "completed" }) {
  const variant = status === "booked" ? "default" : status === "completed" ? "secondary" : "destructive";
  return <Badge variant={variant} className="capitalize">{status}</Badge>;
}