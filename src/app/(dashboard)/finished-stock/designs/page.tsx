"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Search, SlidersHorizontal, ArrowUpDown, ChevronRight, RefreshCw, Layers } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Design {
  id: string;
  design_number: string;
  code?: string; // fallback to design_number if code is empty
  name: string;
  category: string;
  sub_category?: string;
  sale_price: number;
  total_quantity: number;
  total_value: number;
  brand?: { name: string };
  size_set?: { name: string; sizes: string[] };
}

export default function DesignStockListPage() {
  const [loading, setLoading] = useState(true);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"code" | "name" | "qty" | "value">("qty");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const fetchDesigns = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/finished-stock/designs");
      const data = await res.json();
      if (res.ok && data.designs) {
        setDesigns(data.designs);
      } else {
        toast.error(data.error || "Failed to load designs");
      }
    } catch (err) {
      console.error(err);
      toast.error("Network error. Could not connect to API.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDesigns();
  }, []);

  const handleSort = (field: "code" | "name" | "qty" | "value") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  // Filter and Sort
  const filteredDesigns = designs
    .filter((d) => {
      const code = (d.design_number || "").toLowerCase();
      const name = (d.name || "").toLowerCase();
      const s = search.toLowerCase();
      return code.includes(s) || name.includes(s);
    })
    .sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      if (sortBy === "code") {
        valA = a.design_number || "";
        valB = b.design_number || "";
      } else if (sortBy === "name") {
        valA = a.name || "";
        valB = b.name || "";
      } else if (sortBy === "qty") {
        valA = a.total_quantity || 0;
        valB = b.total_quantity || 0;
      } else if (sortBy === "value") {
        valA = a.total_value || 0;
        valB = b.total_value || 0;
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

  const formatRupee = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B]">
          <Link href="/finished-stock" className="hover:text-[#6366F1] transition-colors">
            Finished Stock
          </Link>
          <span>/</span>
          <span className="text-[#334155]">Design Stock</span>
        </div>
        <button
          onClick={fetchDesigns}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#6366F1] bg-white border border-[#E2E8F0] px-3 py-1.5 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-all cursor-pointer shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          <span>Sync List</span>
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/finished-stock"
          className="p-2 bg-white hover:bg-gray-50 border border-[#E2E8F0] rounded-xl transition-all cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5 text-[#475569]" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight">Design Stock Levels</h1>
          <p className="text-sm text-[#64748B]">Finished garments inventory counts per catalog design</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 border border-[#E2E8F0] rounded-2xl shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4.5 w-4.5 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Search by Design Code or Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-[#E2E8F0] rounded-xl text-sm placeholder-[#94A3B8] focus:border-[#C7D2FE] focus:ring-1 focus:ring-[#C7D2FE] outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 text-xs font-semibold text-[#475569] bg-white border border-[#E2E8F0] px-3.5 py-2.5 rounded-xl hover:bg-gray-50 transition-all cursor-pointer shadow-sm">
            <SlidersHorizontal className="h-4 w-4 text-[#64748B]" />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#E2E8F0] rounded-2xl p-5 space-y-4 animate-pulse shadow-sm">
              <div className="flex items-center justify-between">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-4 bg-gray-200 rounded w-1/4" />
              </div>
              <div className="h-6 bg-gray-200 rounded w-3/4" />
              <div className="grid grid-cols-2 gap-2">
                <div className="h-8 bg-gray-200 rounded" />
                <div className="h-8 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredDesigns.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDesigns.map((design) => (
            <Link
              key={design.id}
              href={`/finished-stock/designs/${design.id}`}
              className="group bg-white border border-[#E2E8F0] hover:border-[#6366F1] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-[#6366F1] uppercase">
                  <span>{design.design_number}</span>
                  <span className="bg-slate-100 text-[#475569] px-2 py-0.5 rounded-md font-semibold">
                    {design.brand?.name || "No Brand"}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1E293B] group-hover:text-[#6366F1] transition-colors leading-tight">
                    {design.name}
                  </h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    {design.category} {design.sub_category ? `• ${design.sub_category}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2 border-t border-b border-dashed border-[#E2E8F0] py-2.5 text-xs text-[#475569] font-medium">
                  <Layers className="h-4 w-4 text-[#94A3B8]" />
                  <span>Size Set: <strong className="text-[#334155]">{design.size_set?.name || "Standard"}</strong></span>
                  <span className="text-[#94A3B8]">({design.size_set?.sizes?.join(", ")})</span>
                </div>
              </div>

              {/* Stats Footer */}
              <div className="mt-5 pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[#94A3B8] uppercase">Stock On Hand</p>
                  <p className="text-lg font-bold text-[#1E293B]">
                    {(design.total_quantity || 0).toLocaleString()} <span className="text-xs font-normal text-[#64748B]">pcs</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-[#94A3B8] uppercase">Stock Value</p>
                  <p className="text-base font-bold text-[#15803D]">
                    {formatRupee(design.total_value || 0)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-12 text-center text-xs text-gray-400">
          No designs found matching your search.
        </div>
      )}
    </div>
  );
}
