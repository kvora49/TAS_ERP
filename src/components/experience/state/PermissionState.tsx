'use client';

import { ShieldAlert } from 'lucide-react';

export function PermissionState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-14 h-14 rounded-full bg-[#FEF3C7] flex items-center justify-center mb-4">
        <ShieldAlert className="w-7 h-7 text-[#D97706]" />
      </div>
      <h3 className="text-base font-semibold text-[#0F172A] mb-1">Access Restricted</h3>
      <p className="text-sm text-[#64748B] text-center max-w-sm">
        You don't have permission to view this section. Contact your administrator.
      </p>
    </div>
  );
}
