"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Info,
  HelpCircle,
  Loader2,
  Search,
  Plus,
  Trash2,
  ScanLine,
  X,
  Sparkles,
  Edit2,
  AlertCircle
} from "lucide-react";
import Link from "next/link";
import WizardHeader from "@/components/shared/WizardHeader";
import BillSummaryPanel from "@/components/shared/BillSummaryPanel";
import { createClient } from "@/lib/supabase/client";
import { calculateGST, GstRate } from "@/lib/utils/gst";
import { toast } from "sonner";

interface Party {
  id: string;
  name: string;
  phone: string | null;
  gstin: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_pincode: string | null;
  payment_terms: string | null;
}

interface User {
  id: string;
  full_name: string;
  role: string;
}

interface DesignColour {
  id: string;
  colour_name: string;
  colour_hex: string | null;
  image_url: string | null;
}

interface Design {
  id: string;
  name: string;
  design_number: string;
  hsn_code: string | null;
  sale_price: number | null;
  size_set: {
    name: string;
    sizes: string[];
  } | null;
  design_colours: DesignColour[];
}

interface BillItem {
  id: string;
  design_id: string;
  design_name: string;
  design_code: string;
  colour_id: string | null;
  colour_name: string;
  size: string;
  quantity: number;
  unit: string;
  rate: number;
  discount_percent: number;
  tax_percent: number;
  amount: number; // Net taxable amount after item-level discount, BEFORE tax (Qty * Rate * (1 - Disc/100))
  cost_per_piece: number;
  description: string;
  stock: number;
  hsn_sac: string | null;
}

interface BillCharge {
  id: string;
  charge_name: string;
  charge_type: "flat" | "per_qty" | "percentage";
  is_taxable: boolean;
  amount: number;
}

export default function CreateSaleBillPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type") as "pakka" | "kacha" | null;

  // Wizard Step State (1 to 4)
  const [step, setStep] = useState(1);

  // DB Lists
  const [parties, setParties] = useState<Party[]>([]);
  const [salesmen, setSalesmen] = useState<User[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [gstRates, setGstRates] = useState<GstRate[]>([]);
  
  // Stock Map: keyed by `designId_colourId_size`
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [costMap, setCostMap] = useState<Record<string, number>>({});

  const [loadingParties, setLoadingParties] = useState(true);
  const [loadingDesigns, setLoadingDesigns] = useState(true);

  // Step 1: Form Fields State
  const [partyId, setPartyId] = useState("");
  const [billType, setBillType] = useState<"pakka" | "kacha">(typeParam === "kacha" ? "kacha" : "pakka");
  const [gstTreatment, setGstTreatment] = useState("regular");
  const [billingAddress, setBillingAddress] = useState("");
  const [mobileNo, setMobileNo] = useState("");
  const [gstin, setGstin] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [priceListId, setPriceListId] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Immediate");
  
  // Additional details collapsible
  const [isAdditionalExpanded, setIsAdditionalExpanded] = useState(false);
  const [transporterName, setTransporterName] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [salesman, setSalesman] = useState("");
  const [remarks, setRemarks] = useState("");

  // Step 2: Added Items State
  const [items, setItems] = useState<BillItem[]>([]);
  
  // Step 2: Add Item Panel State
  const [selectedDesignId, setSelectedDesignId] = useState("");
  const [selectedColourId, setSelectedColourId] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [itemQty, setItemQty] = useState<number>(1);
  const [itemRate, setItemRate] = useState<number>(0);
  const [itemDiscount, setItemDiscount] = useState<number>(0);
  const [itemTaxOverride, setItemTaxOverride] = useState<number | null>(null);
  const [itemDescription, setItemDescription] = useState("");
  const [showOnlyInStock, setShowOnlyInStock] = useState(false);
  const [designSearchQuery, setDesignSearchQuery] = useState("");
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);

  // Barcode Scanner Modal State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const scannerRef = useRef<any>(null);

  // Step 3: Charges & Discount State (Loop 3)
  const [charges, setCharges] = useState<BillCharge[]>([]);
  const [discountType, setDiscountType] = useState<"flat" | "percentage" | null>(null);
  const [discountValue, setDiscountValue] = useState(0);

  const [newChargeName, setNewChargeName] = useState("");
  const [newChargeType, setNewChargeType] = useState<"flat" | "per_qty" | "percentage">("flat");
  const [newChargeIsTaxable, setNewChargeIsTaxable] = useState(true);
  const [newChargeAmount, setNewChargeAmount] = useState<number>(0);
  const [businessGstin, setBusinessGstin] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSaveDropdownOpen, setIsSaveDropdownOpen] = useState(false);

  // Step 4: E-Way Details State (Loop 4)
  const [generateEwayBill, setGenerateEwayBill] = useState(false);
  const [ewayTransporter, setEwayTransporter] = useState("");
  const [ewayVehicleNo, setEwayVehicleNo] = useState("");
  const [ewayPlaceOfSupply, setEwayPlaceOfSupply] = useState("");
  const [ewayValidTill, setEwayValidTill] = useState("");

  const handleSaveBill = async (saveStatus: "active" | "draft") => {
    if (items.length === 0) {
      toast.error("Please add at least one item to proceed");
      return;
    }
    
    setIsSaving(true);
    try {
      const payload = {
        bill_type: billType,
        party_id: partyId,
        bill_date: billDate,
        due_date: dueDate,
        payment_terms: paymentTerms,
        reference_no: referenceNo,
        billing_address: billingAddress,
        phone: mobileNo,
        gstin: gstin,
        gst_treatment: gstTreatment,
        transporter_name: transporterName,
        vehicle_no: vehicleNo,
        salesman: salesman || null,
        remarks: remarks || null,
        items: items.map((it) => ({
          design_id: it.design_id,
          colour_id: it.colour_id,
          size: it.size,
          quantity: it.quantity,
          unit: it.unit,
          rate: it.rate,
          discount_percent: it.discount_percent,
          tax_percent: it.tax_percent,
          amount: it.amount,
          cost_per_piece: it.cost_per_piece,
          description: it.description,
          hsn_sac: it.hsn_sac
        })),
        charges: charges.map((c) => ({
          charge_name: c.charge_name,
          charge_type: c.charge_type,
          is_taxable: c.is_taxable,
          amount: c.amount
        })),
        discount_type: discountType,
        discount_value: discountValue,
        eway_details: generateEwayBill
          ? {
              generate_eway_bill: true,
              transporter: ewayTransporter,
              vehicle_no: ewayVehicleNo,
              place_of_supply: ewayPlaceOfSupply,
              valid_till: ewayValidTill
            }
          : null,
        status: saveStatus
      };

      const res = await fetch("/api/sales/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save bill");
      }

      // Link order converted_bill_id if converting from an order booking
      const orderId = searchParams.get("order_id");
      if (orderId && data.bill?.id) {
        await fetch(`/api/sales/orders/${orderId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            converted_bill_id: data.bill.id
          })
        });
      }

      toast.success(
        saveStatus === "active"
          ? `Invoice ${data.bill?.bill_number} generated successfully!`
          : "Bill saved as draft!"
      );
      router.push("/sales/bills");
      router.refresh();
    } catch (err: any) {
      console.error("Save error:", err);
      toast.error(err.message || "An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  // Fetch Parties (Customers) and Users
  useEffect(() => {
    setLoadingParties(true);
    fetch("/api/parties?type=customer")
      .then((res) => res.json())
      .then((data) => {
        if (data.parties) setParties(data.parties);
      })
      .catch((err) => console.error("Error loading customers:", err))
      .finally(() => setLoadingParties(false));

    fetch("/api/settings/users")
      .then((res) => res.json())
      .then((data) => {
        if (data.users) {
          setSalesmen(data.users.filter((u: any) => u.role === "staff" || u.role === "admin" || u.role === "owner"));
        }
      })
      .catch((err) => console.error("Error loading salesmen:", err));

    const loadBusinessGstin = async () => {
      const supabase = createClient();
      const { data: business } = await supabase
        .from("businesses")
        .select("gstin")
        .limit(1)
        .maybeSingle();
      if (business?.gstin) {
        setBusinessGstin(business.gstin);
      }
    };
    loadBusinessGstin();
  }, []);

  // Prefill from sales order booking
  useEffect(() => {
    const orderId = searchParams.get("order_id");
    if (!orderId) return;

    fetch(`/api/sales/orders/${orderId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.order) {
          const o = data.order;
          setPartyId(o.party_id);
          if (o.notes) setRemarks(o.notes);
          if (o.party?.billing_address_line1) {
            const addr = [
              o.party.billing_address_line1,
              o.party.billing_address_line2,
              o.party.billing_city,
              o.party.billing_state,
              o.party.billing_pincode
            ].filter(Boolean).join(", ");
            setBillingAddress(addr);
          }
          if (o.party?.phone) setMobileNo(o.party.phone);
          if (o.party?.gstin) {
            setGstin(o.party.gstin);
            setGstTreatment("regular");
          } else {
            setGstTreatment("unregistered");
          }
          toast.success(`Prefilled customer details from order booking ${o.order_number}`);
        }
      })
      .catch((err) => console.error("Error loading prefilled order:", err));
  }, [searchParams]);

  // Fetch Designs, GST Rates, and Detailed Stock Level Map
  useEffect(() => {
    setLoadingDesigns(true);
    // Fetch Designs
    fetch("/api/master-data/designs")
      .then((res) => res.json())
      .then((data) => {
        if (data.designs) setDesigns(data.designs);
      })
      .catch((err) => console.error("Error loading designs:", err))
      .finally(() => setLoadingDesigns(false));

    // Fetch GST Rates
    fetch("/api/master-data/gst-rates")
      .then((res) => res.json())
      .then((data) => {
        if (data.gstRates) setGstRates(data.gstRates);
      })
      .catch((err) => console.error("Error loading GST rates:", err));

    // Fetch Detailed Stock Levels directly from Supabase
    const loadStock = async () => {
      const supabase = createClient();
      const { data: stockRows, error } = await supabase
        .from("finished_stock")
        .select("design_id, colour_id, size, total_quantity, cost_per_piece")
        .is("deleted_at", null);

      if (error) {
        console.error("Error fetching finished stock details:", error.message);
        return;
      }

      if (stockRows) {
        const stocks: Record<string, number> = {};
        const costs: Record<string, number> = {};
        stockRows.forEach((row) => {
          const key = `${row.design_id}_${row.colour_id || "none"}_${row.size}`;
          stocks[key] = (stocks[key] || 0) + (row.total_quantity || 0);
          costs[key] = row.cost_per_piece || 0;
        });
        setStockMap(stocks);
        setCostMap(costs);
      }
    };

    loadStock();
  }, []);

  // Auto-set Colour and Size when design changes
  const handleDesignSelect = (design: Design) => {
    setSelectedDesignId(design.id);
    setDesignSearchQuery(`${design.name} (${design.design_number})`);
    setIsSearchDropdownOpen(false);

    // Default to first colour if available
    if (design.design_colours && design.design_colours.length > 0) {
      setSelectedColourId(design.design_colours[0].id);
    } else {
      setSelectedColourId("none");
    }

    // Default to first size if available
    if (design.size_set?.sizes && design.size_set.sizes.length > 0) {
      setSelectedSize(design.size_set.sizes[0]);
    } else {
      setSelectedSize("");
    }

    // Set Default sale price
    setItemRate(design.sale_price || 0);
    setItemDiscount(0);
    setItemTaxOverride(null);
  };

  // Helper to get selected design
  const activeDesign = designs.find((d) => d.id === selectedDesignId);

  // Live stock level for current selection
  const liveStockQty = activeDesign
    ? stockMap[`${selectedDesignId}_${selectedColourId || "none"}_${selectedSize}`] || 0
    : 0;

  // Add Item to table
  const handleAddItem = () => {
    if (!selectedDesignId || !activeDesign) {
      toast.error("Please select a Design first");
      return;
    }
    if (!selectedSize) {
      toast.error("Please select a Size");
      return;
    }
    if (itemQty <= 0) {
      toast.error("Quantity must be greater than 0");
      return;
    }
    if (itemRate <= 0) {
      toast.error("Rate must be greater than 0");
      return;
    }

    // Get color details
    const colorObj = activeDesign.design_colours.find((c) => c.id === selectedColourId);
    const colourName = colorObj ? colorObj.colour_name : "Default";

    // Get GST rate matching design's HSN
    const gstRateObj = gstRates.find((r) => r.hsn_code === activeDesign.hsn_code);
    let finalTaxPercent = 0;
    if (itemTaxOverride !== null) {
      finalTaxPercent = itemTaxOverride;
    } else if (gstRateObj) {
      finalTaxPercent = calculateGST(itemRate, gstRateObj);
    }

    const key = `${selectedDesignId}_${selectedColourId || "none"}_${selectedSize}`;
    const cost = costMap[key] || (itemRate * 0.7); // Fallback to 70% of rate as cost

    // Calculate item taxable amount (Qty * Rate * (1 - Disc/100))
    const itemTaxableAmount = itemQty * itemRate * (1 - itemDiscount / 100);

    const newItem: BillItem = {
      id: Math.random().toString(36).substring(2, 9),
      design_id: selectedDesignId,
      design_name: activeDesign.name,
      design_code: activeDesign.design_number,
      colour_id: selectedColourId === "none" ? null : selectedColourId,
      colour_name: colourName,
      size: selectedSize,
      quantity: itemQty,
      unit: "Pcs",
      rate: itemRate,
      discount_percent: itemDiscount,
      tax_percent: finalTaxPercent,
      amount: itemTaxableAmount,
      cost_per_piece: cost,
      description: itemDescription,
      stock: liveStockQty,
      hsn_sac: activeDesign.hsn_code || null
    };

    setItems((prev) => [...prev, newItem]);
    
    // Reset Add Panel (keep design search open for fast next entry)
    setItemQty(1);
    setItemDescription("");
    toast.success(`Added ${activeDesign.name} (${selectedSize}) to bill`);
  };

  // Remove Item
  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleAddCharge = () => {
    if (!newChargeName.trim()) {
      toast.error("Please enter a Charge Name");
      return;
    }
    if (newChargeAmount <= 0) {
      toast.error("Charge amount must be greater than 0");
      return;
    }
    
    const newCharge: BillCharge = {
      id: Math.random().toString(36).substring(2, 9),
      charge_name: newChargeName.trim(),
      charge_type: newChargeType,
      is_taxable: newChargeIsTaxable,
      amount: newChargeAmount
    };

    setCharges((prev) => [...prev, newCharge]);
    setNewChargeName("");
    setNewChargeAmount(0);
    toast.success(`Added charge: ${newCharge.charge_name}`);
  };

  const handleRemoveCharge = (id: string) => {
    setCharges((prev) => prev.filter((c) => c.id !== id));
  };

  // Edit item quantity/rate/discount inline
  const updateInlineItem = (id: string, field: "quantity" | "rate" | "discount_percent", value: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };
        
        // Re-evaluate tax based on rate (if auto-tier)
        if (field === "rate") {
          const matchingDesign = designs.find((d) => d.id === item.design_id);
          const gstRateObj = gstRates.find((r) => r.hsn_code === matchingDesign?.hsn_code);
          if (gstRateObj) {
            updated.tax_percent = calculateGST(value, gstRateObj);
          }
        }

        // Re-calculate amount (taxable value)
        updated.amount = updated.quantity * updated.rate * (1 - updated.discount_percent / 100);
        return updated;
      })
    );
  };

  // Update Address/Mobile/GSTIN when party changes
  const handlePartyChange = (id: string) => {
    setPartyId(id);
    const selected = parties.find((p) => p.id === id);
    if (selected) {
      const addressParts = [
        selected.billing_address_line1,
        selected.billing_address_line2,
        selected.billing_city,
        selected.billing_state,
        selected.billing_pincode
      ].filter(Boolean);
      
      setBillingAddress(addressParts.join(", "));
      setMobileNo(selected.phone || "");
      setGstin(selected.gstin || "");
      if (selected.payment_terms) {
        setPaymentTerms(selected.payment_terms);
      }
    } else {
      setBillingAddress("");
      setMobileNo("");
      setGstin("");
    }
  };

  // Helper: auto-calculate due date based on payment terms
  useEffect(() => {
    if (!billDate) return;
    const dateObj = new Date(billDate);
    let daysToAdd = 0;
    
    if (paymentTerms === "15_days" || paymentTerms === "15") daysToAdd = 15;
    else if (paymentTerms === "30_days" || paymentTerms === "30") daysToAdd = 30;
    else if (paymentTerms === "45_days" || paymentTerms === "45") daysToAdd = 45;
    else if (paymentTerms === "60_days" || paymentTerms === "60") daysToAdd = 60;
    
    if (daysToAdd > 0) {
      dateObj.setDate(dateObj.getDate() + daysToAdd);
      setDueDate(dateObj.toISOString().split("T")[0]);
    } else {
      setDueDate(billDate); // Immediate
    }
  }, [billDate, paymentTerms]);

  // LIVE CALCULATIONS FOR SUMMARY PANEL
  // Sum of taxable value of all items (Qty * Rate * (1 - Disc/100))
  const itemTotal = items.reduce((sum, item) => sum + (item.rate * item.quantity), 0);
  const itemTotalAfterItemDiscount = items.reduce((sum, item) => sum + item.amount, 0);

  // Charges calculations
  const taxableChargesTotal = charges
    .filter((c) => c.is_taxable)
    .reduce((sum, c) => {
      if (c.charge_type === "flat") return sum + Number(c.amount || 0);
      if (c.charge_type === "per_qty") {
        const totalQty = items.reduce((tot, it) => tot + Number(it.quantity || 0), 0);
        return sum + (Number(c.amount || 0) * totalQty);
      }
      if (c.charge_type === "percentage") {
        return sum + (itemTotalAfterItemDiscount * (Number(c.amount || 0) / 100));
      }
      return sum;
    }, 0);

  const nonTaxableChargesTotal = charges
    .filter((c) => !c.is_taxable)
    .reduce((sum, c) => {
      if (c.charge_type === "flat") return sum + Number(c.amount || 0);
      if (c.charge_type === "per_qty") {
        const totalQty = items.reduce((tot, it) => tot + Number(it.quantity || 0), 0);
        return sum + (Number(c.amount || 0) * totalQty);
      }
      if (c.charge_type === "percentage") {
        return sum + (itemTotalAfterItemDiscount * (Number(c.amount || 0) / 100));
      }
      return sum;
    }, 0);

  const chargesTotal = taxableChargesTotal + nonTaxableChargesTotal;

  // Subtotal (Net Items + Taxable Charges)
  const subTotal = itemTotalAfterItemDiscount + taxableChargesTotal;

  // Overall Discount
  let discountAmount = 0;
  if (discountType === "flat") {
    discountAmount = discountValue;
  } else if (discountType === "percentage") {
    discountAmount = subTotal * (discountValue / 100);
  }

  // Taxable value
  const taxableAmount = Math.max(0, subTotal - discountAmount);

  // GST Taxes splits
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  // Check if Interstate (if first 2 digits of business GSTIN differ from customer GSTIN)
  const isInterstate =
    businessGstin &&
    gstin &&
    businessGstin.trim().substring(0, 2) !== gstin.trim().substring(0, 2);

  if (gstTreatment === "regular") {
    items.forEach((item) => {
      const share = itemTotalAfterItemDiscount > 0 ? item.amount / itemTotalAfterItemDiscount : 0;
      const itemShareOfSubtotal = item.amount + (taxableChargesTotal * share);
      const itemNetTaxableAfterDiscount = Math.max(0, itemShareOfSubtotal - (discountAmount * share));
      
      const itemGst = itemNetTaxableAfterDiscount * (item.tax_percent / 100);
      
      if (isInterstate) {
        igst += itemGst;
      } else {
        cgst += itemGst / 2;
        sgst += itemGst / 2;
      }
    });
  }

  const preRoundTotal = taxableAmount + cgst + sgst + igst + nonTaxableChargesTotal;
  const grandTotal = Math.round(preRoundTotal);
  const roundOff = grandTotal - preRoundTotal;

  const cogsWarnings = items.filter((it) => it.rate < it.cost_per_piece);
  const stockWarnings = items.filter((it) => it.quantity > it.stock);

  // Handle Wizard Steps Navigation
  const handleSaveAndNext = () => {
    if (step === 1) {
      if (!partyId) {
        toast.error("Please select a Party (Customer)");
        return;
      }
      if (!billType) {
        toast.error("Please select a Bill Type");
        return;
      }
      if (!billDate) {
        toast.error("Please select a Bill Date");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (items.length === 0) {
        toast.error("Please add at least one item to proceed");
        return;
      }
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  // Barcode scanning handlers
  const handleOpenScanner = async () => {
    setIsScannerOpen(true);
    // Dynamically load html5-qrcode inside browser
    setTimeout(async () => {
      try {
        const { Html5QrcodeScanner } = await import("html5-qrcode");
        const scanner = new Html5QrcodeScanner(
          "reader",
          { fps: 10, qrbox: { width: 250, height: 150 } },
          /* verbose= */ false
        );
        scannerRef.current = scanner;
        scanner.render(
          (decodedText) => {
            handleResolveBarcode(decodedText);
            scanner.clear();
            setIsScannerOpen(false);
          },
          (err) => {
            // Ignore scan errors as they occur continuously
          }
        );
      } catch (err) {
        console.error("Scanner failed to initialize:", err);
      }
    }, 300);
  };

  const handleCloseScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch((e: any) => console.log(e));
      scannerRef.current = null;
    }
    setIsScannerOpen(false);
  };

  const handleResolveBarcode = (code: string) => {
    if (!code) return;
    
    // Resolve UUID (design_id or design_colour_id)
    const matchingDesign = designs.find(
      (d) => d.id === code || d.design_number.toLowerCase() === code.trim().toLowerCase()
    );

    if (matchingDesign) {
      handleDesignSelect(matchingDesign);
      toast.success(`Found design: ${matchingDesign.name}`);
      return;
    }

    // Check design colours IDs
    for (const d of designs) {
      const matchColour = d.design_colours.find((c) => c.id === code);
      if (matchColour) {
        handleDesignSelect(d);
        setSelectedColourId(matchColour.id);
        toast.success(`Found design colour: ${d.name} (${matchColour.colour_name})`);
        return;
      }
    }

    toast.error(`Could not resolve code: "${code}"`);
  };

  // Filtered designs for search dropdown
  const filteredDesigns = designs.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(designSearchQuery.toLowerCase()) ||
      d.design_number.toLowerCase().includes(designSearchQuery.toLowerCase());
    
    if (showOnlyInStock) {
      // Sum stock for all colour/size combinations
      const totalStock = Object.keys(stockMap)
        .filter((k) => k.startsWith(d.id))
        .reduce((sum, k) => sum + stockMap[k], 0);
      return matchesSearch && totalStock > 0;
    }
    return matchesSearch;
  });

  const stepsList = ["Party & Type", "Add Items", "Charges & Discount", "Review & E-Way"];

  return (
    <div className="flex flex-col gap-6">
      {/* Back button and title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            if (step > 1) setStep(step - 1);
            else router.push("/sales/bills");
          }}
          className="p-1.5 rounded-lg border border-[#D1D5DB] text-[#64748B] hover:text-[#0F172A] bg-white transition-colors"
        >
          <ArrowLeft className="h-4.5 w-4.5" />
        </button>
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-[#0F172A]">Create Sale Bill (4-Step Wizard)</h1>
          <p className="text-xs text-[#64748B]">Fill in bill details, add items, and review e-way options</p>
        </div>
      </div>

      {/* Step Progress Tracker */}
      <WizardHeader currentStep={step} steps={stepsList} />

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Form Fields */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* STEP 1: PARTY & TYPE FORM */}
          {step === 1 && (
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm flex flex-col gap-6">
              <h2 className="text-base font-semibold text-[#0F172A] border-b border-[#F3F4F6] pb-3">
                Party & Type Details
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Party (Customer) */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#344054]">
                    Party / Customer <span className="text-[#DC2626]">*</span>
                  </label>
                  {loadingParties ? (
                    <div className="h-10 rounded-lg border border-[#D1D5DB] bg-[#F9FAFB] flex items-center px-3">
                      <Loader2 className="h-4 w-4 animate-spin text-[#64748B]" />
                    </div>
                  ) : (
                    <select
                      value={partyId}
                      onChange={(e) => handlePartyChange(e.target.value)}
                      className="h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm text-[#0F172A] bg-white focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] outline-none"
                    >
                      <option value="">Select a Customer</option>
                      {parties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Bill Type */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#344054]">
                    Bill Type <span className="text-[#DC2626]">*</span>
                  </label>
                  <div className="flex bg-[#F1F5F9] rounded-lg p-0.5 h-10 select-none">
                    <button
                      type="button"
                      onClick={() => setBillType("pakka")}
                      className={`flex-1 rounded-md text-xs font-bold transition-all ${
                        billType === "pakka"
                          ? "bg-[#6366F1] text-white shadow-sm"
                          : "text-[#64748B] hover:text-[#374151]"
                      }`}
                    >
                      Pakka Bill
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillType("kacha")}
                      className={`flex-1 rounded-md text-xs font-bold transition-all ${
                        billType === "kacha"
                          ? "bg-[#6366F1] text-white shadow-sm"
                          : "text-[#64748B] hover:text-[#374151]"
                      }`}
                    >
                      Kacha Bill
                    </button>
                  </div>
                </div>

                {/* GST Treatment */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#344054]">GST Treatment</label>
                  <select
                    value={gstTreatment}
                    onChange={(e) => setGstTreatment(e.target.value)}
                    className="h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm text-[#0F172A] bg-white focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] outline-none"
                  >
                    <option value="regular">Regular</option>
                    <option value="composition">Composition</option>
                    <option value="unregistered">Unregistered</option>
                    <option value="export">Export</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Billing Address */}
                <div className="flex flex-col gap-1.5 md:col-span-1">
                  <label className="text-xs font-bold text-[#344054]">Billing Address</label>
                  <textarea
                    rows={2}
                    value={billingAddress}
                    onChange={(e) => setBillingAddress(e.target.value)}
                    placeholder="Auto-filled from party..."
                    className="rounded-lg border border-[#D1D5DB] p-3 text-sm text-[#0F172A] bg-white focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] outline-none resize-none"
                  />
                </div>

                {/* Mobile No */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#344054]">Mobile No.</label>
                  <input
                    type="text"
                    value={mobileNo}
                    onChange={(e) => setMobileNo(e.target.value)}
                    placeholder="Auto-filled..."
                    className="h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm text-[#0F172A] bg-white focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] outline-none"
                  />
                </div>

                {/* GSTIN */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#344054]">GSTIN</label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    placeholder="Auto-filled..."
                    className="h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm text-[#0F172A] bg-white focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Bill Date */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#344054]">
                    Bill Date <span className="text-[#DC2626]">*</span>
                  </label>
                  <input
                    type="date"
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    className="h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm text-[#0F172A] bg-white focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] outline-none"
                  />
                </div>

                {/* Reference No */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#344054]">Reference No.</label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="e.g. Purchase order no."
                    className="h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm text-[#0F172A] bg-white focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] outline-none"
                  />
                </div>

                {/* Price List */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#344054]">Price List</label>
                  <select
                    value={priceListId}
                    onChange={(e) => setPriceListId(e.target.value)}
                    className="h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm text-[#0F172A] bg-white focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] outline-none"
                  >
                    <option value="">Default Sale Price</option>
                    <option value="wholesale">Wholesale List</option>
                    <option value="retail">Retail List</option>
                  </select>
                </div>

                {/* Payment Terms */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#344054]">Payment Terms</label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm text-[#0F172A] bg-white focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] outline-none"
                  >
                    <option value="Immediate">Immediate / Cash</option>
                    <option value="15_days">15 Days</option>
                    <option value="30_days">30 Days</option>
                    <option value="45_days">45 Days</option>
                    <option value="60_days">60 Days</option>
                  </select>
                </div>
              </div>

              {/* Collapsible Additional Details */}
              <div className="border border-[#E5E7EB] rounded-lg">
                <button
                  type="button"
                  onClick={() => setIsAdditionalExpanded(!isAdditionalExpanded)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[#F9FAFB] text-sm font-semibold text-[#374151] hover:bg-[#F3F4F6] transition-colors rounded-t-lg"
                >
                  <span>Additional Details (Transport, Salesman, Remarks)</span>
                  {isAdditionalExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {isAdditionalExpanded && (
                  <div className="p-4 flex flex-col gap-4 border-t border-[#E5E7EB] bg-white">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-[#344054]">Transporter Name</label>
                        <input
                          type="text"
                          value={transporterName}
                          onChange={(e) => setTransporterName(e.target.value)}
                          placeholder="Transporter Name"
                          className="h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm text-[#0F172A] focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-[#344054]">Vehicle No.</label>
                        <input
                          type="text"
                          value={vehicleNo}
                          onChange={(e) => setVehicleNo(e.target.value)}
                          placeholder="e.g. DL01AA1234"
                          className="h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm text-[#0F172A] focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-[#344054]">Salesman</label>
                        <select
                          value={salesman}
                          onChange={(e) => setSalesman(e.target.value)}
                          className="h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm text-[#0F172A] bg-white focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] outline-none"
                        >
                          <option value="">Select Salesperson</option>
                          {salesmen.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.full_name} ({s.role})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-[#344054]">Remarks</label>
                      <textarea
                        rows={2}
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Add internal remarks/notes..."
                        className="rounded-lg border border-[#D1D5DB] p-3 text-sm text-[#0F172A] focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] outline-none resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Blue Info Banner */}
              <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-3.5 flex items-start gap-2.5">
                <Info className="h-4.5 w-4.5 text-[#1D4ED8] shrink-0 mt-0.5" />
                <span className="text-xs text-[#1E40AF] font-medium leading-relaxed">
                  You can save as draft at any step and continue later from Drafts. Make sure to choose the correct bill type (Pakka/Kacha) as it affects tax reporting.
                </span>
              </div>
            </div>
          )}

          {/* STEP 2: ADD ITEMS (Loop 2) */}
          {step === 2 && (
            <div className="flex flex-col gap-6">
              {/* Add Item Selection Box */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm flex flex-col gap-4 relative">
                <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3">
                  <h2 className="text-base font-semibold text-[#0F172A]">Select Items to Add</h2>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleOpenScanner}
                      className="px-3 py-1.5 border border-[#6366F1] text-[#6366F1] hover:bg-[#EEF2FF] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <ScanLine className="h-4 w-4" />
                      <span>Scan Barcode</span>
                    </button>
                    <label className="flex items-center gap-1.5 text-xs text-[#64748B] font-medium select-none">
                      <input
                        type="checkbox"
                        checked={showOnlyInStock}
                        onChange={(e) => setShowOnlyInStock(e.target.checked)}
                        className="rounded text-[#6366F1] focus:ring-[#6366F1]"
                      />
                      <span>In-Stock Only</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  {/* Searchable Design Select */}
                  <div className="flex flex-col gap-1.5 md:col-span-2 relative">
                    <label className="text-xs font-bold text-[#344054]">Search Design (Name or Code)</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
                      <input
                        type="text"
                        placeholder="Type design name or code..."
                        value={designSearchQuery}
                        onChange={(e) => {
                          setDesignSearchQuery(e.target.value);
                          setIsSearchDropdownOpen(true);
                        }}
                        onFocus={() => setIsSearchDropdownOpen(true)}
                        className="pl-9 pr-4 py-2 w-full rounded-lg border border-[#D1D5DB] text-sm focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] outline-none"
                      />
                    </div>

                    {isSearchDropdownOpen && filteredDesigns.length > 0 && (
                      <div className="absolute left-0 right-0 top-16 max-h-60 rounded-lg border border-[#E5E7EB] bg-white shadow-lg z-20 overflow-y-auto">
                        {filteredDesigns.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => handleDesignSelect(d)}
                            className="w-full px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] text-left border-b border-[#F3F4F6] last:border-0 flex items-center justify-between"
                          >
                            <div className="flex flex-col">
                              <span className="font-semibold">{d.name}</span>
                              <span className="text-xs text-[#64748B] font-mono">{d.design_number}</span>
                            </div>
                            {d.sale_price && (
                              <span className="text-xs font-medium text-[#6366F1] bg-[#EEF2FF] px-2 py-0.5 rounded">
                                Rate: ₹{d.sale_price}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Colour Selection */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[#344054]">Colour</label>
                    <select
                      disabled={!selectedDesignId}
                      value={selectedColourId}
                      onChange={(e) => setSelectedColourId(e.target.value)}
                      className="h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm text-[#0F172A] bg-white focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] outline-none disabled:opacity-50"
                    >
                      <option value="">Choose Colour</option>
                      {activeDesign?.design_colours.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.colour_name}
                        </option>
                      ))}
                      {activeDesign && activeDesign.design_colours.length === 0 && (
                        <option value="none">Default</option>
                      )}
                    </select>
                  </div>

                  {/* Size Selection */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[#344054]">Size</label>
                    <select
                      disabled={!selectedDesignId}
                      value={selectedSize}
                      onChange={(e) => setSelectedSize(e.target.value)}
                      className="h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm text-[#0F172A] bg-white focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] outline-none disabled:opacity-50"
                    >
                      <option value="">Choose Size</option>
                      {activeDesign?.size_set?.sizes.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  {/* Quantity */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[#344054]">Quantity (Pcs)</label>
                    <input
                      type="number"
                      min={1}
                      disabled={!selectedDesignId}
                      value={itemQty}
                      onChange={(e) => setItemQty(Math.max(1, parseInt(e.target.value, 10) || 0))}
                      className="h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm text-[#0F172A] focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] outline-none disabled:opacity-50"
                    />
                  </div>

                  {/* Rate */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[#344054]">Rate (₹/Pc)</label>
                    <input
                      type="number"
                      min={0}
                      disabled={!selectedDesignId}
                      value={itemRate}
                      onChange={(e) => setItemRate(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm text-[#0F172A] focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] outline-none disabled:opacity-50"
                    />
                  </div>

                  {/* Discount */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[#344054]">Discount (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      disabled={!selectedDesignId}
                      value={itemDiscount}
                      onChange={(e) => setItemDiscount(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                      className="h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm text-[#0F172A] focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] outline-none disabled:opacity-50"
                    />
                  </div>

                  {/* Add button & live stock */}
                  <div className="flex flex-col gap-2">
                    {selectedDesignId && (
                      <div className="flex items-center gap-1.5 text-xs select-none">
                        <span className="text-[#64748B]">Live Stock:</span>
                        <span className={`font-semibold ${liveStockQty > 0 ? "text-[#15803D]" : "text-[#DC2626]"}`}>
                          {liveStockQty} Pcs
                        </span>
                        <span title="Physical stock in finished godown">
                          <Info className="h-3.5 w-3.5 text-[#94A3B8]" />
                        </span>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={!selectedDesignId}
                      onClick={handleAddItem}
                      className="h-10 w-full rounded-lg text-sm font-semibold text-white bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add to Bill</span>
                    </button>
                  </div>
                </div>

                {/* Optional Item Description */}
                {selectedDesignId && (
                  <div className="flex flex-col gap-1.5 pt-2 border-t border-[#F3F4F6]">
                    <label className="text-xs font-bold text-[#344054] flex items-center gap-1">
                      <span>Item Note / Batch details</span>
                      <span className="text-[#64748B] font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Special custom batch packaging details..."
                      value={itemDescription}
                      onChange={(e) => setItemDescription(e.target.value)}
                      className="h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm text-[#0F172A] focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1] outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Popular / Recent Items Quick Add Row */}
              {designs.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-[#6366F1]" />
                    <span>Quick-Add Popular Items</span>
                  </span>
                  <div className="flex gap-2.5 overflow-x-auto pb-1 select-none scrollbar-thin">
                    {designs.slice(0, 10).map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => handleDesignSelect(d)}
                        className="px-3 py-1.5 bg-white border border-[#E5E7EB] hover:border-[#6366F1] rounded-lg text-xs font-medium text-[#374151] hover:text-[#6366F1] transition-all flex items-center gap-1.5 shrink-0"
                      >
                        <span className="font-semibold">{d.name}</span>
                        <span className="text-[10px] text-[#64748B] font-mono">({d.design_number})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Items Table */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#F3F4F6]">
                  <h3 className="text-sm font-bold text-[#0F172A]">Added Items ({items.length})</h3>
                  {items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setItems([])}
                      className="text-xs font-semibold text-[#DC2626] hover:underline"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[#E5E7EB] text-left">
                    <thead className="bg-[#F9FAFB] text-[10px] font-bold text-[#64748B] uppercase tracking-wider select-none">
                      <tr>
                        <th className="px-5 py-3">#</th>
                        <th className="px-5 py-3">Item Details</th>
                        <th className="px-5 py-3">Stock</th>
                        <th className="px-5 py-3 w-20">Qty</th>
                        <th className="px-5 py-3 w-24">Rate (₹)</th>
                        <th className="px-5 py-3 w-20">Disc (%)</th>
                        <th className="px-5 py-3">Tax</th>
                        <th className="px-5 py-3">Amount</th>
                        <th className="px-5 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB] text-sm text-[#0F172A]">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-5 py-8 text-center text-xs text-[#64748B]">
                            No items added to the bill yet. Select a design above or scan a barcode to begin.
                          </td>
                        </tr>
                      ) : (
                        items.map((item, index) => {
                          const itemGst = item.amount * (item.tax_percent / 100);
                          const totalItemAmount = item.amount + itemGst;

                          return (
                            <tr key={item.id} className="hover:bg-[#F9FAFB] transition-colors">
                              <td className="px-5 py-4 text-xs font-semibold text-[#64748B]">{index + 1}</td>
                              <td className="px-5 py-4">
                                <div className="flex flex-col">
                                  <span className="font-semibold text-[#1E293B]">{item.design_name} ({item.size})</span>
                                  <span className="text-[10px] text-[#64748B] font-mono">Code: {item.design_code} | Colour: {item.colour_name}</span>
                                  {item.description && (
                                    <span className="text-[10px] text-[#2563EB] italic mt-0.5">Note: {item.description}</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-1 text-xs">
                                  <span className={`font-semibold ${item.stock > 0 ? "text-[#15803D]" : "text-[#DC2626]"}`}>
                                    {item.stock}
                                  </span>
                                  <span className="text-[10px] text-[#64748B]">Pcs</span>
                                </div>
                              </td>
                              {/* Editable Qty */}
                              <td className="px-5 py-4">
                                <input
                                  type="number"
                                  min={1}
                                  value={item.quantity}
                                  onChange={(e) => updateInlineItem(item.id, "quantity", Math.max(1, parseInt(e.target.value, 10) || 0))}
                                  className="w-16 border border-[#D1D5DB] rounded px-1.5 py-0.5 text-xs text-center font-medium focus:border-[#6366F1] outline-none"
                                />
                              </td>
                              {/* Editable Rate */}
                              <td className="px-5 py-4">
                                <input
                                  type="number"
                                  min={0}
                                  value={item.rate}
                                  onChange={(e) => updateInlineItem(item.id, "rate", Math.max(0, parseFloat(e.target.value) || 0))}
                                  className="w-20 border border-[#D1D5DB] rounded px-1.5 py-0.5 text-xs text-center font-medium focus:border-[#6366F1] outline-none"
                                />
                              </td>
                              {/* Editable Discount */}
                              <td className="px-5 py-4">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={item.discount_percent}
                                  onChange={(e) => updateInlineItem(item.id, "discount_percent", Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                                  className="w-14 border border-[#D1D5DB] rounded px-1.5 py-0.5 text-xs text-center font-medium focus:border-[#6366F1] outline-none"
                                />
                              </td>
                              {/* Tax Percent Badge */}
                              <td className="px-5 py-4 whitespace-nowrap">
                                <span className="px-2 py-0.5 bg-[#EEF2FF] text-[#6366F1] rounded text-xs font-semibold">
                                  {item.tax_percent}%
                                </span>
                              </td>
                              {/* Final Amount */}
                              <td className="px-5 py-4 whitespace-nowrap font-bold text-[#1E293B]">
                                ₹{totalItemAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="px-5 py-4 whitespace-nowrap text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="p-1 rounded-md text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: CHARGES & DISCOUNT */}
          {step === 3 && (
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm flex flex-col gap-6 animate-fadeIn">
              <h2 className="text-base font-semibold text-[#0F172A] border-b border-[#F3F4F6] pb-3">
                Charges & Discounts
              </h2>

              {/* Add Charge Form */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 flex flex-col gap-4">
                <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider">Add Additional Charge</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="flex flex-col gap-1.5 md:col-span-1">
                    <label className="text-xs font-bold text-[#344054]">Charge Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Freight, Packaging"
                      value={newChargeName}
                      onChange={(e) => setNewChargeName(e.target.value)}
                      className="h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm text-[#0F172A] focus:border-[#6366F1] outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[#344054]">Type</label>
                    <select
                      value={newChargeType}
                      onChange={(e) => setNewChargeType(e.target.value as any)}
                      className="h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm text-[#0F172A] bg-white focus:border-[#6366F1] outline-none"
                    >
                      <option value="flat">Flat (₹)</option>
                      <option value="per_qty">Per Qty (₹/Pc)</option>
                      <option value="percentage">Percentage (%)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[#344054]">Taxable (GST)</label>
                    <div className="flex bg-white rounded-lg border border-[#D1D5DB] p-0.5 h-10 select-none">
                      <button
                        type="button"
                        onClick={() => setNewChargeIsTaxable(true)}
                        className={`flex-1 rounded-md text-xs font-bold transition-all ${
                          newChargeIsTaxable
                            ? "bg-[#6366F1] text-white shadow-sm"
                            : "text-[#64748B] hover:text-[#374151]"
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewChargeIsTaxable(false)}
                        className={`flex-1 rounded-md text-xs font-bold transition-all ${
                          !newChargeIsTaxable
                            ? "bg-[#6366F1] text-white shadow-sm"
                            : "text-[#64748B] hover:text-[#374151]"
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[#344054]">Amount / Value</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={0}
                        value={newChargeAmount || ""}
                        onChange={(e) => setNewChargeAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                        placeholder="0.00"
                        className="h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-sm text-[#0F172A] focus:border-[#6366F1] outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddCharge}
                        className="h-10 px-4 rounded-lg text-sm font-semibold text-white bg-[#6366F1] hover:bg-[#4F46E5] transition-colors whitespace-nowrap"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* List of Added Charges */}
              {charges.length > 0 && (
                <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-[#E5E7EB] text-left text-xs">
                    <thead className="bg-[#F9FAFB] text-[#64748B] font-bold uppercase select-none">
                      <tr>
                        <th className="px-4 py-2.5">Charge Name</th>
                        <th className="px-4 py-2.5">Type</th>
                        <th className="px-4 py-2.5">Taxable</th>
                        <th className="px-4 py-2.5">Value</th>
                        <th className="px-4 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB] text-sm bg-white">
                      {charges.map((c) => (
                        <tr key={c.id} className="hover:bg-[#F9FAFB]">
                          <td className="px-4 py-3 font-semibold text-[#1E293B]">{c.charge_name}</td>
                          <td className="px-4 py-3 capitalize text-xs">{c.charge_type.replace("_", " ")}</td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`px-2 py-0.5 rounded font-bold ${
                              c.is_taxable ? "bg-[#EFF6FF] text-[#1D4ED8]" : "bg-[#F1F5F9] text-[#64748B]"
                            }`}>
                              {c.is_taxable ? "Yes (GST)" : "No (Post-Tax)"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {c.charge_type === "percentage" ? `${c.amount}%` : `₹${c.amount}`}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveCharge(c.id)}
                              className="text-[#64748B] hover:text-[#DC2626]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Overall Discount Section */}
              <div className="flex flex-col gap-4 border-t border-[#F3F4F6] pt-5">
                <h3 className="text-sm font-semibold text-[#0F172A]">Overall Invoice Discount</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[#344054]">Discount Type</label>
                    <div className="flex bg-[#F1F5F9] rounded-lg p-0.5 h-10 select-none">
                      <button
                        type="button"
                        onClick={() => {
                          setDiscountType(null);
                          setDiscountValue(0);
                        }}
                        className={`flex-1 rounded-md text-xs font-bold transition-all ${
                          discountType === null
                            ? "bg-[#6366F1] text-white shadow-sm"
                            : "text-[#64748B] hover:text-[#374151]"
                        }`}
                      >
                        No Discount
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType("flat")}
                        className={`flex-1 rounded-md text-xs font-bold transition-all ${
                          discountType === "flat"
                            ? "bg-[#6366F1] text-white shadow-sm"
                            : "text-[#64748B] hover:text-[#374151]"
                        }`}
                      >
                        Flat (₹)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType("percentage")}
                        className={`flex-1 rounded-md text-xs font-bold transition-all ${
                          discountType === "percentage"
                            ? "bg-[#6366F1] text-white shadow-sm"
                            : "text-[#64748B] hover:text-[#374151]"
                        }`}
                      >
                        Percent (%)
                      </button>
                    </div>
                  </div>

                  {discountType !== null && (
                    <div className="flex flex-col gap-1.5 animate-fadeIn">
                      <label className="text-xs font-bold text-[#344054]">
                        {discountType === "flat" ? "Discount Amount (₹)" : "Discount Percentage (%)"}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={discountType === "percentage" ? 100 : undefined}
                        value={discountValue || ""}
                        onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                        placeholder="Enter discount..."
                        className="h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm text-[#0F172A] focus:border-[#6366F1] outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Blue Info Banner */}
              <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-3.5 flex items-start gap-2.5">
                <Info className="h-4.5 w-4.5 text-[#1D4ED8] shrink-0 mt-0.5" />
                <span className="text-xs text-[#1E40AF] font-medium leading-relaxed">
                  Taxable charges are distributed across items and taxed at their respective GST rates. Non-taxable charges are added straight to the final invoice total.
                </span>
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW & E-WAY */}
          {step === 4 && (
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-sm flex flex-col gap-6 animate-fadeIn">
              <h2 className="text-base font-semibold text-[#0F172A] border-b border-[#F3F4F6] pb-3">
                Review & E-Way Details
              </h2>

              {/* COGS Warnings */}
              {cogsWarnings.length > 0 && (
                <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-[#DC2626] font-bold text-sm">
                    <AlertCircle className="h-5 w-5" />
                    <span>Warning: Selling Below Cost (COGS)</span>
                  </div>
                  <p className="text-xs text-[#7F1D1D] leading-relaxed">
                    The following items are configured with a sales rate lower than their estimated production cost of goods sold. This will reduce overall business profit margins.
                  </p>
                  <ul className="list-disc pl-5 text-xs text-[#7F1D1D] flex flex-col gap-1">
                    {cogsWarnings.map((it) => (
                      <li key={it.id}>
                        <span className="font-semibold">{it.design_name} ({it.size})</span>: Selling at ₹{it.rate} vs Cost of ₹{it.cost_per_piece}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Stock Warnings */}
              {stockWarnings.length > 0 && (
                <div className="bg-[#FFFBEB] border border-[#FCD34D] rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-[#D97706] font-bold text-sm">
                    <AlertCircle className="h-5 w-5" />
                    <span>Alert: Insufficient Finished Stock</span>
                  </div>
                  <p className="text-xs text-[#78350F] leading-relaxed">
                    The following items exceed the current physical stock in the godown. Saving will drive stock into negative quantities.
                  </p>
                  <ul className="list-disc pl-5 text-xs text-[#78350F] flex flex-col gap-1">
                    {stockWarnings.map((it) => (
                      <li key={it.id}>
                        <span className="font-semibold">{it.design_name} ({it.size})</span>: Required {it.quantity} Pcs vs Stock of {it.stock} Pcs
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Read-Only Bill Summary Details */}
              <div className="border border-[#E5E7EB] rounded-xl p-4 flex flex-col gap-3">
                <h3 className="text-xs font-bold text-[#475569] uppercase tracking-wider">Invoice Overview</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[#64748B]">Customer</span>
                    <span className="font-bold text-[#1E293B]">{parties.find(p => p.id === partyId)?.name || "N/A"}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[#64748B]">GSTIN</span>
                    <span className="font-semibold text-[#1E293B]">{gstin || "None"}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[#64748B]">Bill Date</span>
                    <span className="font-semibold text-[#1E293B]">{billDate}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[#64748B]">Payment Terms</span>
                    <span className="font-semibold text-[#1E293B]">{paymentTerms.replace("_", " ")}</span>
                  </div>
                </div>
              </div>

              {/* E-Way Bill Generation Toggle & Details */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-[#0F172A]">Generate E-Way Bill details</span>
                    <span className="text-xs text-[#64748B]">Include e-way transport and vehicle details with this invoice</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={generateEwayBill}
                      onChange={(e) => setGenerateEwayBill(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#6366F1]"></div>
                  </label>
                </div>

                {generateEwayBill && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-[#E5E7EB] pt-4 animate-fadeIn">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-[#344054]">E-Way Transporter</label>
                      <input
                        type="text"
                        placeholder="e.g. Blue Dart, Safexpress"
                        value={ewayTransporter}
                        onChange={(e) => setEwayTransporter(e.target.value)}
                        className="h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm focus:border-[#6366F1] outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-[#344054]">E-Way Vehicle No.</label>
                      <input
                        type="text"
                        placeholder="e.g. DL01AA1234"
                        value={ewayVehicleNo}
                        onChange={(e) => setEwayVehicleNo(e.target.value)}
                        className="h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm focus:border-[#6366F1] outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-[#344054]">Place of Supply</label>
                      <input
                        type="text"
                        placeholder="State / City name"
                        value={ewayPlaceOfSupply}
                        onChange={(e) => setEwayPlaceOfSupply(e.target.value)}
                        className="h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm focus:border-[#6366F1] outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-[#344054]">Valid Till</label>
                      <input
                        type="datetime-local"
                        value={ewayValidTill}
                        onChange={(e) => setEwayValidTill(e.target.value)}
                        className="h-10 rounded-lg border border-[#D1D5DB] px-3 text-sm focus:border-[#6366F1] outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Wizard Footer Navigation */}
          <div className="flex items-center justify-between bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-sm select-none">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => {
                if (step > 1) setStep(step - 1);
                else router.push("/sales/bills");
              }}
              className="px-4 py-2 border border-[#D1D5DB] rounded-lg text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB] transition-colors disabled:opacity-50"
            >
              {step === 1 ? "Cancel" : "← Back"}
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={handleSaveAndNext}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#6366F1] hover:bg-[#4F46E5] transition-colors"
              >
                Save & Next →
              </button>
            ) : (
              <div className="relative flex">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSaveBill("active")}
                  className="px-4 py-2 rounded-l-lg text-sm font-semibold text-white bg-[#15803D] hover:bg-[#166534] transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{billType === "pakka" ? "Save Active Invoice" : "Save Active Bill"}</span>
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsSaveDropdownOpen(!isSaveDropdownOpen)}
                  className="px-2 py-2 rounded-r-lg text-white bg-[#15803D] hover:bg-[#166534] transition-colors border-l border-[#166534] disabled:opacity-50"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>

                {isSaveDropdownOpen && (
                  <div className="absolute right-0 bottom-12 w-48 rounded-lg border border-[#E5E7EB] bg-white shadow-lg z-30 overflow-hidden text-left animate-fadeIn">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSaveDropdownOpen(false);
                        handleSaveBill("draft");
                      }}
                      className="w-full px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] text-left flex items-center gap-2"
                    >
                      <span>Save as Draft</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Sticky Summary Panel */}
        <div className="lg:col-span-1">
          <BillSummaryPanel
            itemCount={items.length}
            itemTotal={itemTotal}
            chargesTotal={chargesTotal}
            subTotal={subTotal}
            discount={discountAmount}
            taxableAmount={taxableAmount}
            cgst={cgst}
            sgst={sgst}
            igst={igst}
            roundOff={roundOff}
            grandTotal={grandTotal}
          />
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      {isScannerOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-2xl max-w-md w-full flex flex-col gap-4 relative">
            <button
              onClick={handleCloseScanner}
              className="absolute right-4 top-4 p-1 rounded-md text-[#64748B] hover:bg-[#F1F5F9] transition-colors"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            <div className="text-center">
              <h3 className="text-base font-bold text-[#0F172A]">Scan Garment Label</h3>
              <p className="text-xs text-[#64748B]">Scan the label QR/barcode using camera or type manual code</p>
            </div>

            {/* html5-qrcode reader div */}
            <div id="reader" className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg overflow-hidden min-h-[250px]" />

            {/* Manual input fallback */}
            <div className="flex flex-col gap-1.5 border-t border-[#F3F4F6] pt-4">
              <label className="text-xs font-bold text-[#344054]">Manual Code Lookup</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. UUID, barcode or design code"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  className="flex-1 h-9 rounded-lg border border-[#D1D5DB] px-3 text-xs outline-none focus:border-[#6366F1]"
                />
                <button
                  type="button"
                  onClick={() => {
                    handleResolveBarcode(manualBarcode);
                    setManualBarcode("");
                    handleCloseScanner();
                  }}
                  className="h-9 px-3 rounded-lg text-xs font-bold text-white bg-[#6366F1] hover:bg-[#4F46E5] transition-colors"
                >
                  Lookup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
