'use client';

import { Lock } from 'lucide-react';

export function ReadOnlyState({ message }: { message?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[#FEF9C3] border border-[#FDE68A] rounded-lg">
      <Lock className="w-4 h-4 text-[#D97706] flex-shrink-0" />
      <p className="text-sm text-[#92400E]">
        {message || 'This record is locked and cannot be edited.'}
      </p>
    </div>
  );
}
