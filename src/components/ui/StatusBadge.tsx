import { cn } from "@/lib/utils";
import { ActivityStatus, STATUS_COLORS, STATUS_LABELS } from "@/types";

interface StatusBadgeProps {
  status: ActivityStatus | string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const label  = STATUS_LABELS[status as ActivityStatus] ?? status;
  const colors = STATUS_COLORS[status as ActivityStatus] ?? "bg-gray-100 text-gray-700 border-gray-300";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        colors
      )}
    >
      {label}
    </span>
  );
}
