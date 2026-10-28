const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function DateBlock({ date }: { date: string }) {
  return (
    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-[#EAF5F1] text-[#0E6B58]">
      <span className="text-lg font-semibold leading-none">{date.slice(8, 10)}</span>
      <span className="mt-1 text-[11px] font-medium uppercase leading-none">
        {MONTHS[Number(date.slice(5, 7)) - 1]}
      </span>
    </div>
  );
}