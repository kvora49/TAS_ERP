import { SupabaseClient } from "@supabase/supabase-js";
import { PurchaseRepository, PurchaseCreateParams } from "@/repositories/purchase.repository";

export class PurchaseService {
  private repo: PurchaseRepository;

  constructor(supabase: SupabaseClient) {
    this.repo = new PurchaseRepository(supabase);
  }

  async listPurchases(
    businessId: string,
    filters: { status?: string | null; paymentStatus?: string | null; search?: string | null } = {}
  ) {
    return this.repo.list(businessId, filters);
  }

  async getPurchaseById(id: string, businessId: string) {
    const purchase = await this.repo.getById(id, businessId);
    if (!purchase) throw new Error("Purchase not found");
    return purchase;
  }

  async createPurchase(
    businessId: string,
    body: Omit<PurchaseCreateParams, "businessId" | "purchaseNumber">,
    userId: string | null
  ) {
    // Validate required fields
    if (!body.supplier_id) throw new Error("Supplier is required");
    if (!body.godown_id) throw new Error("Godown is required");
    if (!body.invoice_no) throw new Error("Invoice Number is required");
    if (!body.invoice_date) throw new Error("Invoice Date is required");
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      throw new Error("At least one purchase item is required");
    }

    // Generate purchase number
    const year = new Date(body.invoice_date).getFullYear() || new Date().getFullYear();
    const purchaseNumber = await this.repo.generateNextNumber(businessId, year);

    return this.repo.create({ ...body, businessId, purchaseNumber }, userId);
  }

  async deletePurchase(id: string, businessId: string) {
    // Verify ownership before deleting (multi-tenant safety)
    const existing = await this.repo.getById(id, businessId);
    if (!existing) throw new Error("Purchase not found or access denied");
    return this.repo.softDelete(id, businessId);
  }

  async updatePaymentStatus(
    id: string,
    businessId: string,
    paidAmount: number,
    grandTotal: number
  ) {
    return this.repo.updatePaymentStatus(id, businessId, paidAmount, grandTotal);
  }
}
