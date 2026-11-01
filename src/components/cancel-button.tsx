"use client";
import { Button } from "@/components/ui/button";

export function CancelButton({ message, label = "Cancel" }: { message: string; label?: string }) {
  return (
    <Button
      type="submit"
      variant="ghost"
      size="sm"
      className="text-red-600 hover:bg-red-50 hover:text-red-700"
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {label}
    </Button>
  );
}