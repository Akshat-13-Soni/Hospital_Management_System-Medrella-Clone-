import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status = "booked" | "cancelled" | "completed" | "pending_payment";

const styles: Record<Status, string> = {
  booked: "border-[#0E6B58]/20 bg-[#EAF5F1] text-[#0E6B58]",
  completed: "border-slate-200 bg-slate-100 text-slate-700",
  cancelled: "border-red-200 bg-red-50 text-red-700",
  pending_payment: "border-amber-200 bg-amber-50 text-amber-800",
};

const labels: Record<Status, string> = {
  booked: "Booked",
  completed: "Completed",
  cancelled: "Cancelled",
  pending_payment: "Awaiting payment",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge variant="outline" className={cn(styles[status])}>
      {labels[status]}
    </Badge>
  );
}