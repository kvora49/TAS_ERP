'use client';

import { Inbox } from 'lucide-react';
import React from 'react';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-14 h-14 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
        {icon || <Inbox className="w-7 h-7 text-[#94A3B8]" />}
      </div>
      <h3 className="text-base font-semibold text-[#0F172A] mb-1">
        {title || 'No data found'}
      </h3>
      <p className="text-sm text-[#64748B] text-center max-w-sm mb-6">
        {description || 'No records match your current filters or nothing has been added yet.'}
      </p>
      {action}
    </div>
  );
}
