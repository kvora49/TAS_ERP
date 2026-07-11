import React from "react";
import { TableSkeleton } from "./TableSkeleton";
import { EmptyState } from "../shared/EmptyState";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  width?: string;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  isLoading?: boolean;
  total: number;
  page: number;
  perPage: number;
  onPageChange: (page: number) => void;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  onEmptyAction?: () => void;
  emptyActionLabel?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  total,
  page,
  perPage,
  onPageChange,
  emptyMessage = "No records found",
  emptyIcon = <Inbox className="h-8 w-8" />,
  onEmptyAction,
  emptyActionLabel,
  onRowClick,
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const startIdx = total === 0 ? 0 : (page - 1) * perPage + 1;
  const endIdx = Math.min(page * perPage, total);

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden shadow-[var(--shadow-sm)] flex flex-col">
      {/* Table Shell */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm text-[#374151]">
          <thead className="bg-[#F9FAFB] text-xs font-semibold text-[#64748B] uppercase tracking-wider border-b border-[#E5E7EB]">
            <tr className="h-11">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-6 align-middle font-semibold"
                  style={{ width: col.width }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB] bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <TableSkeleton columnsCount={columns.length} rowCount={perPage} />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <EmptyState
                    icon={emptyIcon}
                    title="No Data Available"
                    description={emptyMessage}
                    actionLabel={emptyActionLabel}
                    onAction={onEmptyAction}
                  />
                </td>
              </tr>
            ) : (
              data.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  onClick={() => onRowClick?.(row)}
                  className={`h-16 hover:bg-[#F8FAFC] transition-colors border-b border-[#E5E7EB] last:border-b-0 ${
                    onRowClick ? "cursor-pointer" : ""
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-6 align-middle font-medium text-[#374151]"
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!isLoading && data.length > 0 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#E5E7EB] bg-white text-xs select-none">
          <div className="text-[#64748B] font-medium">
            Showing <span className="font-bold text-[#0F172A]">{startIdx}</span>{" "}
            to <span className="font-bold text-[#0F172A]">{endIdx}</span> of{" "}
            <span className="font-bold text-[#0F172A]">{total}</span> results
          </div>

          <div className="flex items-center gap-1.5">
            {/* Prev Button */}
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="w-9 h-9 border border-[#E5E7EB] rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F1F5F9] transition-all cursor-pointer disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Page Indicators */}
            {Array.from({ length: totalPages }).map((_, pIdx) => {
              const pNum = pIdx + 1;
              const isCurrent = pNum === page;
              return (
                <button
                  key={pNum}
                  type="button"
                  onClick={() => onPageChange(pNum)}
                  className={`w-9 h-9 text-xs font-semibold rounded-lg flex items-center justify-center transition-all cursor-pointer border ${
                    isCurrent
                      ? "bg-[#EEF2FF] border-[#6366F1] text-[#6366F1]"
                      : "bg-white border-[#E5E7EB] text-[#6B7280] hover:bg-[#F1F5F9]"
                  }`}
                >
                  {pNum}
                </button>
              );
            })}

            {/* Next Button */}
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="w-9 h-9 border border-[#E5E7EB] rounded-lg flex items-center justify-center text-[#6B7280] hover:bg-[#F1F5F9] transition-all cursor-pointer disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
