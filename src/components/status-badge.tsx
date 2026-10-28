import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const styles = {
  booked: "border-[#0E6B58]/20 bg-[#EAF5F1] text-[#0E6B58]",
  completed: "border-slate-200 bg-slate-100 text-slate-700",
  cancelled: "border-red-200 bg-red-50 text-red-700",
} as const;

export function StatusBadge({ status }: { status: "booked" | "cancelled" | "completed" }) {
  return (
    <Badge variant="outline" className={cn("capitalize", styles[status])}>
      {status}
    </Badge>
  );
}