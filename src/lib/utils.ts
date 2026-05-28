import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isToday, isThisWeek, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "MMM d, yyyy");
}

export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "M/d");
}

export function isDateToday(date: string | Date | null | undefined): boolean {
  if (!date) return false;
  const d = typeof date === "string" ? parseISO(date) : date;
  return isToday(d);
}

export function isDateThisWeek(date: string | Date | null | undefined): boolean {
  if (!date) return false;
  const d = typeof date === "string" ? parseISO(date) : date;
  return isThisWeek(d, { weekStartsOn: 1 });
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "…";
}

export function cleanSubcontractorName(raw: string): string[] {
  // Handles "ABM (Justin)\r\nJWD", "JWD/Convergint", "Mascaro / JWD", etc.
  return raw
    .split(/[\r\n,/&+]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => s.replace(/\s*\(.*?\)\s*/g, "").trim()) // remove parenthetical notes
    .filter((s) => s.length > 0);
}

/** Convert Excel serial date number to JS Date */
export function excelSerialToDate(serial: number): Date {
  return new Date((serial - 25569) * 86400 * 1000);
}
