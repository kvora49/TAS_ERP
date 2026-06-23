import React from "react";

interface TableSkeletonProps {
  columnsCount?: number;
  rowCount?: number;
  rowHeightClass?: string;
}

export function TableSkeleton({
  columnsCount = 5,
  rowCount = 5,
  rowHeightClass = "h-16",
}: TableSkeletonProps) {
  return (
    <div className="w-full divide-y divide-[#E5E7EB]">
      {Array.from({ length: rowCount }).map((_, rIdx) => (
        <div
          key={rIdx}
          className={`flex items-center px-6 gap-4 ${rowHeightClass}`}
        >
          {Array.from({ length: columnsCount }).map((_, cIdx) => (
            <div
              key={cIdx}
              className="flex-1"
              style={{
                maxWidth: cIdx === 0 ? "80px" : "none", // narrower for first col if needed
              }}
            >
              <div className="h-4 bg-[#E5E7EB] rounded w-[85%] animate-pulse" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
