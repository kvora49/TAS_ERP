"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Layers, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SelectFabricRollsModal, SelectedRollInfo } from "./SelectFabricRollsModal";
import { SizeQuantityMatrix } from "@/components/shared/SizeQuantityMatrix";
import { useGstRateLookup } from "@/hooks/useGstRateLookup";
import { useBGradeStock, BGradeStockItem } from "@/hooks/queries/useDefects";

interface ItemsTableProps {
  state: any;
  designs: any[];
}

export function ItemsTable({ state, designs }: ItemsTableProps) {
  const isKacha = state.type === "kacha" || state.gstTreatment === "exempt" || state.isKacha;
  const { lookupGst, hsnOptions } = useGstRateLookup();
  const [selectedDesignId, setSelectedDesignId] = useState("");
  const [selectedColourId, setSelectedColourId] = useState("");
  const [rate, setRate] = useState<number>(0);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [taxPercent, setTaxPercent] = useState<number>(5);
  const [hsnCode, setHsnCode] = useState<string>("6204");

  // Size quantity matrix state: { "28": 10, "30": 15, "32": 20 }
  const [sizeQuantities, setSizeQuantities] = useState<Record<string, number>>({});
  // Fallback single Qty state for non-sized designs
  const [singleQty, setSingleQty] = useState<number>(1);

  // Search & Filter state for Design Select Combobox
  const [designSearch, setDesignSearch] = useState("");
  const [isDesignDropdownOpen, setIsDesignDropdownOpen] = useState(false);

  // Auto-fill states
  const [autoFillAllColors, setAutoFillAllColors] = useState(false);
  const [rollModalOpen, setRollModalOpen] = useState(false);

  // Item Category switch state: "finished_goods" vs "fabric" vs "b_grade"
  const [itemCategory, setItemCategory] = useState<"finished_goods" | "fabric" | "b_grade">("finished_goods");
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);

  // B-Grade stock selection state
  const { data: bGradeData, isLoading: bGradeLoading } = useBGradeStock({ status: "available" });
  const bGradeStockList: BGradeStockItem[] = (bGradeData?.stock || []).filter((s: BGradeStockItem) => s.total_quantity > 0);
  const [selectedBGradeStockId, setSelectedBGradeStockId] = useState<string>("");
  const [bGradeSearch, setBGradeSearch] = useState<string>("");
  const [isBGradeDropdownOpen, setIsBGradeDropdownOpen] = useState(false);
  const [bGradeSizeQuantities, setBGradeSizeQuantities] = useState<Record<string, number>>({});
  const [bGradeRate, setBGradeRate] = useState<number>(0);
  const [bGradeHsn, setBGradeHsn] = useState<string>("6204");
  const [bGradeTaxPercent, setBGradeTaxPercent] = useState<number>(5);
  const [bGradeDiscountPercent, setBGradeDiscountPercent] = useState<number>(0);

  useEffect(() => {
    fetch("/api/master-data/raw-materials")
      .then((res) => res.json())
      .then((data) => setRawMaterials(data.materials || []))
      .catch(() => {});
  }, []);

  const handleAddFabricRolls = (selectedRolls: SelectedRollInfo[]) => {
    const grouped: Record<string, SelectedRollInfo[]> = {};
    selectedRolls.forEach((r) => {
      const key = `${r.material_type_id}__${r.grade || ""}__${r.design_name || ""}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    });

    const newItems: any[] = [];
    Object.entries(grouped).forEach(([_, rollList]) => {
      const matId = rollList[0].material_type_id;
      const matName = rollList[0].material_name;
      const grade = rollList[0].grade;
      const designName = rollList[0].design_name;
      const totalQty = rollList.reduce((sum, r) => sum + r.meters, 0);
      const avgRate = rollList[0].rate || rate || 0;
      const gross = totalQty * avgRate;

      // Match raw material type to obtain accurate HSN and GST rate
      const matchedMat = rawMaterials.find((m) => m.id === matId);
      const fabricHsn = matchedMat?.hsn_code || "5208";
      const resolvedGst = lookupGst(fabricHsn, avgRate, matchedMat?.gst_percent ?? 5);
      const taxPct = isKacha ? 0 : (resolvedGst ? resolvedGst.gstPercent : 5);

      const netTaxable = gross;
      const gstAmt = netTaxable * (taxPct / 100);

      newItems.push({
        item_type: "fabric",
        material_type_id: matId,
        item_name: matName,
        grade,
        design_name: designName,
        hsn_sac: fabricHsn,
        unit: "Meters",
        quantity: totalQty,
        rate: avgRate,
        discount_percent: 0,
        taxable_value: netTaxable,
        tax_percent: taxPct,
        gst_percent: taxPct,
        gst_amount: gstAmt,
        amount: netTaxable + gstAmt,
        rolls: rollList,
      });
    });

    state.setItems((prev: any[]) => [...prev, ...newItems]);
    toast.success(`Added ${selectedRolls.length} fabric rolls to invoice`);
  };

  const selectedDesign = designs.find((d) => d.id === selectedDesignId);
  const colours = selectedDesign?.design_colours || [];
  const sizes: string[] = selectedDesign?.size_set?.sizes || [];

  // Filtered designs for searchable combobox
  const filteredDesigns = designs.filter((d) => {
    if (d.is_active === false && d.id !== selectedDesignId) return false;
    const code = (d.design_number || d.code || "").toLowerCase();
    const name = (d.name || "").toLowerCase();
    const term = designSearch.toLowerCase();
    return code.includes(term) || name.includes(term);
  });

  // Reset & initialize fields whenever selected design changes
  useEffect(() => {
    if (selectedDesign) {
      const designRate = Number(selectedDesign.sale_price || 0);
      setRate(designRate);
      setSelectedColourId(colours[0]?.id || "");

      const designHsn = selectedDesign.hsn_code || selectedDesign.hsn_sac || "";
      if (designHsn) {
        setHsnCode(designHsn);
        const resolved = lookupGst(designHsn, designRate);
        if (resolved) {
          setTaxPercent(resolved.gstPercent);
        }
      }

      if (sizes.length > 0) {
        const init: Record<string, number> = {};
        sizes.forEach((s) => {
          init[s] = 0;
        });
        setSizeQuantities(init);
      } else {
        setSizeQuantities({});
        setSingleQty(1);
      }
    } else {
      setSizeQuantities({});
      setRate(0);
    }
  }, [selectedDesignId, selectedDesign, lookupGst]);

  const selectedBGradeItem = bGradeStockList.find((s) => s.id === selectedBGradeStockId);

  const filteredBGradeItems = bGradeStockList.filter((s) => {
    const term = bGradeSearch.toLowerCase();
    const dNum = (s.design?.design_number || "").toLowerCase();
    const dName = (s.design?.name || "").toLowerCase();
    const col = (s.colour?.colour_name || "").toLowerCase();
    const gName = (s.godown?.name || "").toLowerCase();
    return dNum.includes(term) || dName.includes(term) || col.includes(term) || gName.includes(term);
  });

  useEffect(() => {
    if (selectedBGradeItem) {
      const defaultRate = Number(selectedBGradeItem.b_grade_sale_price || selectedBGradeItem.cost_per_piece || 0);
      setBGradeRate(defaultRate);

      const matchedDesign = designs.find((d) => d.id === selectedBGradeItem.design_id);
      const designHsn = matchedDesign?.hsn_code || matchedDesign?.hsn_sac || "6204";
      setBGradeHsn(designHsn);
      const resolved = lookupGst(designHsn, defaultRate);
      if (resolved) {
        setBGradeTaxPercent(resolved.gstPercent);
      }

      const init: Record<string, number> = {};
      for (const sz of Object.keys(selectedBGradeItem.size_quantities || {})) {
        init[sz] = 0;
      }
      setBGradeSizeQuantities(init);
    } else {
      setBGradeRate(0);
      setBGradeSizeQuantities({});
    }
  }, [selectedBGradeStockId, selectedBGradeItem, lookupGst, designs]);

  const handleBGradeRateChange = (newRate: number) => {
    setBGradeRate(newRate);
    if (bGradeHsn) {
      const resolved = lookupGst(bGradeHsn, newRate);
      if (resolved && resolved.isAutoTier) {
        setBGradeTaxPercent(resolved.gstPercent);
      }
    }
  };

  const handleBGradeHsnChange = (newHsn: string) => {
    setBGradeHsn(newHsn);
    const resolved = lookupGst(newHsn, bGradeRate);
    if (resolved) {
      setBGradeTaxPercent(resolved.gstPercent);
    }
  };

  const totalBGradeMatrixQty = Object.values(bGradeSizeQuantities).reduce((acc, q) => acc + (Number(q) || 0), 0);

  const handleAddBGradeItem = () => {
    if (!selectedBGradeItem) {
      toast.error("Please select a B-Grade stock item");
      return;
    }
    if (totalBGradeMatrixQty <= 0) {
      toast.error("Please enter quantity for at least one size");
      return;
    }

    const availableSizes = selectedBGradeItem.size_quantities || {};
    for (const [sz, q] of Object.entries(bGradeSizeQuantities)) {
      const avail = Number(availableSizes[sz] || 0);
      if (q > avail) {
        toast.error(`Size ${sz}: cannot sell ${q} pcs. Only ${avail} available in B-Grade.`);
        return;
      }
    }

    const matchedDesign = designs.find((d) => d.id === selectedBGradeItem.design_id);
    const designCode = selectedBGradeItem.design?.design_number || matchedDesign?.design_number || matchedDesign?.code || "B-GRADE";
    const designName = selectedBGradeItem.design?.name || matchedDesign?.name || "B-Grade Seconds";
    const colourName = selectedBGradeItem.colour?.colour_name || "Default";

    const newItems: any[] = [];
    Object.entries(bGradeSizeQuantities).forEach(([sz, qtyVal]) => {
      const q = Number(qtyVal || 0);
      if (q > 0) {
        const discountFactor = 1 - Number(bGradeDiscountPercent || 0) / 100;
        const lineAmount = q * Number(bGradeRate || 0) * discountFactor;

        newItems.push({
          id: crypto.randomUUID(),
          item_type: "b_grade",
          is_b_grade: true,
          b_grade_stock_id: selectedBGradeItem.id,
          design_id: selectedBGradeItem.design_id,
          design_code: designCode,
          design_name: `${designName} (B-Grade)`,
          colour_id: selectedBGradeItem.colour_id || null,
          colour_name: colourName,
          size: sz,
          quantity: q,
          unit: "Pcs",
          hsn_sac: bGradeHsn || "6204",
          rate: Number(bGradeRate || 0),
          discount_percent: Number(bGradeDiscountPercent || 0),
          tax_percent: isKacha ? 0 : Number(bGradeTaxPercent || 0),
          amount: lineAmount,
        });
      }
    });

    state.setItems((prev: any[]) => [...prev, ...newItems]);
    toast.success(`Added ${totalBGradeMatrixQty} B-Grade Pcs to invoice`);

    setSelectedBGradeStockId("");
    setBGradeSizeQuantities({});
  };

  // Handle HSN Code change with instant GST rate lookup
  const handleHsnChange = (newHsn: string) => {
    setHsnCode(newHsn);
    const resolved = lookupGst(newHsn, rate);
    if (resolved) {
      setTaxPercent(resolved.gstPercent);
    }
  };

  // Handle Unit Rate change with auto-tier GST recalculation
  const handleRateChange = (newRate: number) => {
    setRate(newRate);
    if (hsnCode) {
      const resolved = lookupGst(hsnCode, newRate);
      if (resolved && resolved.isAutoTier) {
        setTaxPercent(resolved.gstPercent);
      }
    }
  };

  // Handle single size input change with optional Auto-Fill all sizes capability
  const handleSizeQtyChange = (changedSize: string, value: number) => {
    const qtyVal = Math.max(0, value);

    setSizeQuantities((prev) => {
      const next = { ...prev, [changedSize]: qtyVal };
      return next;
    });
  };

  // Helper to trigger explicit Auto-Fill across all sizes with value from first size or entered value
  const applyAutoFillAllSizes = (fillValue: number) => {
    if (sizes.length === 0) return;
    const next: Record<string, number> = {};
    sizes.forEach((s) => {
      next[s] = Math.max(0, fillValue);
    });
    setSizeQuantities(next);
  };

  // Calculate total pieces from matrix
  const totalMatrixQty = sizes.length > 0
    ? Object.values(sizeQuantities).reduce((acc, qty) => acc + (Number(qty) || 0), 0)
    : Number(singleQty || 0);

  const handleAddItem = () => {
    if (!selectedDesignId) {
      toast.error("Please select a design");
      return;
    }

    if (totalMatrixQty <= 0) {
      toast.error("Please enter quantity for at least one size");
      return;
    }

    const designCode = selectedDesign?.design_number || selectedDesign?.code || "—";
    const designName = selectedDesign?.name || "—";

    // Determine target colours list based on autoFillAllColors checkbox
    const targetColoursList = autoFillAllColors && colours.length > 0
      ? colours
      : [colours.find((c: any) => c.id === selectedColourId) || { id: selectedColourId || null, colour_name: "Default" }];

    const newItems: any[] = [];

    // Process for each colour in targetColoursList
    targetColoursList.forEach((colObj: any) => {
      const colourId = colObj.id || null;
      const colourName = colObj.colour_name || "Default";

      if (sizes.length > 0) {
        sizes.forEach((sz) => {
          const qtyVal = Number(sizeQuantities[sz] || 0);
          if (qtyVal > 0) {
            const discountFactor = 1 - Number(discountPercent || 0) / 100;
            const lineAmount = qtyVal * Number(rate || 0) * discountFactor;

            newItems.push({
              id: crypto.randomUUID(),
              design_id: selectedDesignId,
              design_code: designCode,
              design_name: designName,
              colour_id: colourId,
              colour_name: colourName,
              size: sz,
              quantity: qtyVal,
              unit: "Pcs",
              hsn_sac: hsnCode || selectedDesign?.hsn_code || selectedDesign?.hsn_sac || null,
              rate: Number(rate || 0),
              discount_percent: Number(discountPercent || 0),
              tax_percent: isKacha ? 0 : Number(taxPercent || 0),
              amount: lineAmount,
            });
          }
        });
      } else {
        const qtyVal = Number(singleQty || 0);
        if (qtyVal > 0) {
          const discountFactor = 1 - Number(discountPercent || 0) / 100;
          const lineAmount = qtyVal * Number(rate || 0) * discountFactor;

          newItems.push({
            id: crypto.randomUUID(),
            design_id: selectedDesignId,
            design_code: designCode,
            design_name: designName,
            colour_id: colourId,
            colour_name: colourName,
            size: "—",
            quantity: qtyVal,
            unit: "Pcs",
            hsn_sac: hsnCode || selectedDesign?.hsn_code || selectedDesign?.hsn_sac || null,
            rate: Number(rate || 0),
            discount_percent: Number(discountPercent || 0),
            tax_percent: Number(taxPercent || 0),
            amount: lineAmount,
          });
        }
      }
    });

    if (newItems.length === 0) return;

    state.setItems((prev: any[]) => {
      const next = [...prev];
      newItems.forEach((newItem) => {
        const existingIndex = next.findIndex(
          (item) =>
            item.design_id === newItem.design_id &&
            ((newItem.colour_id && item.colour_id === newItem.colour_id) || item.colour_name === newItem.colour_name) &&
            String(item.size).trim().toLowerCase() === String(newItem.size).trim().toLowerCase()
        );

        if (existingIndex >= 0) {
          const existing = next[existingIndex];
          const updatedQty = Number(existing.quantity || 0) + Number(newItem.quantity || 0);
          const discountFactor = 1 - Number(existing.discount_percent || 0) / 100;
          const updatedAmount = updatedQty * Number(existing.rate || 0) * discountFactor;

          next[existingIndex] = {
            ...existing,
            quantity: updatedQty,
            amount: updatedAmount,
          };
        } else {
          next.push(newItem);
        }
      });
      return next;
    });

    const addedTotalQty = newItems.reduce((acc, curr) => acc + curr.quantity, 0);
    toast.success(`Added ${addedTotalQty} Pcs to invoice`);

    // Reset size matrix quantities for next entry while preserving design/rate
    if (sizes.length > 0) {
      const resetQty: Record<string, number> = {};
      sizes.forEach((s) => {
        resetQty[s] = 0;
      });
      setSizeQuantities(resetQty);
    } else {
      setSingleQty(1);
    }
  };

  const handleItemQtyChange = (index: number, newQty: number) => {
    const qty = Math.max(1, newQty);
    state.setItems((prev: any[]) => {
      const next = [...prev];
      const target = next[index];
      if (!target) return prev;
      const discountFactor = 1 - Number(target.discount_percent || 0) / 100;
      const amount = qty * Number(target.rate || 0) * discountFactor;
      next[index] = { ...target, quantity: qty, amount };
      return next;
    });
  };

  const handleItemRateChange = (index: number, newRate: number) => {
    const rateVal = Math.max(0, newRate);
    state.setItems((prev: any[]) => {
      const next = [...prev];
      const target = next[index];
      if (!target) return prev;
      const discountFactor = 1 - Number(target.discount_percent || 0) / 100;
      const amount = Number(target.quantity || 0) * rateVal * discountFactor;

      let taxPercentVal = target.tax_percent;
      if (!isKacha && target.hsn_sac) {
        const resolved = lookupGst(target.hsn_sac, rateVal);
        if (resolved && resolved.isAutoTier) {
          taxPercentVal = resolved.gstPercent;
        }
      }

      next[index] = {
        ...target,
        rate: rateVal,
        amount,
        tax_percent: taxPercentVal,
        gst_percent: taxPercentVal,
      };
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    state.setItems((prev: any[]) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6 select-none">
      {/* 1. Design & Configuration Selection Header */}
      <div className="bg-[var(--card-bg)] p-3.5 sm:p-5 rounded-xl border border-[var(--border)] space-y-4 shadow-[var(--shadow-sm)]">
        {/* Item Category Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold text-[var(--text-muted)] uppercase tracking-wider">Item Category:</span>
            <div className="flex items-center bg-[var(--page-bg)] border border-[var(--border)] p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setItemCategory("finished_goods")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  itemCategory === "finished_goods"
                    ? "bg-[var(--primary)] text-white shadow-md shadow-indigo-500/20"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                👔 Finished Goods (Garments)
              </button>
              <button
                type="button"
                onClick={() => setItemCategory("fabric")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                  itemCategory === "fabric"
                    ? "bg-[var(--primary)] text-white shadow-md shadow-indigo-500/20"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Scissors className="h-3.5 w-3.5" />
                🧵 Fabric Rolls (Raw Material)
              </button>
              <button
                type="button"
                onClick={() => setItemCategory("b_grade")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                  itemCategory === "b_grade"
                    ? "bg-amber-600 text-white shadow-md shadow-amber-500/20"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                🏷️ B-Grade (Seconds)
              </button>
            </div>
          </div>
        </div>

        {itemCategory === "fabric" ? (
          /* Fabric Roll Fast Action Box */
          <div className="bg-[var(--primary-light)] p-4 rounded-xl border border-[var(--primary)]/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Scissors className="h-4 w-4 text-[var(--primary)]" />
                <h4 className="text-xs font-bold text-[var(--text-primary)]">Sell Fabric Rolls from Inventory</h4>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] font-medium">
                Click below to browse available rolls in stock, pick roll numbers, and enter meters to sell.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRollModalOpen(true)}
              className="w-full sm:w-auto px-5 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 cursor-pointer flex-shrink-0"
            >
              <Scissors className="h-4 w-4" />
              <span>+ Select Fabric Rolls</span>
            </button>
          </div>
        ) : itemCategory === "b_grade" ? (
          /* B-Grade Stock Action Box */
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              {/* SEARCHABLE B-GRADE BATCH SELECTOR */}
              <div className="md:col-span-2 space-y-1 relative">
                <label className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                  B-Grade Stock Batch <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsBGradeDropdownOpen(!isBGradeDropdownOpen)}
                    className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs font-semibold text-left flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <span className="truncate text-[var(--text-primary)]">
                      {selectedBGradeItem
                        ? `${selectedBGradeItem.design?.design_number || "Design"} - ${selectedBGradeItem.colour?.colour_name || "Colour"} (${selectedBGradeItem.total_quantity} pcs in ${selectedBGradeItem.godown?.name || "Godown"})`
                        : bGradeStockList.length === 0
                        ? "-- No B-Grade Stock Available --"
                        : "-- Select B-Grade Stock Batch --"}
                    </span>
                    <span className="text-[var(--text-faint)] text-[10px]">▼</span>
                  </button>

                  {isBGradeDropdownOpen && (
                    <div className="absolute z-50 top-11 left-0 right-0 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-xl p-2 space-y-2 max-h-64 overflow-y-auto">
                      <input
                        type="text"
                        placeholder="Search Design, Colour or Godown..."
                        value={bGradeSearch}
                        onChange={(e) => setBGradeSearch(e.target.value)}
                        className="w-full h-9 px-3 text-xs bg-[var(--page-bg)] text-[var(--text-primary)] border border-[var(--border)] rounded-lg outline-none focus:ring-1 focus:ring-amber-500"
                        autoFocus
                      />
                      <div className="space-y-1">
                        {filteredBGradeItems.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSelectedBGradeStockId(s.id);
                              setIsBGradeDropdownOpen(false);
                              setBGradeSearch("");
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                              s.id === selectedBGradeStockId
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20"
                                : "hover:bg-[var(--table-row-hover)] text-[var(--text-body)]"
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                                  {s.design?.design_number || "Design"}
                                </span>
                                <span className="truncate text-[var(--text-primary)] font-semibold">
                                  {s.design?.name}
                                </span>
                              </div>
                              <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                                <span>{s.colour?.colour_name || "Colour"}</span>
                                <span>·</span>
                                <span>Godown: {s.godown?.name}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 block font-mono text-xs">
                                {s.total_quantity} pcs
                              </span>
                              <span className="text-[10px] text-[var(--text-faint)]">
                                ₹{s.b_grade_sale_price || s.cost_per_piece || 0}/pc
                              </span>
                            </div>
                          </button>
                        ))}
                        {filteredBGradeItems.length === 0 && (
                          <div className="p-3 text-center text-xs text-[var(--text-faint)]">
                            No B-Grade stock found matching &quot;{bGradeSearch}&quot;
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Rate / Unit Price Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  B-Grade Rate (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={bGradeRate}
                  onChange={(e) => handleBGradeRateChange(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {!isKacha && (
                <>
                  {/* HSN Code */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                      HSN Code
                    </label>
                    <input
                      type="text"
                      list="sales-hsn-datalist"
                      value={bGradeHsn}
                      onChange={(e) => handleBGradeHsnChange(e.target.value)}
                      placeholder="6204"
                      className="w-full h-10 px-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-center font-mono font-bold text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  {/* GST % */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                      GST %
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="28"
                      value={bGradeTaxPercent}
                      onChange={(e) => setBGradeTaxPercent(parseFloat(e.target.value) || 0)}
                      placeholder="12"
                      className="w-full h-10 px-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-center font-mono font-bold text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </>
              )}

              {/* Discount % */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Discount %
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={bGradeDiscountPercent}
                  onChange={(e) => setBGradeDiscountPercent(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full h-10 px-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-center font-mono font-bold text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* B-Grade Size Matrix */}
            {selectedBGradeItem && (
              <div className="space-y-3 pt-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  Quantity to Sell by Size (Stock Available in {selectedBGradeItem.godown?.name || "Godown"})
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {Object.entries(selectedBGradeItem.size_quantities || {}).map(([sz, avail]) => (
                    <div key={sz} className="p-2.5 rounded-lg bg-[var(--page-bg)] border border-[var(--border)] text-center space-y-1">
                      <div className="text-xs font-bold text-[var(--text-primary)] uppercase">{sz}</div>
                      <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                        Avail: {Number(avail) || 0}
                      </div>
                      <input
                        type="number"
                        min="0"
                        max={Number(avail) || 0}
                        value={bGradeSizeQuantities[sz] ?? 0}
                        onChange={(e) => {
                          const val = Math.min(Number(avail) || 0, Math.max(0, parseInt(e.target.value) || 0));
                          setBGradeSizeQuantities((prev) => ({ ...prev, [sz]: val }));
                        }}
                        className="w-full text-center bg-[var(--input-bg)] border border-[var(--input-border)] text-[var(--text-primary)] rounded h-8 text-xs font-bold focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  ))}
                </div>

                {/* Add Button Row */}
                <div className="flex items-center justify-end gap-3 pt-1">
                  <span className="text-xs text-[var(--text-secondary)]">
                    Line Total: <strong className="text-[var(--text-primary)] font-bold">₹{(totalBGradeMatrixQty * bGradeRate * (1 - bGradeDiscountPercent / 100)).toFixed(2)}</strong> ({totalBGradeMatrixQty} Pcs B-Grade)
                  </span>
                  <Button
                    type="button"
                    onClick={handleAddBGradeItem}
                    disabled={totalBGradeMatrixQty <= 0 || bGradeRate < 0}
                    className="bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-1.5 h-10 px-5 font-bold shadow-md shadow-amber-600/10 cursor-pointer"
                  >
                    <Plus size={16} />
                    <span>Add B-Grade to Invoice</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          {/* SEARCHABLE DESIGN COMBOBOX DROPDOWN */}
          <div className="md:col-span-2 space-y-1 relative">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Design <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDesignDropdownOpen(!isDesignDropdownOpen)}
                className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs font-semibold text-left flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
              >
                <span className="truncate text-[var(--text-primary)]">
                  {selectedDesign
                    ? `${selectedDesign.design_number || selectedDesign.code} - ${selectedDesign.name}`
                    : "-- Select Design --"}
                </span>
                <span className="text-[var(--text-faint)] text-[10px]">▼</span>
              </button>

              {isDesignDropdownOpen && (
                <div className="absolute z-50 top-11 left-0 right-0 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl shadow-xl p-2 space-y-2 max-h-64 overflow-y-auto">
                  <input
                    type="text"
                    placeholder="Search Design Code or Name..."
                    value={designSearch}
                    onChange={(e) => setDesignSearch(e.target.value)}
                    className="w-full h-9 px-3 text-xs bg-[var(--page-bg)] text-[var(--text-primary)] border border-[var(--border)] rounded-lg outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
                    autoFocus
                  />
                  <div className="space-y-1">
                    {filteredDesigns.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          setSelectedDesignId(d.id);
                          setIsDesignDropdownOpen(false);
                          setDesignSearch("");
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                          d.id === selectedDesignId ? "bg-[var(--primary-light)] text-[var(--primary)] font-bold" : "hover:bg-[var(--table-row-hover)] text-[var(--text-body)]"
                        }`}
                      >
                        <span className="font-mono font-bold text-[var(--primary)]">
                          {d.design_number || d.code}
                        </span>
                        <span className="truncate ml-2 text-[var(--text-body)]">{d.name}</span>
                      </button>
                    ))}
                    {filteredDesigns.length === 0 && (
                      <div className="p-3 text-center text-xs text-[var(--text-faint)]">
                        No designs found matching &quot;{designSearch}&quot;
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Colour
              </label>
              {colours.length > 0 && (
                <label className="flex items-center gap-1 cursor-pointer text-[10px] text-indigo-600 font-bold">
                  <input
                    type="checkbox"
                    checked={autoFillAllColors}
                    onChange={(e) => setAutoFillAllColors(e.target.checked)}
                    className="h-3 w-3 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>All Colours</span>
                </label>
              )}
            </div>
            <select
              value={selectedColourId}
              onChange={(e) => setSelectedColourId(e.target.value)}
              disabled={!selectedDesignId}
              className="w-full h-10 px-3 bg-[var(--input-bg)] text-[var(--text-primary)] border border-[var(--input-border)] rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)] disabled:bg-[var(--page-bg)] disabled:opacity-75"
            >
              <option value="">-- Select Colour --</option>
              {colours.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.colour_name}
                </option>
              ))}
            </select>
          </div>

          {/* Rate / Unit Price Input */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
              Unit Rate (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={rate}
              onChange={(e) => handleRateChange(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-full h-10 px-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs font-bold text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
            />
          </div>

          {!isKacha && (
            <>
              {/* HSN Code */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  HSN Code
                </label>
                <input
                  type="text"
                  list="sales-hsn-datalist"
                  value={hsnCode}
                  onChange={(e) => handleHsnChange(e.target.value)}
                  placeholder="6204"
                  className="w-full h-10 px-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-center font-mono font-bold text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
                />
                <datalist id="sales-hsn-datalist">
                  {hsnOptions.map((opt) => (
                    <option key={opt.hsn_code} value={opt.hsn_code}>
                      {opt.label}
                    </option>
                  ))}
                </datalist>
              </div>

              {/* GST % */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                  GST %
                </label>
                <input
                  type="number"
                  min="0"
                  max="28"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                  placeholder="12"
                  className="w-full h-10 px-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-xs text-center font-mono font-bold text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
                />
              </div>
            </>
          )}
        </div>

        {/* 2. Sizing & Quantity Matrix Box */}
        {selectedDesignId && (
          <div className="space-y-3 pt-2">
            {sizes.length > 0 ? (
              <SizeQuantityMatrix
                sizes={sizes}
                sizeQuantities={sizeQuantities}
                onChange={(updated) => setSizeQuantities(updated)}
                autoFillAllColors={autoFillAllColors}
                onAutoFillAllColorsChange={setAutoFillAllColors}
                showAllColorsOption={true}
                sizeSetName={selectedDesign?.size_set?.name}
              />
            ) : (
              <div className="bg-[var(--card-bg)] p-3 rounded-lg border border-[var(--border)] flex items-center justify-between gap-4">
                <span className="text-xs font-bold text-[var(--text-secondary)] uppercase">Quantity (Pcs)</span>
                <input
                  type="number"
                  min="1"
                  value={singleQty}
                  onChange={(e) => setSingleQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-24 h-9 px-3 border border-[var(--input-border)] bg-[var(--input-bg)] rounded-md text-xs font-bold text-center text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
                />
              </div>
            )}

            {/* Add Button Row */}
            {(() => {
              const effectiveMultiplier = autoFillAllColors && colours.length > 0 ? colours.length : 1;
              const displayTotalQty = totalMatrixQty * effectiveMultiplier;
              const displayLineTotal = displayTotalQty * rate * (1 - discountPercent / 100);

              return (
                <div className="flex items-center justify-end gap-3 pt-1">
                  <span className="text-xs text-[var(--text-secondary)]">
                    Line Total: <strong className="text-[var(--text-primary)] font-bold">₹{displayLineTotal.toFixed(2)}</strong> ({displayTotalQty} Pcs{autoFillAllColors && colours.length > 0 ? ` across ${colours.length} colours` : ""})
                  </span>
                  <Button
                    type="button"
                    onClick={handleAddItem}
                    disabled={!selectedDesignId || totalMatrixQty <= 0 || rate < 0}
                    className="bg-[#6366F1] hover:bg-[#4F46E5] text-white flex items-center justify-center gap-1.5 h-10 px-5 font-bold shadow-md shadow-indigo-600/10 cursor-pointer"
                  >
                    <Plus size={16} />
                    <span>Add Items to Invoice</span>
                  </Button>
                </div>
              );
            })()}
          </div>
        )}
      </>
    )}
  </div>

      {/* 3. Added Line Items Section (Mobile Cards + Desktop Table) */}
      <div className="border border-[var(--border)] rounded-xl overflow-hidden shadow-[var(--shadow-sm)] bg-[var(--card-bg)]">
        {/* Header strip */}
        <div className="px-4 py-3 bg-[var(--table-header-bg)] border-b border-[var(--border)] flex items-center justify-between">
          <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
            Added Invoice Items ({state.items.length})
          </span>
          {state.items.length > 0 && (
            <span className="text-xs font-bold text-[var(--primary)] font-mono">
              Total: ₹{state.items.reduce((acc: number, it: any) => acc + (Number(it.amount) || 0), 0).toFixed(2)}
            </span>
          )}
        </div>

        {/* MOBILE VIEW: Cards List (md:hidden) */}
        <div className="md:hidden divide-y divide-[var(--border)]">
          {state.items.map((it: any, index: number) => {
            const isFabric = it.item_type === "fabric" || !!it.material_type_id;
            const isBGrade = !!(it.is_b_grade || it.item_type === "b_grade" || it.b_grade_stock_id);
            const matchedDesign = designs.find((d) => d.id === it.design_id);
            const designCode = isFabric
              ? "FABRIC"
              : (it.design_code && it.design_code !== "—")
              ? it.design_code
              : matchedDesign?.design_number || matchedDesign?.code || "—";
            const designName = isFabric
              ? it.item_name || "Raw Material Fabric"
              : (it.design_name && it.design_name !== "—")
              ? it.design_name
              : matchedDesign?.name || "—";
            const colourName = isFabric
              ? "—"
              : (it.colour_name && it.colour_name !== "Default")
              ? it.colour_name
              : matchedDesign?.design_colours?.find((c: any) => c.id === it.colour_id)?.colour_name || "Default";

            return (
              <div key={it.id || index} className="p-3.5 space-y-2.5 bg-[var(--card-bg)]">
                {/* Card Title & Delete */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[11px] bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20">
                        {designCode}
                      </span>
                      {isBGrade && (
                        <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          B-Grade
                        </span>
                      )}
                      <span className="font-bold text-xs text-[var(--text-primary)] truncate">
                        {designName}
                      </span>
                    </div>

                    {isFabric && (
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {it.grade && (
                          <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded text-[10px] font-bold">
                            Grade: {it.grade}
                          </span>
                        )}
                        {it.design_name && (
                          <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded text-[10px] font-semibold">
                            Design: {it.design_name}
                          </span>
                        )}
                      </div>
                    )}

                    {isFabric && it.rolls && it.rolls.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {it.rolls.map((r: any, rIdx: number) => (
                          <span key={rIdx} className="px-1.5 py-0.5 bg-[var(--page-bg)] border border-[var(--border)] rounded text-[10px] font-mono font-bold text-[var(--primary)]">
                            Roll #{r.roll_number}: {r.meters}m{r.shade ? ` (${r.shade})` : ""}{r.grade ? ` [${r.grade}]` : ""}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[var(--text-muted)]">
                      <span>Colour: <strong className="text-[var(--text-secondary)] font-semibold">{colourName}</strong></span>
                      <span>·</span>
                      <span>Size: <strong className="text-[var(--text-secondary)] font-semibold">{isFabric ? "Meters" : it.size || "Pcs"}</strong></span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg shrink-0 cursor-pointer active:scale-95"
                    title="Remove item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Qty & Rate Inputs (Mobile Touch-Friendly) */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                      Quantity ({isFabric ? "Mtr" : "Pcs"})
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={it.quantity}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleItemQtyChange(index, parseFloat(e.target.value) || 1)}
                      className="w-full h-9 px-2.5 text-sm font-bold text-center border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                      Rate (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.rate}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleItemRateChange(index, parseFloat(e.target.value) || 0)}
                      className="w-full h-9 px-2.5 text-sm font-bold text-center border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)]"
                    />
                  </div>
                </div>

                {/* Subtotal & Taxes Footer */}
                <div className="flex items-center justify-between pt-1 border-t border-[var(--border-light)] text-xs">
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                    {it.discount_percent > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-semibold text-[10px]">
                        Disc: {it.discount_percent}%
                      </span>
                    )}
                    {!isKacha && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 font-semibold text-[10px]">
                        GST: {it.tax_percent}%
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[var(--text-muted)] mr-1">Total:</span>
                    <strong className="text-sm font-bold font-mono text-[var(--text-primary)]">
                      ₹{(Number(it.amount) || 0).toFixed(2)}
                    </strong>
                  </div>
                </div>
              </div>
            );
          })}

          {state.items.length === 0 && (
            <div className="p-8 text-center text-xs text-[var(--text-faint)] italic">
              No items added yet. Select a design above to add items to invoice.
            </div>
          )}
        </div>

        {/* DESKTOP VIEW: Full 10-column table (hidden md:block) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--table-header-bg)] font-bold text-[var(--text-muted)] uppercase tracking-wider text-[11px]">
                <th className="p-3.5 pl-4">Design Code</th>
                <th className="p-3.5">Design Name</th>
                <th className="p-3.5">Colour</th>
                <th className="p-3.5">Size</th>
                <th className="p-3.5 text-right">Qty</th>
                <th className="p-3.5 text-right">Rate</th>
                <th className="p-3.5 text-right">Disc %</th>
                {!isKacha && <th className="p-3.5 text-right">Tax %</th>}
                <th className="p-3.5 text-right">Total</th>
                <th className="p-3.5 text-center">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-[var(--card-bg)]">
              {state.items.map((it: any, index: number) => {
                const isFabric = it.item_type === "fabric" || !!it.material_type_id;
                const isBGrade = !!(it.is_b_grade || it.item_type === "b_grade" || it.b_grade_stock_id);
                const matchedDesign = designs.find((d) => d.id === it.design_id);
                const designCode = isFabric
                  ? "FABRIC"
                  : (it.design_code && it.design_code !== "—")
                  ? it.design_code
                  : matchedDesign?.design_number || matchedDesign?.code || "—";
                const designName = isFabric
                  ? it.item_name || "Raw Material Fabric"
                  : (it.design_name && it.design_name !== "—")
                  ? it.design_name
                  : matchedDesign?.name || "—";
                const colourName = isFabric
                  ? "—"
                  : (it.colour_name && it.colour_name !== "Default")
                  ? it.colour_name
                  : matchedDesign?.design_colours?.find((c: any) => c.id === it.colour_id)?.colour_name || "Default";

                return (
                  <tr key={it.id || index} className="hover:bg-[var(--table-row-hover)] transition-colors">
                    <td className="p-3 pl-4 font-mono font-bold text-[var(--primary)]">
                      <div className="flex items-center gap-1.5">
                        <span>{designCode}</span>
                        {isBGrade && (
                          <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            B-Grade
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 font-semibold text-[var(--text-primary)]">
                      <div>
                        <span>{designName}</span>
                        {isFabric && (
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {it.grade && (
                              <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded text-[10px] font-bold">
                                Grade: {it.grade}
                              </span>
                            )}
                            {it.design_name && (
                              <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded text-[10px] font-semibold">
                                Design: {it.design_name}
                              </span>
                            )}
                          </div>
                        )}
                        {isFabric && it.rolls && it.rolls.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {it.rolls.map((r: any, rIdx: number) => (
                              <span key={rIdx} className="px-1.5 py-0.5 bg-[var(--primary-light)] border border-[var(--border)] rounded text-[10px] font-mono font-bold text-[var(--primary)]">
                                Roll #{r.roll_number}: {r.meters}m{r.shade ? ` (${r.shade})` : ""}{r.grade ? ` [${r.grade}]` : ""}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-[var(--text-muted)]">{colourName}</td>
                    <td className="p-3 font-bold text-[var(--text-primary)]">
                      <span className="inline-block bg-[var(--page-bg)] border border-[var(--border)] px-2 py-0.5 rounded text-[11px]">
                        {isFabric ? "Meters" : it.size || "Pcs"}
                      </span>
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={it.quantity}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handleItemQtyChange(index, parseFloat(e.target.value) || 1)}
                        className="w-20 h-8 px-2 text-right border border-[var(--input-border)] rounded font-bold text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)] bg-[var(--input-bg)]"
                      />
                    </td>
                    <td className="p-2 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={it.rate}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => handleItemRateChange(index, parseFloat(e.target.value) || 0)}
                        className="w-20 h-8 px-2 text-right border border-[var(--input-border)] rounded font-medium text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--input-focus)] bg-[var(--input-bg)]"
                      />
                    </td>
                    <td className="p-3 text-right text-[var(--text-muted)]">{it.discount_percent}%</td>
                    {!isKacha && <td className="p-3 text-right text-[var(--text-muted)]">{it.tax_percent}%</td>}
                    <td className="p-3 text-right font-extrabold text-[var(--text-primary)]">₹{(Number(it.amount) || 0).toFixed(2)}</td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="p-1 hover:bg-red-500/10 text-red-500 rounded-md transition-colors cursor-pointer"
                        title="Remove Line"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {state.items.length === 0 && (
                <tr>
                  <td colSpan={isKacha ? 9 : 10} className="p-8 text-center text-[var(--text-faint)] italic">
                    No items added yet. Select a design or click &quot;+ Sell Fabric Rolls&quot; above to add invoice items.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fabric Rolls Picker Modal */}
      <SelectFabricRollsModal
        open={rollModalOpen}
        onOpenChange={setRollModalOpen}
        onConfirm={handleAddFabricRolls}
      />
    </div>
  );
}
