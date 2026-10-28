import { cn } from "@/lib/utils";

export function DoctorAvatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .replace(/^dr\.?\s+/i, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <span
      aria-hidden
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#EAF5F1] text-base font-semibold text-[#0E6B58]",
        className
      )}
    >
      {initials}
    </span>
  );
}