import { RawMaterialRepository } from "@/repositories/raw-material.repository";

export class RawMaterialService {
  constructor(private repo: RawMaterialRepository) {}

  async getMaterialTypes(businessId: string) {
    return this.repo.list(businessId);
  }

  async createMaterialType(businessId: string, params: {
    name: string;
    description?: string | null;
    category?: string | null;
    unit: string;
    image_url?: string | null;
    default_supplier_id?: string | null;
    reorder_level: number;
    is_active: boolean;
  }) {
    if (!params.name || !params.unit) {
      throw new Error("Material Name and Measurement Unit are required");
    }
    return this.repo.insert(businessId, params);
  }

  async updateMaterialType(id: string, businessId: string, params: {
    name: string;
    description?: string | null;
    category?: string | null;
    unit: string;
    image_url?: string | null;
    default_supplier_id?: string | null;
    reorder_level: number;
    is_active: boolean;
    lastKnownUpdatedAt: string;
  }) {
    if (!params.name || !params.unit || !params.lastKnownUpdatedAt) {
      throw new Error("Name, Unit, and last known updated_at timestamp are required");
    }

    const updated = await this.repo.update(id, businessId, params);
    if (!updated || updated.length === 0) {
      throw new Error("Conflict: Raw Material Type was modified by another transaction. Please reload.");
    }
    return updated[0];
  }

  async deleteMaterialType(id: string, businessId: string) {
    return this.repo.softDelete(id, businessId);
  }
}
