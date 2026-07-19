import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const statusColors = {
  present: "bg-status-present/15 text-status-present border-status-present/20",
  absent: "bg-status-absent/15 text-status-absent border-status-absent/20",
  late: "bg-status-late/15 text-status-late border-status-late/20",
  excused: "bg-status-excused/15 text-status-excused border-status-excused/20",
}

export const formatPercent = (value: number | undefined | null) => {
  if (value === undefined || value === null) return "0.0%";
  return `${value.toFixed(1)}%`;
}

export const formatDate = (dateString: string) => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}