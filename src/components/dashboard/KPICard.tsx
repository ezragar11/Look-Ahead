import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface KPICardProps {
  label:    string;
  value:    number | string;
  icon:     LucideIcon;
  color?:   "blue" | "green" | "orange" | "red" | "purple" | "gray" | "amber";
  sublabel?: string;
}

const colorMap = {
  blue:   { bg: "bg-blue-50",   icon: "bg-blue-500",   text: "text-blue-600"  },
  green:  { bg: "bg-emerald-50", icon: "bg-emerald-500", text: "text-emerald-600" },
  orange: { bg: "bg-orange-50", icon: "bg-orange-500", text: "text-orange-600" },
  red:    { bg: "bg-red-50",    icon: "bg-red-500",    text: "text-red-600"   },
  purple: { bg: "bg-purple-50", icon: "bg-purple-500", text: "text-purple-600" },
  gray:   { bg: "bg-gray-50",   icon: "bg-gray-500",   text: "text-gray-600"  },
  amber:  { bg: "bg-amber-50",  icon: "bg-amber-500",  text: "text-amber-600" },
};

export function KPICard({ label, value, icon: Icon, color = "blue", sublabel }: KPICardProps) {
  const c = colorMap[color];
  return (
    <div className={cn("rounded-xl border border-gray-100 p-5 shadow-sm", c.bg)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
          <p className={cn("mt-1 text-3xl font-bold", c.text)}>{value}</p>
          {sublabel && <p className="mt-0.5 text-xs text-gray-400">{sublabel}</p>}
        </div>
        <div className={cn("rounded-lg p-2.5", c.icon)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}
