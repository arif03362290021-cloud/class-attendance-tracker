import React from 'react';
import { cn, statusColors } from '@/lib/utils';
import { AttendanceRecordStatus } from '@workspace/api-client-react';

interface StatusBadgeProps {
  status: AttendanceRecordStatus | string;
  className?: string;
  dot?: boolean;
}

export function StatusBadge({ status, className, dot = true }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase() as keyof typeof statusColors;
  const colorClass = statusColors[normalizedStatus] || "bg-muted text-muted-foreground border-border";
  
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border",
      colorClass,
      className
    )}>
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75" />
      )}
      <span className="capitalize">{status}</span>
    </span>
  );
}